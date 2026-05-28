from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
from datetime import datetime, timedelta

app = FastAPI(
    title="RainGuard AI API",
    description="RainGuard AI Backend with Hybrid Forecast Recovery AI",
    version="6.1"
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


def now_utc():
    return datetime.utcnow()


def cache_key(lat, lon, hours):
    return f"{round(float(lat), 4)}:{round(float(lon), 4)}:{int(hours)}"


def get_cached(key):
    item = CACHE.get(key)
    if not item:
        return None

    if now_utc() - item["time"] <= timedelta(minutes=CACHE_MINUTES):
        data = dict(item["data"])
        data["cache_status"] = "cached"
        return data

    return None


def save_cache(key, data):
    CACHE[key] = {
        "time": now_utc(),
        "data": data
    }


def safe_number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def classify(score):
    score = safe_number(score)

    if score >= 80:
        return {
            "level": "تحذير مطر مرتفع",
            "advice": "احتمال هطول أمطار قوية. تابع التنبيهات الرسمية."
        }

    if score >= 60:
        return {
            "level": "تنبيه مطر متوسط",
            "advice": "فرصة المطر متوسطة إلى مرتفعة. يفضل متابعة التحديثات."
        }

    if score >= 40:
        return {
            "level": "احتمال مطر ضعيف إلى متوسط",
            "advice": "توجد مؤشرات ضعيفة إلى متوسطة لاحتمال المطر."
        }

    return {
        "level": "لا يوجد تنبيه مطر",
        "advice": "فرصة المطر منخفضة حاليًا."
    }


def calculate_rain_score(row):
    humidity = safe_number(row.get("humidity"))
    rain_probability = safe_number(row.get("rain_probability"))
    cloud_cover = safe_number(row.get("cloud_cover"))
    precipitation = safe_number(row.get("precipitation_mm"))
    dew_point = safe_number(row.get("dew_point"))
    pressure = safe_number(row.get("pressure_hpa"), 1013)
    wind_speed = safe_number(row.get("wind_speed"))

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


def calculate_daily_score(day):
    rain_probability = safe_number(day.get("rain_probability_max"))
    precipitation_sum = safe_number(day.get("precipitation_sum"))

    score = 0
    score += rain_probability * 0.75

    if precipitation_sum > 0:
        score += 10

    if precipitation_sum >= 5:
        score += 10

    if precipitation_sum >= 15:
        score += 5

    return min(round(score), 100)


async def fetch_openweather(lat, lon):
    if not OPENWEATHER_API_KEY:
        return {
            "available": False,
            "reason": "OpenWeatherMap key is missing"
        }

    try:
        params = {
            "lat": lat,
            "lon": lon,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "lang": "ar"
        }

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(OPENWEATHER_URL, params=params)

        if response.status_code != 200:
            return {
                "available": False,
                "reason": f"OpenWeatherMap status {response.status_code}"
            }

        data = response.json()

        weather_list = data.get("weather", [])
        main = data.get("main", {})
        clouds = data.get("clouds", {})
        wind = data.get("wind", {})
        rain = data.get("rain", {})

        weather_main = weather_list[0].get("main", "") if weather_list else ""
        weather_desc = weather_list[0].get("description", "") if weather_list else ""

        rain_1h = safe_number(rain.get("1h"))
        rain_3h = safe_number(rain.get("3h"))
        cloud_cover = safe_number(clouds.get("all"))
        humidity = safe_number(main.get("humidity"))
        pressure = safe_number(main.get("pressure"), 1013)
        wind_speed = safe_number(wind.get("speed")) * 3.6
        temperature = safe_number(main.get("temp"))

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

        if wind_speed >= 18:
            confirmation_score += 10

        confirmation_score = min(round(confirmation_score), 100)

        return {
            "available": True,
            "weather_main": weather_main,
            "weather_description": weather_desc,
            "temperature": temperature,
            "humidity": humidity,
            "pressure": pressure,
            "cloud_cover": cloud_cover,
            "wind_speed": round(wind_speed, 1),
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
    open_meteo_score = safe_number(open_meteo_score)

    if not openweather_data.get("available"):
        return {
            "verified": False,
            "confidence": "اعتماد على Open-Meteo فقط",
            "confidence_score": open_meteo_score,
            "note": "تعذر التحقق من OpenWeatherMap"
        }

    ow_score = safe_number(openweather_data.get("confirmation_score"))
    rain_detected = openweather_data.get("rain_detected", False)

    if open_meteo_score >= 60 and rain_detected:
        return {
            "verified": True,
            "confidence": "ثقة عالية - تم التأكيد من مصدرين",
            "confidence_score": min(100, round((open_meteo_score + ow_score) / 2 + 10)),
            "note": "إشارة المطر مؤكدة من OpenWeatherMap"
        }

    if open_meteo_score >= 60 and ow_score >= 50:
        return {
            "verified": True,
            "confidence": "ثقة متوسطة - المصدر الثاني يدعم الاحتمال",
            "confidence_score": round((open_meteo_score + ow_score) / 2),
            "note": "الظروف الجوية تدعم احتمال المطر"
        }

    return {
        "verified": False,
        "confidence": "ثقة منخفضة / خطر منخفض",
        "confidence_score": max(open_meteo_score, ow_score),
        "note": "لا يوجد تأكيد قوي لاحتمال المطر"
    }


def build_current_from_openweather(openweather_data):
    score = safe_number(openweather_data.get("confirmation_score"))
    alert = classify(score)

    current = {
        "time": now_utc().isoformat() + "Z",
        "temperature": safe_number(openweather_data.get("temperature")),
        "humidity": safe_number(openweather_data.get("humidity")),
        "dew_point": 0,
        "rain_probability": score,
        "precipitation_mm": safe_number(openweather_data.get("rain_1h")),
        "cloud_cover": safe_number(openweather_data.get("cloud_cover")),
        "pressure_hpa": safe_number(openweather_data.get("pressure"), 1013),
        "wind_speed": safe_number(openweather_data.get("wind_speed")),
        "rain_score": score,
        "alert_level": alert["level"],
        "advice": alert["advice"]
    }

    return current


def build_hybrid_next_hours(openweather_data, hours=12):
    base = build_current_from_openweather(openweather_data)
    base_score = safe_number(base["rain_score"])
    base_temp = safe_number(base["temperature"])
    base_humidity = safe_number(base["humidity"])
    base_cloud = safe_number(base["cloud_cover"])
    base_wind = safe_number(base["wind_speed"])
    base_pressure = safe_number(base["pressure_hpa"], 1013)
    base_rain = safe_number(base["precipitation_mm"])

    rows = []

    for i in range(hours):
        time_value = now_utc() + timedelta(hours=i)

        if i <= 2:
            score = base_score
        elif i <= 5:
            score = max(base_score - 5, 0)
        elif i <= 8:
            score = max(base_score - 10, 0)
        else:
            score = max(base_score - 15, 0)

        if base_score >= 60 and i in [1, 2, 3]:
            score = min(score + 5, 100)

        alert = classify(score)

        row = {
            "time": time_value.isoformat() + "Z",
            "temperature": round(base_temp + (i * 0.2), 1),
            "humidity": max(round(base_humidity - (i * 0.8), 1), 0),
            "dew_point": 0,
            "rain_probability": score,
            "precipitation_mm": base_rain if i == 0 else 0,
            "cloud_cover": max(round(base_cloud - (i * 1.2), 1), 0),
            "pressure_hpa": base_pressure,
            "wind_speed": base_wind,
            "rain_score": score,
            "alert_level": alert["level"],
            "advice": alert["advice"]
        }

        rows.append(row)

    return rows


def build_hybrid_daily_forecast(openweather_data):
    base = build_current_from_openweather(openweather_data)
    base_score = safe_number(base["rain_score"])
    base_temp = safe_number(base["temperature"])
    base_wind = safe_number(base["wind_speed"])
    base_rain = safe_number(base["precipitation_mm"])

    days = []

    for i in range(7):
        date_value = (now_utc() + timedelta(days=i)).date().isoformat()

        daily_score = max(base_score - (i * 6), 0)
        alert = classify(daily_score)

        precipitation_sum = base_rain
        if daily_score >= 80:
            precipitation_sum = max(base_rain, 8)
        elif daily_score >= 60:
            precipitation_sum = max(base_rain, 4)
        elif daily_score >= 40:
            precipitation_sum = max(base_rain, 1.5)

        day = {
            "date": date_value,
            "temperature_max": round(base_temp + 3 + i * 0.2, 1),
            "temperature_min": round(base_temp - 4, 1),
            "rain_probability_max": daily_score,
            "precipitation_sum": round(precipitation_sum, 1),
            "rain_sum": round(precipitation_sum, 1),
            "wind_speed_max": base_wind,
            "daily_rain_score": daily_score,
            "alert_level": alert["level"],
            "advice": alert["advice"]
        }

        days.append(day)

    return days


def build_hybrid_recovery_result(lat, lon, name, openweather_data, reason, hours):
    next_hours = build_hybrid_next_hours(openweather_data, hours)
    daily_forecast = build_hybrid_daily_forecast(openweather_data)

    best_hour = max(next_hours, key=lambda x: x["rain_score"])
    current = next_hours[0]

    result = {
        "error": False,
        "location_name": name,
        "latitude": lat,
        "longitude": lon,
        "generated_at": now_utc().isoformat() + "Z",
        "cache_status": "fresh",
        "source": "Hybrid Forecast Recovery AI",
        "recovery_reason": reason,
        "current": current,
        "best_hour": best_hour,
        "next_hours": next_hours,
        "daily_forecast": daily_forecast,
        "openweather": openweather_data,
        "verification": {
            "verified": True,
            "confidence": "Hybrid Recovery - تم بناء توقعات تقديرية من OpenWeatherMap",
            "confidence_score": best_hour["rain_score"],
            "note": "تم استخدام OpenWeatherMap لبناء توقعات 12 ساعة و7 أيام عند تعذر Open-Meteo"
        },
        "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر ولا يغني عن التنبيهات الرسمية."
    }

    return result


@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "version": "6.1",
        "cache_minutes": CACHE_MINUTES,
        "openweather_enabled": bool(OPENWEATHER_API_KEY),
        "hybrid_recovery": True,
        "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RainGuard AI",
        "version": "6.1",
        "openweather_enabled": bool(OPENWEATHER_API_KEY),
        "hybrid_recovery": True
    }


@app.get("/rain-alert")
async def rain_alert(
    lat: float = Query(...),
    lon: float = Query(...),
    name: str = Query("Unknown Location"),
    hours: int = Query(12)
):
    hours = max(1, min(int(hours), 48))
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
    open_meteo_error = ""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(OPEN_METEO_URL, params=params)

        if response.status_code == 429:
            old_cache = CACHE.get(key)
            if old_cache:
                data = dict(old_cache["data"])
                data["cache_status"] = "old_cache"
                data["message"] = "تم استخدام آخر بيانات محفوظة بسبب كثرة الطلبات."
                return JSONResponse(
                    content=data,
                    media_type="application/json; charset=utf-8"
                )

            open_meteo_failed = True
            open_meteo_error = "Open-Meteo 429 Too Many Requests"

        elif response.status_code != 200:
            open_meteo_failed = True
            open_meteo_error = f"Open-Meteo status {response.status_code}"

        else:
            weather = response.json()

    except Exception as e:
        open_meteo_failed = True
        open_meteo_error = str(e)

    if open_meteo_failed or not weather:
        openweather_data = await fetch_openweather(lat, lon)

        if openweather_data.get("available"):
            result = build_hybrid_recovery_result(
                lat,
                lon,
                name,
                openweather_data,
                open_meteo_error or "Open-Meteo unavailable",
                hours
            )

            save_cache(key, result)

            return JSONResponse(
                content=result,
                media_type="application/json; charset=utf-8"
            )

        return JSONResponse(
            status_code=200,
            content={
                "error": True,
                "location_name": name,
                "latitude": lat,
                "longitude": lon,
                "generated_at": now_utc().isoformat() + "Z",
                "cache_status": "none",
                "message": "تعذر جلب بيانات الطقس من المصادر المتاحة مؤقتًا",
                "open_meteo_error": open_meteo_error,
                "openweather": openweather_data,
                "current": None,
                "best_hour": None,
                "next_hours": [],
                "daily_forecast": [],
                "verification": {
                    "verified": False,
                    "confidence": "لا توجد بيانات كافية",
                    "confidence_score": 0,
                    "note": "تعذر الاتصال بمصادر الطقس"
                }
            },
            media_type="application/json; charset=utf-8"
        )

    try:
        h = weather.get("hourly", {})
        all_times = h.get("time", [])

        if not all_times:
            raise ValueError("No hourly time data")

        now_local = datetime.now()
        start_index = 0

        for i, time_str in enumerate(all_times):
            try:
                forecast_time = datetime.fromisoformat(time_str)
                if forecast_time >= now_local:
                    start_index = i
                    break
            except Exception:
                continue

        next_hours = []
        end_index = min(start_index + hours, len(all_times))

        for i in range(start_index, end_index):
            row = {
                "time": h.get("time", [])[i],
                "temperature": safe_number(h.get("temperature_2m", [])[i]),
                "humidity": safe_number(h.get("relative_humidity_2m", [])[i]),
                "dew_point": safe_number(h.get("dew_point_2m", [])[i]),
                "rain_probability": safe_number(h.get("precipitation_probability", [])[i]),
                "precipitation_mm": safe_number(h.get("precipitation", [])[i]),
                "cloud_cover": safe_number(h.get("cloud_cover", [])[i]),
                "pressure_hpa": safe_number(h.get("pressure_msl", [])[i], 1013),
                "wind_speed": safe_number(h.get("wind_speed_10m", [])[i])
            }

            score = calculate_rain_score(row)
            alert = classify(score)

            row["rain_score"] = score
            row["alert_level"] = alert["level"]
            row["advice"] = alert["advice"]

            next_hours.append(row)

        if not next_hours:
            raise ValueError("No next hour data")

        best_hour = max(next_hours, key=lambda x: x["rain_score"])

        openweather_data = None
        verification = {
            "verified": False,
            "confidence": "اعتماد على Open-Meteo فقط",
            "confidence_score": best_hour["rain_score"],
            "note": "لا توجد حاجة للتحقق من مصدر ثانٍ حاليًا"
        }

        if best_hour["rain_score"] >= 40:
            openweather_data = await fetch_openweather(lat, lon)
            verification = verify_with_openweather(
                best_hour["rain_score"],
                openweather_data
            )

        d = weather.get("daily", {})
        daily_forecast = []
        daily_times = d.get("time", [])

        for i in range(len(daily_times)):
            day = {
                "date": d.get("time", [])[i],
                "temperature_max": safe_number(d.get("temperature_2m_max", [])[i]),
                "temperature_min": safe_number(d.get("temperature_2m_min", [])[i]),
                "rain_probability_max": safe_number(d.get("precipitation_probability_max", [])[i]),
                "precipitation_sum": safe_number(d.get("precipitation_sum", [])[i]),
                "rain_sum": safe_number(d.get("rain_sum", [])[i]),
                "wind_speed_max": safe_number(d.get("wind_speed_10m_max", [])[i])
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
            "generated_at": now_utc().isoformat() + "Z",
            "cache_status": "fresh",
            "source": "Open-Meteo Forecast API",
            "current": next_hours[0],
            "best_hour": best_hour,
            "next_hours": next_hours,
            "daily_forecast": daily_forecast,
            "openweather": openweather_data,
            "verification": verification,
            "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر ولا يغني عن التنبيهات الرسمية."
        }

        save_cache(key, result)

        return JSONResponse(
            content=result,
            media_type="application/json; charset=utf-8"
        )

    except Exception as e:
        openweather_data = await fetch_openweather(lat, lon)

        if openweather_data.get("available"):
            result = build_hybrid_recovery_result(
                lat,
                lon,
                name,
                openweather_data,
                f"Open-Meteo parse error: {str(e)}",
                hours
            )

            save_cache(key, result)

            return JSONResponse(
                content=result,
                media_type="application/json; charset=utf-8"
            )

        return JSONResponse(
            status_code=200,
            content={
                "error": True,
                "location_name": name,
                "latitude": lat,
                "longitude": lon,
                "generated_at": now_utc().isoformat() + "Z",
                "message": "تعذر معالجة بيانات الطقس مؤقتًا",
                "parse_error": str(e),
                "current": None,
                "best_hour": None,
                "next_hours": [],
                "daily_forecast": []
            },
            media_type="application/json; charset=utf-8"
        )
