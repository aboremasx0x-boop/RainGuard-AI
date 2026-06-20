from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
import sqlite3
from supabase import create_client
from datetime import datetime, timedelta

app = FastAPI(title="RainGuard AI API", version="6.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CACHE = {}
CACHE_MINUTES = 10

SOURCE_STATE = {
    "open_meteo_cooldown_until": None,
    "open_meteo_failures": 0,
    "openweather_failures": 0
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "rainguard_predictions.db")


def init_prediction_db():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS prediction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city TEXT,
        lat REAL,
        lon REAL,
        prediction_time TEXT,
        rain_score REAL,
        forecast24 REAL,
        forecast72 REAL,
        flood_score REAL,
        source TEXT,
        verified INTEGER DEFAULT 0,
        actual_rain REAL DEFAULT NULL,
        result TEXT DEFAULT 'pending'
    )
""")

    conn.commit()
    
    cur.execute("SELECT COUNT(*) FROM prediction_history WHERE verified = 1")
    verified_after = cur.fetchone()[0]
    
    conn.close()
    

def save_prediction_history(city, lat, lon, rain_score, forecast24, forecast72, flood_score, source):
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("Supabase env missing:", bool(SUPABASE_URL), bool(SUPABASE_KEY))
            return False

        data = {
            "city": city,
            "lat": lat,
            "lon": lon,
            "prediction_time": datetime.utcnow().isoformat(),
            "rain_score": rain_score,
            "forecast24": forecast24,
            "forecast72": forecast72,
            "flood_score": flood_score,
            "source": source,
            "verified": 0,
            "result": "pending"
        }

        response = supabase.table("prediction_history").insert(data).execute()
        print("Supabase save success:", response)
        return True

    except Exception as e:
        print("Supabase prediction history save error:", repr(e))
        return False
        
def store_prediction_from_result(result, name, lat, lon):
    try:
        best = result.get("best_hour") or {}
        current = result.get("current") or {}
        next_hours = result.get("next_hours") or []

        rain_score = float(best.get("rain_score") or current.get("rain_score") or 0)

        forecast24 = max(
            [float(h.get("rain_score") or 0) for h in next_hours[:24]],
            default=0
        )

        forecast72 = max(
            [float(h.get("rain_score") or 0) for h in next_hours[:72]],
            default=0
        )

        flood_score = float(result.get("floodRiskScore") or 0)
        source = result.get("source", "Unknown")

        save_prediction_history(
            name,
            lat,
            lon,
            rain_score,
            forecast24,
            forecast72,
            flood_score,
            source
        )

    except Exception as e:
        print("Prediction history hook error:", e)


init_prediction_db()

def now_utc():
    return datetime.utcnow()


def safe_number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


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


def is_open_meteo_available():
    cooldown_until = SOURCE_STATE.get("open_meteo_cooldown_until")

    if not cooldown_until:
        return True

    return now_utc() >= cooldown_until


def put_open_meteo_on_cooldown(minutes=15):
    SOURCE_STATE["open_meteo_cooldown_until"] = now_utc() + timedelta(minutes=minutes)
    SOURCE_STATE["open_meteo_failures"] += 1


def reset_open_meteo_health():
    SOURCE_STATE["open_meteo_failures"] = 0
    SOURCE_STATE["open_meteo_cooldown_until"] = None


async def fetch_open_meteo(lat, lon, hours):
    if not is_open_meteo_available():
        return {
            "ok": False,
            "reason": "Open-Meteo cooldown active",
            "status_code": 429,
            "data": None
        }

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
            put_open_meteo_on_cooldown(15)
            return {
                "ok": False,
                "reason": "Open-Meteo 429 Too Many Requests",
                "status_code": 429,
                "data": None
            }

        if response.status_code != 200:
            SOURCE_STATE["open_meteo_failures"] += 1
            return {
                "ok": False,
                "reason": f"Open-Meteo status {response.status_code}",
                "status_code": response.status_code,
                "data": None
            }

        reset_open_meteo_health()

        return {
            "ok": True,
            "reason": "Open-Meteo success",
            "status_code": 200,
            "data": response.json()
        }

    except Exception as e:
        SOURCE_STATE["open_meteo_failures"] += 1
        return {
            "ok": False,
            "reason": str(e),
            "status_code": 0,
            "data": None
        }


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
            SOURCE_STATE["openweather_failures"] += 1
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

        SOURCE_STATE["openweather_failures"] = 0

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
            "confirmation_score": min(round(confirmation_score), 100)
        }

    except Exception as e:
        SOURCE_STATE["openweather_failures"] += 1
        return {
            "available": False,
            "reason": str(e)
        }


def verify_with_openweather(open_meteo_score, openweather_data):
    open_meteo_score = safe_number(open_meteo_score)

    if not openweather_data or not openweather_data.get("available"):
        return {
            "verified": False,
            "confidence": "تعذر التحقق من OpenWeatherMap",
            "confidence_score": open_meteo_score,
            "note": openweather_data.get("reason", "OpenWeatherMap غير متاح") if openweather_data else "OpenWeatherMap غير متاح"
        }

    ow_score = safe_number(openweather_data.get("confirmation_score"))
    rain_detected = openweather_data.get("rain_detected", False)

    combined = round((open_meteo_score * 0.60) + (ow_score * 0.40))

    if open_meteo_score >= 60 and rain_detected:
        return {
            "verified": True,
            "confidence": "ثقة عالية - تم التأكيد من مصدرين",
            "confidence_score": min(100, combined + 10),
            "note": "إشارة المطر مؤكدة من OpenWeatherMap"
        }

    if open_meteo_score >= 40 and ow_score >= 40:
        return {
            "verified": True,
            "confidence": "ثقة متوسطة - المصدر الثاني يدعم الاحتمال",
            "confidence_score": combined,
            "note": "الظروف الجوية تدعم احتمال المطر"
        }

    if open_meteo_score < 40 and ow_score < 40:
        return {
            "verified": True,
            "confidence": "ثقة منخفضة متوافقة - كلا المصدرين يشيران إلى خطر منخفض",
            "confidence_score": combined,
            "note": "Open-Meteo و OpenWeatherMap متوافقان على انخفاض فرصة المطر"
        }

    if open_meteo_score >= 40 and ow_score < 30:
        return {
            "verified": False,
            "confidence": "تباين بين المصادر - يحتاج متابعة",
            "confidence_score": combined,
            "note": "Open-Meteo أعلى من OpenWeatherMap"
        }

    if open_meteo_score < 40 and ow_score >= 40:
        return {
            "verified": True,
            "confidence": "OpenWeatherMap يرصد مؤشرات أعلى من Open-Meteo",
            "confidence_score": max(open_meteo_score, ow_score),
            "note": "يوجد اختلاف بين المصدرين، يفضل متابعة الحالة"
        }

    return {
        "verified": False,
        "confidence": "ثقة محدودة",
        "confidence_score": combined,
        "note": "لا يوجد توافق قوي بين المصادر"
    }


def build_current_from_openweather(openweather_data):
    score = safe_number(openweather_data.get("confirmation_score"))
    alert = classify(score)

    return {
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

        rows.append({
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
        })

    return rows


def build_hybrid_daily_forecast(openweather_data):
    base = build_current_from_openweather(openweather_data)

    base_score = safe_number(base["rain_score"])
    base_temp = safe_number(base["temperature"])
    base_wind = safe_number(base["wind_speed"])
    base_rain = safe_number(base["precipitation_mm"])

    days = []

    for i in range(7):
        daily_score = max(base_score - (i * 6), 0)
        alert = classify(daily_score)

        precipitation_sum = base_rain

        if daily_score >= 80:
            precipitation_sum = max(base_rain, 8)
        elif daily_score >= 60:
            precipitation_sum = max(base_rain, 4)
        elif daily_score >= 40:
            precipitation_sum = max(base_rain, 1.5)

        days.append({
            "date": (now_utc() + timedelta(days=i)).date().isoformat(),
            "temperature_max": round(base_temp + 3 + i * 0.2, 1),
            "temperature_min": round(base_temp - 4, 1),
            "rain_probability_max": daily_score,
            "precipitation_sum": round(precipitation_sum, 1),
            "rain_sum": round(precipitation_sum, 1),
            "wind_speed_max": base_wind,
            "daily_rain_score": daily_score,
            "alert_level": alert["level"],
            "advice": alert["advice"]
        })

    return days


def build_hybrid_recovery_result(lat, lon, name, openweather_data, reason, hours):
    next_hours = build_hybrid_next_hours(openweather_data, hours)
    daily_forecast = build_hybrid_daily_forecast(openweather_data)
    best_hour = max(next_hours, key=lambda x: x["rain_score"])

    return {
        "error": False,
        "location_name": name,
        "latitude": lat,
        "longitude": lon,
        "generated_at": now_utc().isoformat() + "Z",
        "cache_status": "fresh",
        "source": "Hybrid Forecast Recovery AI",
        "recovery_reason": reason,
        "current": next_hours[0],
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
        "load_balancer": get_load_balancer_status(),
        "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر ولا يغني عن التنبيهات الرسمية."
    }


async def build_open_meteo_result(lat, lon, name, weather, hours):
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

    # ✅ التعديل المهم: OpenWeatherMap يعمل دائمًا
    openweather_data = await fetch_openweather(lat, lon)

    verification = verify_with_openweather(
        best_hour["rain_score"],
        openweather_data
    )

    d = weather.get("daily", {})
    daily_forecast = []

    for i in range(len(d.get("time", []))):
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

    return {
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
        "load_balancer": get_load_balancer_status(),
        "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر ولا يغني عن التنبيهات الرسمية."
    }


def get_load_balancer_status():
    cooldown_until = SOURCE_STATE.get("open_meteo_cooldown_until")

    cooldown_active = False
    cooldown_seconds = 0

    if cooldown_until:
        cooldown_seconds = max(0, int((cooldown_until - now_utc()).total_seconds()))
        cooldown_active = cooldown_seconds > 0

    return {
        "open_meteo_available": is_open_meteo_available(),
        "open_meteo_cooldown_active": cooldown_active,
        "open_meteo_cooldown_seconds": cooldown_seconds,
        "open_meteo_failures": SOURCE_STATE.get("open_meteo_failures", 0),
        "openweather_enabled": bool(OPENWEATHER_API_KEY),
        "openweather_failures": SOURCE_STATE.get("openweather_failures", 0),
        "strategy": "Open-Meteo primary, OpenWeatherMap always verification, recovery after 429"
    }


@app.get("/prediction-history")
def prediction_history(limit: int = Query(20)):

    try:
        response = (
            supabase
            .table("prediction_history")
            .select("*")
            .order("id", desc=True)
            .limit(limit)
            .execute()
        )

        records = response.data or []

        return {
            "count": len(records),
            "records": records
        }

    except Exception as e:
        return {
            "count": 0,
            "records": [],
            "error": str(e)
        }
@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "version": "6.3",
        "cache_minutes": CACHE_MINUTES,
        "smart_api_load_balancer": True,
        "hybrid_recovery": True,
        "openweather_always_verify": True,
        "load_balancer": get_load_balancer_status(),
        "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RainGuard AI",
        "version": "6.3",
        "openweather_always_verify": True,
        "load_balancer": get_load_balancer_status()
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

    open_meteo_result = await fetch_open_meteo(lat, lon, hours)

    if open_meteo_result["ok"]:
        try:
            result = await build_open_meteo_result(
                lat,
                lon,
                name,
                open_meteo_result["data"],
                hours
            )

            store_prediction_from_result(result, name, lat, lon)
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

                store_prediction_from_result(result, name, lat, lon)
                save_cache(key, result)

                return JSONResponse(
                    content=result,
                    media_type="application/json; charset=utf-8"
                )

            return JSONResponse(
                status_code=200,
                content={
                    "error": True,
                    "message": "تعذر معالجة بيانات Open-Meteo ولا يوجد مصدر احتياطي متاح",
                    "parse_error": str(e),
                    "load_balancer": get_load_balancer_status()
                },
                media_type="application/json; charset=utf-8"
            )

    openweather_data = await fetch_openweather(lat, lon)

    if openweather_data.get("available"):
        result = build_hybrid_recovery_result(
            lat,
            lon,
            name,
            openweather_data,
            open_meteo_result["reason"],
            hours
        )

        store_prediction_from_result(result, name, lat, lon)
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
            "message": "تعذر جلب بيانات الطقس من كل المصادر المتاحة",
            "open_meteo_error": open_meteo_result["reason"],
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
            },
            "load_balancer": get_load_balancer_status()
        },
        media_type="application/json; charset=utf-8"
    )


@app.post("/verify-prediction")
def verify_prediction(
    prediction_id: int,
    actual_rain: float
):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
        SELECT rain_score
        FROM prediction_history
        WHERE id = ?
    """, (prediction_id,))

    row = cur.fetchone()

    if not row:
        conn.close()
        return {"status": "not_found", "prediction_id": prediction_id}

    predicted_score = float(row[0] or 0)
    actual_rain = float(actual_rain or 0)

    # تقييم أدق:
    # إذا التوقع 30% أو أعلى وحدث مطر فعلي = نجاح
    # إذا التوقع أقل من 30% ولم يحدث مطر = نجاح
    # غير ذلك = فشل
    if predicted_score >= 30 and actual_rain > 0:
        result = "success"
    elif predicted_score < 30 and actual_rain == 0:
        result = "success"
    else:
        result = "failed"

    cur.execute("""
        UPDATE prediction_history
        SET verified = 1,
            actual_rain = ?,
            result = ?
        WHERE id = ?
    """, (actual_rain, result, prediction_id))

    conn.commit()

    cur.execute("""
        SELECT id, verified, actual_rain, result
        FROM prediction_history
        WHERE id = ?
    """, (prediction_id,))

    updated = cur.fetchone()
    conn.close()

    return {
        "status": "verified",
        "prediction_id": prediction_id,
        "predicted_score": predicted_score,
        "actual_rain": actual_rain,
        "threshold_used": 30,
        "result": result,
        "saved_check": {
            "id": updated[0],
            "verified": updated[1],
            "actual_rain": updated[2],
            "result": updated[3]
        }
    }
@app.get("/verify-prediction")
def verify_prediction_get(prediction_id: int, actual_rain: float):
    return verify_prediction(prediction_id, actual_rain)
    
@app.post("/auto-verify-predictions")
def auto_verify_predictions():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, city, rain_score
        FROM prediction_history
        WHERE verified = 0
    """)

    rows = cur.fetchall()
    updated_count = 0

    for row in rows:
        prediction_id = row[0]
        predicted_score = float(row[2] or 0)

        actual_rain = 0.0

        if predicted_score >= 30 and actual_rain > 0:
            result = "success"
        elif predicted_score < 30 and actual_rain == 0:
            result = "success"
        else:
            result = "failed"

        cur.execute("""
            UPDATE prediction_history
            SET verified = 1,
                actual_rain = ?,
                result = ?
            WHERE id = ?
        """, (actual_rain, result, prediction_id))

        updated_count += 1

    conn.commit()
    conn.close()

    return {
        "status": "auto_verified",
        "threshold_used": 30,
        "updated_count": updated_count
    }


@app.get("/prediction-analytics")
def prediction_analytics():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_count,
            SUM(CASE WHEN verified = 1 AND result = 'success' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN verified = 1 AND result = 'failed' THEN 1 ELSE 0 END) as failed_count,
            AVG(CASE WHEN verified = 1 THEN rain_score END) as avg_rain_score,
            AVG(CASE WHEN verified = 1 THEN actual_rain END) as avg_actual_rain
        FROM prediction_history
    """)

    row = cur.fetchone()

    total_predictions = row[0] or 0
    verified_predictions = row[1] or 0
    successful_predictions = row[2] or 0
    failed_predictions = row[3] or 0
    avg_rain_score = row[4]
    avg_actual_rain = row[5]

    accuracy_percent = (
        round(successful_predictions * 100 / verified_predictions, 2)
        if verified_predictions > 0 else 0
    )

    cur.execute("""
        SELECT
            city,
            COUNT(*) as total,
            SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_count,
            SUM(CASE WHEN verified = 1 AND result = 'success' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN verified = 1 AND result = 'failed' THEN 1 ELSE 0 END) as failed_count
        FROM prediction_history
        GROUP BY city
        ORDER BY total DESC
    """)

    city_rows = cur.fetchall()
    conn.close()

    city_accuracy = []
    for city, total, verified_count, success_count, failed_count in city_rows:
        verified_count = verified_count or 0
        success_count = success_count or 0
        failed_count = failed_count or 0

        city_accuracy.append({
            "city": city,
            "total_predictions": total or 0,
            "verified_predictions": verified_count,
            "successful_predictions": success_count,
            "failed_predictions": failed_count,
            "accuracy_percent": round(success_count * 100 / verified_count, 2) if verified_count > 0 else 0
        })

    return {
        "db_name": DB_NAME,
        "total_predictions": total_predictions,
        "verified_predictions": verified_predictions,
        "successful_predictions": successful_predictions,
        "failed_predictions": failed_predictions,
        "accuracy_percent": accuracy_percent,
        "average_rain_score": round(avg_rain_score, 2) if avg_rain_score is not None else 0,
        "average_actual_rain": round(avg_actual_rain, 2) if avg_actual_rain is not None else 0,
        "city_accuracy": city_accuracy
    }


@app.get("/prediction-debug")
def prediction_debug():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, city, rain_score, verified, actual_rain, result
        FROM prediction_history
        ORDER BY id DESC
        LIMIT 10
    """)

    rows = cur.fetchall()
    conn.close()

    return {
        "db_path": DB_NAME,
        "records": [
            {
                "id": r[0],
                "city": r[1],
                "rain_score": r[2],
                "verified": r[3],
                "actual_rain": r[4],
                "result": r[5]
            }
            for r in rows
        ]
    }
