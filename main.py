from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
from datetime import datetime, timedelta

app = FastAPI(
    title="RainGuard AI API",
    description="Local rain alert API using Open-Meteo with OpenWeatherMap verification",
    version="5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

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


async def fetch_openweather(lat, lon):
    if not OPENWEATHER_API_KEY:
        return {
            "available": False,
            "reason": "OPENWEATHER_API_KEY not configured"
        }

    params = {
        "lat": lat,
        "lon": lon,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
        "lang": "ar"
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(OPENWEATHER_URL, params=params)

        if response.status_code != 200:
            return {
                "available": False,
                "reason": f"OpenWeatherMap error {response.status_code}"
            }

        data = response.json()

        weather_list = data.get("weather", [])
        main = data.get("main", {})
        clouds = data.get("clouds", {})
        wind = data.get("wind", {})
        rain = data.get("rain", {})

        weather_main = weather_list[0].get("main", "") if weather_list else ""
        weather_desc = weather_list[0].get("description", "") if weather_list else ""

        rain_1h = rain.get("1h", 0) or 0
        rain_3h = rain.get("3h", 0) or 0
        cloud_cover = clouds.get("all", 0) or 0
        humidity = main.get("humidity", 0) or 0
        pressure = main.get("pressure", 1013) or 1013
        wind_speed = wind.get("speed", 0) or 0

        rain_detected = (
            "Rain" in weather_main
            or "Thunderstorm" in weather_main
            or rain_1h > 0
            or rain_3h > 0
        )

        confirmation_score = 0

        if rain_detected:
            confirmation_score += 45

        if cloud_cover >= 70:
            confirmation_score += 20

        if humidity >= 70:
            confirmation_score += 15

        if pressure <= 1010:
            confirmation_score += 10

        if wind_speed >= 5:
            confirmation_score += 10

        confirmation_score = min(round(confirmation_score), 100)

        return {
            "available": True,
            "weather_main": weather_main,
            "weather_description": weather_desc,
            "temperature": main.get("temp", 0),
            "humidity": humidity,
            "pressure": pressure,
            "cloud_cover": cloud_cover,
            "wind_speed": wind_speed,
            "rain_1h": rain_1h,
            "rain_3h": rain_3h,
            "rain_detected": rain_detected,
            "confirmation_score": confirmation_score
        }

    except Exception as e:
        return {
            "available": False,
            "reason": str(e)
        }


def verify_with_openweather(open_meteo_score, openweather_data):
    if not openweather_data.get("available"):
        return {
            "verified": False,
            "confidence": "Open-Meteo only",
            "confidence_score": open_meteo_score,
            "note": "OpenWeatherMap verification unavailable"
        }

    ow_score = openweather_data.get("confirmation_score", 0)
    rain_detected = openweather_data.get("rain_detected", False)

    if open_meteo_score >= 60 and rain_detected:
        return {
            "verified": True,
            "confidence": "High confidence - confirmed by two sources",
            "confidence_score": min(100, round((open_meteo_score + ow_score) / 2 + 10)),
            "note": "Rain signal confirmed by OpenWeatherMap"
        }

    if open_meteo_score >= 60 and ow_score >= 50:
        return {
            "verified": True,
            "confidence": "Moderate confidence - supported by second source",
            "confidence_score": round((open_meteo_score + ow_score) / 2),
            "note": "Weather conditions support rain possibility"
        }

    if open_meteo_score >= 60 and ow_score < 40:
        return {
            "verified": False,
            "confidence": "Needs monitoring - second source did not confirm",
            "confidence_score": round((open_meteo_score + ow_score) / 2),
            "note": "Open-Meteo shows risk but OpenWeatherMap does not strongly confirm"
        }

    if open_meteo_score < 60 and rain_detected:
        return {
            "verified": True,
            "confidence": "Radar/source conflict - monitor closely",
            "confidence_score": max(open_meteo_score, ow_score),
            "note": "OpenWeatherMap detected rain although Open-Meteo risk is lower"
        }

    return {
        "verified": False,
        "confidence": "Low confidence / low risk",
        "confidence_score": open_meteo_score,
        "note": "No strong rain confirmation"
    }


@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "version": "5.0",
        "cache_minutes": CACHE_MINUTES,
        "openweather_enabled": bool(OPENWEATHER_API_KEY),
        "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RainGuard AI",
        "openweather_enabled": bool(OPENWEATHER_API_KEY)
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

    weather = None
    open_meteo_failed = False

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(OPEN_METEO_URL, params=params)

            if response.status_code == 429:
                old_cache = CACHE.get(key)

                if old_cache:
                    data = old_cache["data"]
                    data["cache_status"] = "old_cache"
                    data["message"] = "تم استخدام آخر بيانات محفوظة بسبب كثرة الطلبات على Open-Meteo"
                    return JSONResponse(
                        content=data,
                        media_type="application/json; charset=utf-8"
                    )

                open_meteo_failed = True

            else:
                response.raise_for_status()
                weather = response.json()

    except Exception:
        open_meteo_failed = True

    if open_meteo_failed or weather is None:
        openweather_data = await fetch_openweather(lat, lon)

        if not openweather_data.get("available"):
            return JSONResponse(
                status_code=502,
                content={
                    "error": True,
                    "error_type": "all_sources_failed",
                    "message": "تعذر جلب بيانات الطقس من المصادر المتاحة مؤقتًا",
                    "location_name": name,
                    "openweather": openweather_data
                },
                media_type="application/json; charset=utf-8"
            )

        fallback_score = openweather_data.get("confirmation_score", 0)
        alert = classify(fallback_score)

        current = {
            "time": datetime.utcnow().isoformat() + "Z",
            "temperature": openweather_data.get("temperature", 0),
            "humidity": openweather_data.get("humidity", 0),
            "dew_point": 0,
            "rain_probability": fallback_score,
            "precipitation_mm": openweather_data.get("rain_1h", 0),
            "cloud_cover": openweather_data.get("cloud_cover", 0),
            "pressure_hpa": openweather_data.get("pressure", 1013),
            "wind_speed": openweather_data.get("wind_speed", 0),
            "rain_score": fallback_score,
            "alert_level": alert["level"],
            "advice": alert["advice"]
        }

        result = {
            "error": False,
            "location_name": name,
            "latitude": lat,
            "longitude": lon,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "cache_status": "fresh",
            "source": "OpenWeatherMap fallback",
            "current": current,
            "best_hour": current,
            "next_hours": [current],
            "daily_forecast": [],
            "openweather": openweather_data,
            "verification": {
                "verified": True,
                "confidence": "Fallback mode - OpenWeatherMap used",
                "confidence_score": fallback_score,
                "note": "Open-Meteo unavailable or rate limited"
            },
            "disclaimer": "Experimental local rain prediction system."
        }

        save_cache(key, result)

        return JSONResponse(
            content=result,
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

    openweather_data = None
    verification = {
        "verified": False,
        "confidence": "Open-Meteo only",
        "confidence_score": best_hour["rain_score"],
        "note": "Second source not required"
    }

    if best_hour["rain_score"] >= 40:
        openweather_data = await fetch_openweather(lat, lon)
        verification = verify_with_openweather(
            best_hour["rain_score"],
            openweather_data
        )

        best_hour["verification"] = verification

        if verification["verified"]:
            best_hour["alert_level"] = best_hour["alert_level"] + " - VERIFIED"
            best_hour["advice"] = best_hour["advice"] + " Confirmed by second source."

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
        "openweather": openweather_data,
        "verification": verification,
        "disclaimer": "Experimental local rain prediction system."
    }

    save_cache(key, result)

    return JSONResponse(
        content=result,
        media_type="application/json; charset=utf-8"
    )
