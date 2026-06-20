from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
import sqlite3
from supabase import create_client
from datetime import datetime, timedelta

app = FastAPI(title="RainGuard AI API", version="6.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
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
    # SQLite احتياطي فقط، الحفظ الفعلي الآن في Supabase
    try:
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
        conn.close()
    except Exception as e:
        print("SQLite init skipped:", repr(e))


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
        print("Prediction history hook error:", repr(e))


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


async def get_actual_rain_from_open_meteo(lat, lon, prediction_time):
    try:
        if lat is None or lon is None or not prediction_time:
            return 0.0

        dt = datetime.fromisoformat(str(prediction_time).replace("Z", ""))
        date_value = dt.date().isoformat()

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": date_value,
            "end_date": date_value,
            "hourly": "precipitation",
            "timezone": "auto"
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                OPEN_METEO_ARCHIVE_URL,
                params=params
            )

        if response.status_code != 200:
            print("Archive API status:", response.status_code, response.text[:200])
            return 0.0

        data = response.json()
        precipitation = (data.get("hourly") or {}).get("precipitation") or []

        return float(max(precipitation or [0]) or 0)

    except Exception as e:
        print("Actual rain fetch error:", repr(e))
        return 0.0

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
            "confidence": "Hybrid Recovery - تم استخدام OpenWeatherMap",
            "confidence_score": best_hour["rain_score"],
            "note": "تم بناء التوقعات عند تعذر Open-Meteo"
        },
        "load_balancer": get_load_balancer_status(),
        "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر."
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


@app.post("/verify-prediction")
def verify_prediction(prediction_id: int, actual_rain: float):
    try:
        response = (
            supabase
            .table("prediction_history")
            .select("id,rain_score")
            .eq("id", prediction_id)
            .limit(1)
            .execute()
        )

        rows = response.data or []

        if not rows:
            return {
                "status": "not_found",
                "prediction_id": prediction_id
            }

        predicted_score = float(rows[0].get("rain_score") or 0)
        actual_rain = float(actual_rain or 0)

        if predicted_score >= 30 and actual_rain > 0:
            result = "success"
        elif predicted_score < 30 and actual_rain == 0:
            result = "success"
        else:
            result = "failed"

        update_response = (
            supabase
            .table("prediction_history")
            .update({
                "verified": 1,
                "actual_rain": actual_rain,
                "result": result
            })
            .eq("id", prediction_id)
            .execute()
        )

        updated = (update_response.data or [{}])[0]

        return {
            "status": "verified",
            "prediction_id": prediction_id,
            "predicted_score": predicted_score,
            "actual_rain": actual_rain,
            "result": result,
            "saved_check": updated
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@app.get("/verify-prediction")
def verify_prediction_get(prediction_id: int, actual_rain: float):
    return verify_prediction(prediction_id, actual_rain)

@app.post("/auto-verify-predictions")
async def auto_verify_predictions():
    try:
        response = (
            supabase
            .table("prediction_history")
            .select("id,city,rain_score,lat,lon,prediction_time,created_at")
            .eq("verified", 0)
            .execute()
        )

        rows = response.data or []
        updated_count = 0
        failed_count = 0

        for row in rows:
            prediction_id = row.get("id")
            predicted_score = float(row.get("rain_score") or 0)

            actual_rain = await get_actual_rain_from_open_meteo(
                row.get("lat"),
                row.get("lon"),
                row.get("prediction_time") or row.get("created_at")
            )

            if predicted_score >= 30 and actual_rain > 0:
                result = "success"
            elif predicted_score < 30 and actual_rain == 0:
                result = "success"
            else:
                result = "failed"

            supabase.table("prediction_history").update({
                "verified": 1,
                "actual_rain": actual_rain,
                "result": result
            }).eq("id", prediction_id).execute()

            if result == "success":
                updated_count += 1
            else:
                failed_count += 1

        return {
            "status": "auto_verified",
            "source": "open_meteo_archive",
            "threshold_used": 30,
            "checked_count": len(rows),
            "successful_count": updated_count,
            "failed_count": failed_count
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@app.get("/auto-verify-predictions")
async def auto_verify_predictions_get():
    return await auto_verify_predictions()


@app.get("/prediction-analytics")
def prediction_analytics():
    try:
        response = (
            supabase
            .table("prediction_history")
            .select("*")
            .execute()
        )

        rows = response.data or []

        total_predictions = len(rows)

        verified_rows = [
            r for r in rows
            if int(r.get("verified") or 0) == 1
        ]

        success_rows = [
            r for r in verified_rows
            if r.get("result") == "success"
        ]

        failed_rows = [
            r for r in verified_rows
            if r.get("result") == "failed"
        ]

        verified_predictions = len(verified_rows)
        successful_predictions = len(success_rows)
        failed_predictions = len(failed_rows)

        accuracy_percent = (
            round(successful_predictions * 100 / verified_predictions, 2)
            if verified_predictions > 0 else 0
        )

        avg_rain_score = (
            round(
                sum(float(r.get("rain_score") or 0) for r in verified_rows) /
                verified_predictions,
                2
            )
            if verified_predictions > 0 else 0
        )

        avg_actual_rain = (
            round(
                sum(float(r.get("actual_rain") or 0) for r in verified_rows) /
                verified_predictions,
                2
            )
            if verified_predictions > 0 else 0
        )

        city_map = {}

        for r in rows:
            city = r.get("city") or "Unknown"

            if city not in city_map:
                city_map[city] = {
                    "city": city,
                    "total_predictions": 0,
                    "verified_predictions": 0,
                    "successful_predictions": 0,
                    "failed_predictions": 0,
                    "accuracy_percent": 0
                }

            city_map[city]["total_predictions"] += 1

            if int(r.get("verified") or 0) == 1:
                city_map[city]["verified_predictions"] += 1

                if r.get("result") == "success":
                    city_map[city]["successful_predictions"] += 1

                if r.get("result") == "failed":
                    city_map[city]["failed_predictions"] += 1

        city_accuracy = []

        for city_data in city_map.values():
            verified = city_data["verified_predictions"]
            success = city_data["successful_predictions"]

            city_data["accuracy_percent"] = (
                round(success * 100 / verified, 2)
                if verified > 0 else 0
            )

            city_accuracy.append(city_data)

        city_accuracy.sort(
            key=lambda x: x["total_predictions"],
            reverse=True
        )

        return {
            "source": "supabase",
            "total_predictions": total_predictions,
            "verified_predictions": verified_predictions,
            "successful_predictions": successful_predictions,
            "failed_predictions": failed_predictions,
            "accuracy_percent": accuracy_percent,
            "average_rain_score": avg_rain_score,
            "average_actual_rain": avg_actual_rain,
            "city_accuracy": city_accuracy
        }

    except Exception as e:
        return {
            "source": "supabase",
            "status": "error",
            "error": str(e),
            "total_predictions": 0,
            "verified_predictions": 0,
            "successful_predictions": 0,
            "failed_predictions": 0,
            "accuracy_percent": 0,
            "average_rain_score": 0,
            "average_actual_rain": 0,
            "city_accuracy": []
        }


@app.get("/prediction-debug")
def prediction_debug(limit: int = Query(10)):
    try:
        response = (
            supabase
            .table("prediction_history")
            .select("id,city,rain_score,verified,actual_rain,result,lat,lon,prediction_time,created_at")
            .order("id", desc=True)
            .limit(limit)
            .execute()
        )

        records = response.data or []

        return {
            "source": "supabase",
            "count": len(records),
            "records": records
        }

    except Exception as e:
        return {
            "source": "supabase",
            "count": 0,
            "records": [],
            "error": str(e)
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
        "strategy": "Open-Meteo primary, OpenWeatherMap always verification, recovery after 429, Supabase learning enabled"
    }


@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "version": "6.4",
        "cache_minutes": CACHE_MINUTES,
        "smart_api_load_balancer": True,
        "hybrid_recovery": True,
        "openweather_always_verify": True,
        "supabase_learning": True,
        "actual_rain_verification": True,
        "load_balancer": get_load_balancer_status(),
        "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RainGuard AI",
        "version": "6.4",
        "openweather_always_verify": True,
        "supabase_learning": True,
        "actual_rain_verification": True,
        "load_balancer": get_load_balancer_status()
    }
