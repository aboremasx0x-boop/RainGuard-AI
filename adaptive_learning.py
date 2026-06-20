import os
from supabase import create_client
from statistics import mean

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


DEFAULT_WEIGHTS = {
    "precipitation_probability": 0.40,
    "cloud_cover": 0.20,
    "humidity": 0.20,
    "flood_score": 0.20,
}


def clamp(value, min_value, max_value):
    return max(min_value, min(value, max_value))


def normalize_weights(weights):
    total = sum(weights.values())
    if total <= 0:
        return DEFAULT_WEIGHTS

    return {
        key: round(value / total, 4)
        for key, value in weights.items()
    }


def calculate_factor_error(predicted_value, actual_rain):
    """
    actual_rain:
    - 0 = لا يوجد مطر
    - >0 = يوجد مطر
    """

    expected = 100 if actual_rain > 0 else 0
    error = abs(predicted_value - expected)

    accuracy = 100 - error
    return clamp(accuracy, 0, 100)


def get_verified_predictions(limit=300):
    response = (
        supabase.table("prediction_history")
        .select("*")
        .eq("verified", True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return response.data or []


def adaptive_learning_v1():
    rows = get_verified_predictions()

    if not rows:
        return {
            "ok": False,
            "reason": "No verified predictions found",
            "weights": DEFAULT_WEIGHTS,
        }

    factor_scores = {
        "precipitation_probability": [],
        "cloud_cover": [],
        "humidity": [],
        "flood_score": [],
    }

    for row in rows:
        actual_rain = float(row.get("actual_rain") or 0)

        precipitation_probability = float(row.get("precipitation_probability") or 0)
        cloud_cover = float(row.get("cloud_cover") or 0)
        humidity = float(row.get("humidity") or 0)
        flood_score = float(row.get("flood_score") or 0)

        factor_scores["precipitation_probability"].append(
            calculate_factor_error(precipitation_probability, actual_rain)
        )

        factor_scores["cloud_cover"].append(
            calculate_factor_error(cloud_cover, actual_rain)
        )

        factor_scores["humidity"].append(
            calculate_factor_error(humidity, actual_rain)
        )

        factor_scores["flood_score"].append(
            calculate_factor_error(flood_score, actual_rain)
        )

    avg_scores = {
        key: mean(values) if values else 0
        for key, values in factor_scores.items()
    }

    raw_weights = {
        key: clamp(score / 100, 0.05, 0.60)
        for key, score in avg_scores.items()
    }

    final_weights = normalize_weights(raw_weights)

    return {
        "ok": True,
        "samples": len(rows),
        "factor_accuracy": {
            key: round(value, 2)
            for key, value in avg_scores.items()
        },
        "weights": final_weights,
    }


def apply_adaptive_rain_score(
    precipitation_probability,
    cloud_cover,
    humidity,
    flood_score
):
    learning = adaptive_learning_v1()

    weights = learning.get("weights", DEFAULT_WEIGHTS)

    score = (
        precipitation_probability * weights["precipitation_probability"]
        + cloud_cover * weights["cloud_cover"]
        + humidity * weights["humidity"]
        + flood_score * weights["flood_score"]
    )

    return {
        "rain_score": round(clamp(score, 0, 100), 2),
        "adaptive_learning": learning,
    }
