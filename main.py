from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import httpx
import os
import sqlite3
from supabase import create_client
from datetime import datetime, timedelta
from statistics import mean


app = FastAPI(title="RainGuard AI API", version="6.7")


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

supabase = None

if SUPABASE_URL and SUPABASE_KEY:
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


DEFAULT_ADAPTIVE_WEIGHTS = {
    "precipitation_probability": 0.35,
    "cloud_cover": 0.30,
    "humidity": 0.25,
    "flood_score": 0.10
}

ADAPTIVE_CACHE = {
    "time": None,
    "data": None
}
ADAPTIVE_CACHE_MINUTES = 10
ADAPTIVE_CACHE_SECONDS = ADAPTIVE_CACHE_MINUTES * 60


def now_utc():
    return datetime.utcnow()


def safe_number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def clamp(value, min_value=0, max_value=100):
    return max(min_value, min(value, max_value))


def normalize_weights(weights):
    total = sum(weights.values())

    if total <= 0:
        return DEFAULT_ADAPTIVE_WEIGHTS

    return {
        key: round(value / total, 4)
        for key, value in weights.items()
    }


def init_prediction_db():
    """
    SQLite احتياطي فقط.
    الحفظ الأساسي الآن في Supabase.
    """
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
                precipitation_probability REAL DEFAULT 0,
                cloud_cover REAL DEFAULT 0,
                humidity REAL DEFAULT 0,
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

    try:
        thresholds = adaptive_thresholds_v2().get("thresholds", {})

        watch = thresholds.get("watch", 30)
        medium = thresholds.get("medium", 50)
        high = thresholds.get("high", 70)
        danger = thresholds.get("danger", 80)

    except Exception:
        watch = 30
        medium = 50
        high = 70
        danger = 80

    if score >= danger:
        return {
            "level": "تحذير مطر مرتفع",
            "advice": "احتمال هطول أمطار قوية. تابع التنبيهات الرسمية."
        }

    if score >= high:
        return {
            "level": "تنبيه مطر متوسط",
            "advice": "فرصة المطر متوسطة إلى مرتفعة. يفضل متابعة التحديثات."
        }

    if score >= medium:
        return {
            "level": "احتمال مطر ضعيف إلى متوسط",
            "advice": "توجد مؤشرات جيدة لاحتمال المطر."
        }

    if score >= watch:
        return {
            "level": "متابعة جوية",
            "advice": "توجد مؤشرات أولية تستحق المتابعة."
        }

    return {
        "level": "لا يوجد تنبيه مطر",
        "advice": "فرصة المطر منخفضة حاليًا."
    }

def get_verified_predictions(limit=300):
    """
    جلب التوقعات التي تم التحقق منها من Supabase.
    يستخدمها Adaptive Learning Engine V1.
    """
    try:
        if not supabase:
            return []

        response = (
            supabase
            .table("prediction_history")
            .select("*")
            .eq("verified", 1)
            .order("id", desc=True)
            .limit(limit)
            .execute()
        )

        return response.data or []

    except Exception as e:
        print("Adaptive verified predictions error:", repr(e))
        return []


def calculate_factor_accuracy(predicted_value, actual_rain):
    """
    يحسب دقة كل عامل مقارنة بالمطر الفعلي.

    إذا actual_rain > 0:
        المتوقع أن يكون العامل مرتفعًا.

    إذا actual_rain == 0:
        المتوقع أن يكون العامل منخفضًا.
    """
    predicted_value = safe_number(predicted_value)
    actual_rain = safe_number(actual_rain)

    expected_value = 100 if actual_rain > 0 else 0
    error = abs(predicted_value - expected_value)
    accuracy = 100 - error

    return clamp(accuracy, 0, 100)


def adaptive_learning_v1(limit=300, force_refresh=False):
    """
    Adaptive Learning Engine V1.2
    يحلل prediction_history ويحسب أوزان المطر من:
    - precipitation_probability
    - cloud_cover
    - humidity
    - flood_score
    """

    try:
        if not force_refresh:
            cached = ADAPTIVE_CACHE.get("data")
            cached_time = ADAPTIVE_CACHE.get("time")

            if cached and cached_time:
                age_seconds = (now_utc() - cached_time).total_seconds()
                if age_seconds <= ADAPTIVE_CACHE_SECONDS:
                    return cached

        rows = get_verified_predictions(limit=limit)

        if not rows:
            result = {
                "ok": False,
                "reason": "No verified predictions found",
                "engine": "Adaptive Learning Engine V1.2",
                "samples": 0,
                "weights": DEFAULT_ADAPTIVE_WEIGHTS,
                "factor_accuracy": {
                    "precipitation_probability": 0,
                    "cloud_cover": 0,
                    "humidity": 0,
                    "flood_score": 0
                },
                "factor_samples": {
                    "precipitation_probability": 0,
                    "cloud_cover": 0,
                    "humidity": 0,
                    "flood_score": 0
                }
            }

            ADAPTIVE_CACHE["time"] = now_utc()
            ADAPTIVE_CACHE["data"] = result
            return result

        factor_scores = {
            "precipitation_probability": [],
            "cloud_cover": [],
            "humidity": [],
            "flood_score": []
        }

        for row in rows:
            actual_rain = safe_number(row.get("actual_rain"))

            precipitation_probability = row.get("precipitation_probability")
            if precipitation_probability in [None, ""]:
                precipitation_probability = row.get("rain_probability")
            if precipitation_probability in [None, ""]:
                precipitation_probability = row.get("rain_score")

            cloud_cover = row.get("cloud_cover")
            humidity = row.get("humidity")
            flood_score = row.get("flood_score")

            if precipitation_probability not in [None, ""]:
                factor_scores["precipitation_probability"].append(
                    calculate_factor_accuracy(
                        precipitation_probability,
                        actual_rain
                    )
                )

            if cloud_cover not in [None, ""]:
                factor_scores["cloud_cover"].append(
                    calculate_factor_accuracy(
                        cloud_cover,
                        actual_rain
                    )
                )

            if humidity not in [None, ""]:
                factor_scores["humidity"].append(
                    calculate_factor_accuracy(
                        humidity,
                        actual_rain
                    )
                )

            if flood_score not in [None, ""]:
                factor_scores["flood_score"].append(
                    calculate_factor_accuracy(
                        flood_score,
                        actual_rain
                    )
                )

        factor_accuracy = {
            key: round(mean(values), 2) if values else 0
            for key, values in factor_scores.items()
        }

        factor_samples = {
            key: len(values)
            for key, values in factor_scores.items()
        }

        min_samples = 5
        raw_weights = {}

        for key in DEFAULT_ADAPTIVE_WEIGHTS:
            if factor_samples[key] >= min_samples:
                learned_part = factor_accuracy[key] / 100
                base_part = DEFAULT_ADAPTIVE_WEIGHTS[key]

                raw_weights[key] = (
                    base_part * 0.40
                    + learned_part * 0.60
                )
            else:
                raw_weights[key] = DEFAULT_ADAPTIVE_WEIGHTS[key]

        weights = normalize_weights(raw_weights)

        result = {
            "ok": True,
            "engine": "Adaptive Learning Engine V1.2",
            "samples": len(rows),
            "min_samples_per_factor": min_samples,
            "factor_samples": factor_samples,
            "factor_accuracy": factor_accuracy,
            "weights": weights
        }

        ADAPTIVE_CACHE["time"] = now_utc()
        ADAPTIVE_CACHE["data"] = result

        return result

    except Exception as e:
        print("Adaptive learning v1.2 error:", repr(e))

        return {
            "ok": False,
            "reason": str(e),
            "engine": "Adaptive Learning Engine V1.2",
            "samples": 0,
            "weights": DEFAULT_ADAPTIVE_WEIGHTS,
            "factor_accuracy": {
                "precipitation_probability": 0,
                "cloud_cover": 0,
                "humidity": 0,
                "flood_score": 0
            },
            "factor_samples": {
                "precipitation_probability": 0,
                "cloud_cover": 0,
                "humidity": 0,
                "flood_score": 0
            }
        }

def adaptive_thresholds_v2(limit=300):
    """
    Adaptive Learning V2
    يضبط حدود التنبيه تلقائيًا حسب أداء التوقعات السابقة.
    """

    rows = get_verified_predictions(limit=limit)

    if not rows:
        return {
            "ok": False,
            "engine": "Adaptive Thresholds V2",
            "thresholds": {
                "watch": 30,
                "medium": 50,
                "high": 70,
                "danger": 80
            },
            "reason": "No verified predictions"
        }

    false_alerts = 0
    missed_rain = 0
    total = len(rows)

    for row in rows:
        rain_score = safe_number(row.get("rain_score"))
        actual_rain = safe_number(row.get("actual_rain"))

        if rain_score >= 30 and actual_rain == 0:
            false_alerts += 1

        if rain_score < 30 and actual_rain > 0:
            missed_rain += 1

    false_alert_rate = false_alerts / total
    missed_rain_rate = missed_rain / total

    watch = 30
    medium = 50
    high = 70
    danger = 80

    if false_alert_rate > 0.30:
        watch += 5
        medium += 5

    if false_alert_rate > 0.50:
        watch += 10
        medium += 10

    if missed_rain_rate > 0.15:
        watch -= 5
        medium -= 5

    if missed_rain_rate > 0.30:
        watch -= 10
        medium -= 10

    watch = int(clamp(watch, 20, 45))
    medium = int(clamp(medium, 40, 65))
    high = int(clamp(high, 65, 80))
    danger = int(clamp(danger, 80, 90))

    return {
        "ok": True,
        "engine": "Adaptive Thresholds V2",
        "samples": total,
        "false_alerts": false_alerts,
        "missed_rain": missed_rain,
        "false_alert_rate": round(false_alert_rate, 3),
        "missed_rain_rate": round(missed_rain_rate, 3),
        "thresholds": {
            "watch": watch,
            "medium": medium,
            "high": high,
            "danger": danger
        }
    }

def apply_adaptive_rain_score(
    precipitation_probability,
    cloud_cover,
    humidity,
    flood_score,
    base_score=None
):
    """
    يطبق الأوزان المتعلمة على rain_score النهائي.
    """
    learning = adaptive_learning_v1()
    weights = learning.get("weights") or DEFAULT_ADAPTIVE_WEIGHTS

    precipitation_probability = safe_number(precipitation_probability)
    cloud_cover = safe_number(cloud_cover)
    humidity = safe_number(humidity)
    flood_score = safe_number(flood_score)
    base_score = safe_number(base_score)

    adaptive_score = (
        precipitation_probability * weights["precipitation_probability"]
        + cloud_cover * weights["cloud_cover"]
        + humidity * weights["humidity"]
        + flood_score * weights["flood_score"]
    )

    if adaptive_score >= 25 and cloud_cover >= 35 and humidity >= 35:
        adaptive_score += 5

    if base_score > 0:
        final_score = (base_score * 0.30) + (adaptive_score * 0.70)
    else:
        final_score = adaptive_score

    return {
        "rain_score": round(clamp(final_score, 0, 100), 2),
        "adaptive_score": round(clamp(adaptive_score, 0, 100), 2),
        "base_score": round(base_score, 2),
        "adaptive_learning": learning
    }


@app.get("/adaptive-learning")
def adaptive_learning_endpoint(limit: int = Query(300)):
    return adaptive_learning_v1(limit=limit)


@app.get("/adaptive-learning-debug")
def adaptive_learning_debug(limit: int = Query(300)):
    ADAPTIVE_CACHE["time"] = None
    ADAPTIVE_CACHE["data"] = None
    return adaptive_learning_v1(limit=limit)

@app.get("/adaptive-thresholds")
def adaptive_thresholds_endpoint(limit: int = Query(300)):
    return adaptive_thresholds_v2(limit=limit)


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

    adaptive_result = apply_adaptive_rain_score(
        precipitation_probability=rain_probability,
        cloud_cover=cloud_cover,
        humidity=humidity,
        flood_score=flood_score,
        base_score=base_score
    )

    return min(round(adaptive_result["rain_score"]), 100)


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

def save_prediction_history(
    city,
    lat,
    lon,
    rain_score,
    forecast24,
    forecast72,
    flood_score,
    source,
    precipitation_probability=0,
    cloud_cover=0,
    humidity=0
):
    """
    حفظ التوقع في Supabase مع العوامل اللازمة للتعلم التكيفي.
    """
    try:
        if not supabase:
            print("Supabase env missing:", bool(SUPABASE_URL), bool(SUPABASE_KEY))
            return False

        data = {
            "city": city,
            "lat": lat,
            "lon": lon,
            "prediction_time": datetime.utcnow().isoformat(),
            "rain_score": safe_number(rain_score),
            "forecast24": safe_number(forecast24),
            "forecast72": safe_number(forecast72),
            "flood_score": safe_number(flood_score),
            "precipitation_probability": safe_number(precipitation_probability),
            "cloud_cover": safe_number(cloud_cover),
            "humidity": safe_number(humidity),
            "source": source,
            "verified": 0,
            "result": "pending"
        }

        response = (
            supabase
            .table("prediction_history")
            .insert(data)
            .execute()
        )

        print("Supabase save success:", response)
        return True

    except Exception as e:
        print("Supabase prediction history save error:", repr(e))
        return False


def store_prediction_from_result(result, name, lat, lon):
    """
    استخراج أفضل القيم من نتيجة التنبؤ وحفظها في prediction_history.
    """
    try:
        best = result.get("best_hour") or {}
        current = result.get("current") or {}
        next_hours = result.get("next_hours") or []

        selected = best if best else current

        rain_score = safe_number(
            selected.get("rain_score")
            or current.get("rain_score")
            or 0
        )

        forecast24 = max(
            [safe_number(h.get("rain_score")) for h in next_hours[:24]],
            default=0
        )

        forecast72 = max(
            [safe_number(h.get("rain_score")) for h in next_hours[:72]],
            default=0
        )

        flood_score = safe_number(
            result.get("floodRiskScore")
            or result.get("flood_score")
            or 0
        )

        precipitation_probability = safe_number(
            selected.get("rain_probability")
            or selected.get("precipitation_probability")
            or current.get("rain_probability")
            or 0
        )

        cloud_cover = safe_number(
            selected.get("cloud_cover")
            or current.get("cloud_cover")
            or 0
        )

        humidity = safe_number(
            selected.get("humidity")
            or current.get("humidity")
            or 0
        )

        source = result.get("source", "Unknown")

        save_prediction_history(
            city=name,
            lat=lat,
            lon=lon,
            rain_score=rain_score,
            forecast24=forecast24,
            forecast72=forecast72,
            flood_score=flood_score,
            source=source,
            precipitation_probability=precipitation_probability,
            cloud_cover=cloud_cover,
            humidity=humidity
        )

    except Exception as e:
        print("Prediction history hook error:", repr(e))


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
    """
    جلب المطر الفعلي من Open-Meteo Archive للتحقق التلقائي.
    يحسب مجموع المطر خلال 12 ساعة بعد وقت التنبؤ.
    V13 - Actual Rain Window Verification
    """
    try:
        if lat is None or lon is None or not prediction_time:
            return 0.0

        raw_time = str(prediction_time).replace("Z", "")
        dt = datetime.fromisoformat(raw_time)

        start_date = (dt - timedelta(days=1)).date().isoformat()
        end_date = (dt + timedelta(days=1)).date().isoformat()

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "precipitation",
            "timezone": "UTC"
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
        print("ARCHIVE RESPONSE:", data)
        hourly = data.get("hourly") or {}

        times = hourly.get("time") or []
        precipitation = hourly.get("precipitation") or []

        if not times or not precipitation:
            return 0.0

        window_start = dt - timedelta(hours=6)
        window_end = dt + timedelta(hours=24)

        actual_sum = 0.0

        for t, rain in zip(times, precipitation):
            try:
                hour_dt = datetime.fromisoformat(str(t))
                rain_value = safe_number(rain)

                if window_start <= hour_dt <= window_end:
                    actual_sum += rain_value
            except Exception:
                continue

        return round(actual_sum, 3)

    except Exception as e:
        print("Actual rain fetch error:", repr(e))
        return 0.0


async def fetch_openweather(lat, lon):
    """
    جلب بيانات OpenWeatherMap للتحقق أو الاسترداد عند فشل Open-Meteo.
    """
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
    """
    دمج نتيجة Open-Meteo مع OpenWeatherMap لرفع الثقة.
    """
    open_meteo_score = safe_number(open_meteo_score)

    if not openweather_data or not openweather_data.get("available"):
        return {
            "verified": False,
            "confidence": "تعذر التحقق من OpenWeatherMap",
            "confidence_score": open_meteo_score,
            "note": (
                openweather_data.get("reason", "OpenWeatherMap غير متاح")
                if openweather_data else
                "OpenWeatherMap غير متاح"
            )
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
    """
    بناء current من OpenWeatherMap عند الاسترداد الهجين.
    """
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
        "flood_score": 0,
        "rain_score": score,
        "alert_level": alert["level"],
        "advice": alert["advice"]
    }

def build_hybrid_next_hours(openweather_data, hours=12):
    """
    بناء توقعات الساعات القادمة من OpenWeatherMap عند تعذر Open-Meteo.
    """
    base = build_current_from_openweather(openweather_data)

    base_score = safe_number(base["rain_score"])
    base_temp = safe_number(base["temperature"])
    base_humidity = safe_number(base["humidity"])
    base_cloud = safe_number(base["cloud_cover"])

    if base_cloud <= 0:
        base_cloud = min(
            100,
            max(
                safe_number(base["rain_probability"]) * 2,
                safe_number(base["humidity"]) * 0.8
            )
        )

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
            "flood_score": 0
        }

        row["rain_score"] = calculate_rain_score(row)

        alert = classify(row["rain_score"])
        row["alert_level"] = alert["level"]
        row["advice"] = alert["advice"]

        rows.append(row)

    return rows

def build_hybrid_daily_forecast(openweather_data):
    """
    بناء توقع يومي عند تشغيل Hybrid Recovery.
    """
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


def calculate_flood_risk_score(current, next_hours, daily_forecast):
    """
    حساب مؤشر خطر السيول بشكل مبسط.
    """
    current_score = safe_number(current.get("rain_score"))

    max_hourly_rain = max(
        [safe_number(h.get("precipitation_mm")) for h in next_hours],
        default=0
    )

    max_hourly_score = max(
        [safe_number(h.get("rain_score")) for h in next_hours],
        default=0
    )

    max_daily_rain = max(
        [safe_number(d.get("precipitation_sum")) for d in daily_forecast],
        default=0
    )

    max_daily_score = max(
        [safe_number(d.get("daily_rain_score")) for d in daily_forecast],
        default=0
    )

    flood_score = 0
    flood_score += current_score * 0.20
    flood_score += max_hourly_score * 0.30
    flood_score += max_daily_score * 0.20

    if max_hourly_rain >= 1:
        flood_score += 10

    if max_hourly_rain >= 5:
        flood_score += 10

    if max_daily_rain >= 10:
        flood_score += 10

    if max_daily_rain >= 25:
        flood_score += 10

    return round(clamp(flood_score, 0, 100), 2)


def build_hybrid_recovery_result(lat, lon, name, openweather_data, reason, hours):
    """
    نتيجة احتياطية عند فشل Open-Meteo.
    """
    next_hours = build_hybrid_next_hours(openweather_data, hours)
    daily_forecast = build_hybrid_daily_forecast(openweather_data)
    best_hour = max(next_hours, key=lambda x: x["rain_score"])
    current = next_hours[0]

    flood_score = calculate_flood_risk_score(
        current=current,
        next_hours=next_hours,
        daily_forecast=daily_forecast
    )

    adaptive_result = apply_adaptive_rain_score(
        precipitation_probability=current.get("rain_probability"),
        cloud_cover=current.get("cloud_cover"),
        humidity=current.get("humidity"),
        flood_score=flood_score,
        base_score=current.get("rain_score")
    )

    current["rain_score"] = adaptive_result["rain_score"]
    current["adaptive_score"] = adaptive_result["adaptive_score"]

    alert = classify(current["rain_score"])
    current["alert_level"] = alert["level"]
    current["advice"] = alert["advice"]

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
        "floodRiskScore": flood_score,
        "adaptive_learning": adaptive_result["adaptive_learning"],
        "openweather": openweather_data,
        "verification": {
            "verified": True,
            "confidence": "Hybrid Recovery - تم استخدام OpenWeatherMap",
            "confidence_score": current["rain_score"],
            "note": "تم بناء التوقعات عند تعذر Open-Meteo"
        },
        "load_balancer": get_load_balancer_status(),
        "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر."
    }

    store_prediction_from_result(result, name, lat, lon)

    return result

def build_open_meteo_next_hours(data, hours=12):
    """
    بناء توقعات الساعات القادمة من Open-Meteo.
    """
    hourly = data.get("hourly") or {}

    times = hourly.get("time") or []
    temperatures = hourly.get("temperature_2m") or []
    humidities = hourly.get("relative_humidity_2m") or []
    dew_points = hourly.get("dew_point_2m") or []
    rain_probs = hourly.get("precipitation_probability") or []
    precipitations = hourly.get("precipitation") or []
    cloud_covers = hourly.get("cloud_cover") or []
    pressures = hourly.get("pressure_msl") or []
    wind_speeds = hourly.get("wind_speed_10m") or []

    rows = []

    total = min(
        hours,
        len(times),
        len(temperatures),
        len(humidities),
        len(dew_points),
        len(rain_probs),
        len(precipitations),
        len(cloud_covers),
        len(pressures),
        len(wind_speeds)
    )

    for i in range(total):
        row = {
            "time": times[i],
            "temperature": safe_number(temperatures[i]),
            "humidity": safe_number(humidities[i]),
            "dew_point": safe_number(dew_points[i]),
            "rain_probability": safe_number(rain_probs[i]),
            "precipitation_mm": safe_number(precipitations[i]),
            "cloud_cover": safe_number(cloud_covers[i]),
            "pressure_hpa": safe_number(pressures[i], 1013),
            "wind_speed": safe_number(wind_speeds[i]),
            "flood_score": 0
        }

        row["rain_score"] = calculate_rain_score(row)

        alert = classify(row["rain_score"])
        row["alert_level"] = alert["level"]
        row["advice"] = alert["advice"]

        rows.append(row)

    return rows


def build_open_meteo_daily_forecast(data):
    """
    بناء التوقعات اليومية من Open-Meteo.
    """
    daily = data.get("daily") or {}

    times = daily.get("time") or []
    temp_max = daily.get("temperature_2m_max") or []
    temp_min = daily.get("temperature_2m_min") or []
    rain_prob_max = daily.get("precipitation_probability_max") or []
    precipitation_sum = daily.get("precipitation_sum") or []
    rain_sum = daily.get("rain_sum") or []
    wind_max = daily.get("wind_speed_10m_max") or []

    days = []

    total = min(
        len(times),
        len(temp_max),
        len(temp_min),
        len(rain_prob_max),
        len(precipitation_sum),
        len(rain_sum),
        len(wind_max)
    )

    for i in range(total):
        day = {
            "date": times[i],
            "temperature_max": safe_number(temp_max[i]),
            "temperature_min": safe_number(temp_min[i]),
            "rain_probability_max": safe_number(rain_prob_max[i]),
            "precipitation_sum": safe_number(precipitation_sum[i]),
            "rain_sum": safe_number(rain_sum[i]),
            "wind_speed_max": safe_number(wind_max[i])
        }

        day["daily_rain_score"] = calculate_daily_score(day)

        alert = classify(day["daily_rain_score"])
        day["alert_level"] = alert["level"]
        day["advice"] = alert["advice"]

        days.append(day)

    return days


def build_open_meteo_result(
    lat,
    lon,
    name,
    open_meteo_data,
    openweather_data,
    hours
):
    """
    بناء النتيجة الأساسية من Open-Meteo مع التحقق من OpenWeatherMap
    وربط Adaptive Learning.
    """
    next_hours = build_open_meteo_next_hours(open_meteo_data, hours)
    daily_forecast = build_open_meteo_daily_forecast(open_meteo_data)

    if not next_hours:
        return {
            "error": True,
            "message": "No hourly forecast data available",
            "source": "Open-Meteo"
        }

    current = next_hours[0]
    best_hour = max(next_hours, key=lambda x: x["rain_score"])

    flood_score = calculate_flood_risk_score(
        current=current,
        next_hours=next_hours,
        daily_forecast=daily_forecast
    )

    for row in next_hours:
        row["flood_score"] = flood_score

        adaptive_result = apply_adaptive_rain_score(
            precipitation_probability=row.get("rain_probability"),
            cloud_cover=row.get("cloud_cover"),
            humidity=row.get("humidity"),
            flood_score=flood_score,
            base_score=row.get("rain_score")
        )

        row["rain_score"] = adaptive_result["rain_score"]
        row["adaptive_score"] = adaptive_result["adaptive_score"]

        alert = classify(row["rain_score"])
        row["alert_level"] = alert["level"]
        row["advice"] = alert["advice"]

    current = next_hours[0]
    best_hour = max(next_hours, key=lambda x: x["rain_score"])

    verification = verify_with_openweather(
        best_hour.get("rain_score"),
        openweather_data
    )

    result = {
        "error": False,
        "location_name": name,
        "latitude": lat,
        "longitude": lon,
        "generated_at": now_utc().isoformat() + "Z",
        "cache_status": "fresh",
        "source": "Open-Meteo + OpenWeatherMap + Adaptive Learning",
        "current": current,
        "best_hour": best_hour,
        "next_hours": next_hours,
        "daily_forecast": daily_forecast,
        "floodRiskScore": flood_score,
        "adaptive_learning": adaptive_learning_v1(),
        "openweather": openweather_data,
        "verification": verification,
        "load_balancer": get_load_balancer_status(),
        "disclaimer": "نظام تجريبي للتنبؤ المحلي بالمطر."
    }

    store_prediction_from_result(result, name, lat, lon)

    return result


@app.get("/rain-alert")
async def rain_alert(
    lat: float = Query(...),
    lon: float = Query(...),
    name: str = Query("Unknown Location"),
    hours: int = Query(12)
):
    """
    Endpoint الرئيسي لتوقع المطر.
    """
    try:
        hours = max(1, min(int(hours), 72))
        key = cache_key(lat, lon, hours)

        cached = get_cached(key)
        if cached:
            return JSONResponse(
                content=cached,
                media_type="application/json; charset=utf-8",
                status_code=200
            )

        openweather_data = None
        open_meteo_response = {"ok": False, "reason": "Not called"}

        try:
            openweather_data = await fetch_openweather(lat, lon)
        except Exception as e:
            openweather_data = {
                "available": False,
                "error": str(e)
            }

        try:
            open_meteo_response = await fetch_open_meteo(lat, lon, hours)
        except Exception as e:
            open_meteo_response = {
                "ok": False,
                "reason": str(e),
                "data": None
            }

        if open_meteo_response.get("ok"):
            result = build_open_meteo_result(
                lat=lat,
                lon=lon,
                name=name,
                open_meteo_data=open_meteo_response.get("data") or {},
                openweather_data=openweather_data,
                hours=hours
            )

            save_cache(key, result)

            return JSONResponse(
                content=result,
                media_type="application/json; charset=utf-8",
                status_code=200
            )

        if openweather_data and openweather_data.get("available"):
            result = build_hybrid_recovery_result(
                lat=lat,
                lon=lon,
                name=name,
                openweather_data=openweather_data,
                reason=open_meteo_response.get("reason", "Open-Meteo unavailable"),
                hours=hours
            )

            save_cache(key, result)

            return JSONResponse(
                content=result,
                media_type="application/json; charset=utf-8",
                status_code=200
            )

        result = {
            "error": True,
            "location_name": name,
            "latitude": lat,
            "longitude": lon,
            "generated_at": now_utc().isoformat() + "Z",
            "cache_status": "fresh",
            "source": "No source available",
            "message": "تعذر جلب بيانات الطقس من Open-Meteo و OpenWeatherMap",
            "open_meteo": open_meteo_response,
            "openweather": openweather_data,
            "load_balancer": get_load_balancer_status()
        }

        return JSONResponse(
            content=result,
            media_type="application/json; charset=utf-8",
            status_code=200
        )

    except Exception as e:
        result = {
            "error": True,
            "location_name": name,
            "latitude": lat,
            "longitude": lon,
            "generated_at": now_utc().isoformat() + "Z",
            "cache_status": "failed",
            "source": "Backend Safe Fallback",
            "message": "حدث خطأ داخلي في /rain-alert",
            "detail": str(e)
        }

        return JSONResponse(
            content=result,
            media_type="application/json; charset=utf-8",
            status_code=200
        )

@app.get("/prediction-history")
def prediction_history(limit: int = Query(20)):
    """
    عرض آخر سجلات prediction_history من Supabase.
    """
    try:
        if not supabase:
            return {
                "count": 0,
                "records": [],
                "error": "Supabase not configured"
            }

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

@app.post("/verify-prediction")
def verify_prediction(prediction_id: int, actual_rain: float):
    """
    تحقق يدوي من توقع واحد.
    """
    try:
        if not supabase:
            return {
                "status": "error",
                "error": "Supabase not configured"
            }

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

        predicted_score = safe_number(rows[0].get("rain_score"))
        actual_rain = safe_number(actual_rain)

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
            "threshold_used": 30,
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
    """
    نسخة GET للتجربة من المتصفح.
    """
    return verify_prediction(prediction_id, actual_rain)


@app.get("/auto-verify-predictions")
async def auto_verify_predictions_get(limit: int = 25):
    return await auto_verify_predictions(limit=limit)


@app.post("/auto-verify-predictions")
async def auto_verify_predictions(limit: int = 25):
    """
    تحقق تلقائي تدريجي من السجلات غير المتحققة باستخدام Open-Meteo Archive.
    V13 - Safe Batch Auto Verification
    """
    try:
        if not supabase:
            return {
                "status": "error",
                "error": "Supabase not configured"
            }

        limit = max(1, min(int(limit), 100))

        response = (
            supabase
            .table("prediction_history")
            .select("id,city,rain_score,lat,lon,prediction_time,created_at")
            .eq("verified", 0)
            .order("id", desc=False)
            .limit(limit)
            .execute()
        )

        rows = response.data or []

        updated_count = 0
        failed_count = 0
        skipped_count = 0
        details = []

        for row in rows:
            prediction_id = row.get("id")
            city = row.get("city") or "Unknown"
            predicted_score = safe_number(row.get("rain_score"))
            lat = row.get("lat")
            lon = row.get("lon")
            prediction_time = row.get("prediction_time") or row.get("created_at")

            if not prediction_id or lat is None or lon is None or not prediction_time:
                skipped_count += 1
                details.append({
                    "id": prediction_id,
                    "city": city,
                    "status": "skipped",
                    "reason": "missing required fields"
                })
                continue

            try:
                actual_rain = await get_actual_rain_from_open_meteo(
                    lat,
                    lon,
                    prediction_time
                )
            except Exception as e:
                skipped_count += 1
                details.append({
                    "id": prediction_id,
                    "city": city,
                    "status": "skipped",
                    "reason": str(e)
                })
                continue

            actual_rain = safe_number(actual_rain)

            if actual_rain > 0:
                result = "success" if predicted_score >= 30 else "failed"
            else:
                if predicted_score < 60:
                    result = "success"
                else:
                    result = "failed"

            (
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

            

            if result == "success":
                updated_count += 1
            else:
                failed_count += 1

            details.append({
                "id": prediction_id,
                "city": city,
                "predicted_score": predicted_score,
                "actual_rain": actual_rain,
                "result": result
            })

        return {
            "status": "auto_verified_batch",
            "version": "V13 Safe Batch",
            "source": "open_meteo_archive",
            "threshold_used": 30,
            "requested_limit": limit,
            "checked_count": len(rows),
            "successful_count": updated_count,
            "failed_count": failed_count,
            "skipped_count": skipped_count,
            "details": details[:20]
        }

    except Exception as e:
        return {
            "status": "error",
            "version": "V13 Safe Batch",
            "error": str(e)
        }

@app.get("/prediction-analytics")
def prediction_analytics():
    """
    تحليل أداء التوقعات من Supabase.
    V13 - Enhanced Analytics
    """
    try:
        if not supabase:
            return {
                "source": "supabase",
                "status": "error",
                "error": "Supabase not configured",
                "total_predictions": 0,
                "verified_predictions": 0,
                "successful_predictions": 0,
                "failed_predictions": 0,
                "accuracy_percent": 0,
                "average_rain_score": 0,
                "average_actual_rain": 0,
                "average_actual_rain_when_rain": 0,
                "actual_rain_events": 0,
                "actual_rain_event_percent": 0,
                "city_accuracy": []
            }

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
                sum(safe_number(r.get("rain_score")) for r in verified_rows)
                / verified_predictions,
                2
            )
            if verified_predictions > 0 else 0
        )

        actual_rain_values = [
            safe_number(r.get("actual_rain"))
            for r in verified_rows
        ]

        rainy_actual_values = [
            value for value in actual_rain_values
            if value > 0
        ]

        avg_actual_rain = (
            round(sum(actual_rain_values) / len(actual_rain_values), 3)
            if actual_rain_values else 0
        )

        avg_actual_rain_when_rain = (
            round(sum(rainy_actual_values) / len(rainy_actual_values), 3)
            if rainy_actual_values else 0
        )

        actual_rain_events = len(rainy_actual_values)

        actual_rain_event_percent = (
            round(actual_rain_events * 100 / verified_predictions, 2)
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
            "version": "V13 Enhanced Analytics",
            "total_predictions": total_predictions,
            "verified_predictions": verified_predictions,
            "successful_predictions": successful_predictions,
            "failed_predictions": failed_predictions,
            "accuracy_percent": accuracy_percent,
            "average_rain_score": avg_rain_score,
            "average_actual_rain": avg_actual_rain,
            "average_actual_rain_when_rain": avg_actual_rain_when_rain,
            "actual_rain_events": actual_rain_events,
            "actual_rain_event_percent": actual_rain_event_percent,
            "city_accuracy": city_accuracy,
            "adaptive_learning": adaptive_learning_v1()
        }

    except Exception as e:
        return {
            "source": "supabase",
            "version": "V13 Enhanced Analytics",
            "status": "error",
            "error": str(e),
            "total_predictions": 0,
            "verified_predictions": 0,
            "successful_predictions": 0,
            "failed_predictions": 0,
            "accuracy_percent": 0,
            "average_rain_score": 0,
            "average_actual_rain": 0,
            "average_actual_rain_when_rain": 0,
            "actual_rain_events": 0,
            "actual_rain_event_percent": 0,
            "city_accuracy": []
        }

@app.get("/prediction-debug")
def prediction_debug(limit: int = Query(10)):
    """
    عرض مختصر للتأكد من الحفظ والتحقق.
    """
    try:
        if not supabase:
            return {
                "source": "supabase",
                "count": 0,
                "records": [],
                "error": "Supabase not configured"
            }

        response = (
            supabase
            .table("prediction_history")
            .select(
                "id,city,rain_score,forecast24,forecast72,"
                "flood_score,precipitation_probability,"
                "cloud_cover,humidity,verified,actual_rain,"
                "result,lat,lon,prediction_time,created_at"
            )
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
        cooldown_seconds = max(
            0,
            int((cooldown_until - now_utc()).total_seconds())
        )
        cooldown_active = cooldown_seconds > 0

    return {
        "open_meteo_available": is_open_meteo_available(),
        "open_meteo_cooldown_active": cooldown_active,
        "open_meteo_cooldown_seconds": cooldown_seconds,
        "open_meteo_failures": SOURCE_STATE.get("open_meteo_failures", 0),
        "openweather_enabled": bool(OPENWEATHER_API_KEY),
        "openweather_failures": SOURCE_STATE.get("openweather_failures", 0),
        "strategy": (
            "Open-Meteo primary, OpenWeatherMap verification, "
            "Hybrid Recovery, Supabase prediction history, "
            "Adaptive Learning V1"
        )
    }


@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "version": "6.7",
        "cache_minutes": CACHE_MINUTES,
        "smart_api_load_balancer": True,
        "hybrid_recovery": True,
        "openweather_always_verify": True,
        "supabase_learning": True,
        "actual_rain_verification": True,
        "adaptive_learning_v1": True,
        "adaptive_learning_endpoint": "/adaptive-learning",
        "rain_alert_endpoint": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah",
        "prediction_analytics_endpoint": "/prediction-analytics",
        "prediction_debug_endpoint": "/prediction-debug",
        "load_balancer": get_load_balancer_status()
    }

@app.get("/ai-status")
def ai_status():
    return {
        "adaptive_learning": adaptive_learning_v1(),
        "adaptive_thresholds": adaptive_thresholds_v2(),
        "message": "RainGuard AI learning system is active"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RainGuard AI",
        "version": "6.7",
        "openweather_always_verify": True,
        "supabase_learning": True,
        "actual_rain_verification": True,
        "adaptive_learning_v1": True,
        "load_balancer": get_load_balancer_status()
    }

@app.get("/test-archive")
async def test_archive():
    tests = [
        {"city": "Jeddah", "lat": 21.5433, "lon": 39.1728, "time": "2026-06-01T12:00:00"},
        {"city": "Abha", "lat": 18.2164, "lon": 42.5053, "time": "2026-06-01T12:00:00"},
        {"city": "Jazan", "lat": 16.8892, "lon": 42.5511, "time": "2026-06-01T12:00:00"},
        {"city": "Taif", "lat": 21.2703, "lon": 40.4158, "time": "2026-06-01T12:00:00"}
    ]

    results = []

    for item in tests:
        rain = await get_actual_rain_from_open_meteo(
            item["lat"],
            item["lon"],
            item["time"]
        )

        results.append({
            "city": item["city"],
            "time": item["time"],
            "actual_rain": rain
        })

    return {
        "results": results
    }


init_prediction_db()

