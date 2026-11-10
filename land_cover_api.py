
from fastapi import APIRouter, HTTPException, Query
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from functools import lru_cache
import rasterio
import math

router = APIRouter()

CLASSES = {
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare or sparse vegetation",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen"
}

BASE_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com"
    "/v200/2021/map/"
)

def tile_name(lat, lon):
    south = math.floor(lat / 3) * 3
    west = math.floor(lon / 3) * 3

    ns = "N" if south >= 0 else "S"
    ew = "E" if west >= 0 else "W"

    return f"{ns}{abs(south):02d}{ew}{abs(west):03d}"

def sample_land_cover(lat, lon):
    tile = tile_name(lat, lon)

    filename = (
        f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
    )

    url = BASE_URL + filename

    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        GDAL_HTTP_MAX_RETRY="1",
        GDAL_HTTP_CONNECTTIMEOUT="5"
    ):
        with rasterio.open("/vsicurl/" + url) as dataset:
            value = next(
                dataset.sample([(lon, lat)], masked=True)
            )[0]

            if hasattr(value, "mask") and value.mask:
                raise ValueError("NO_DATA_AT_LOCATION")

            code = int(value)

    if code not in CLASSES:
        raise ValueError("INVALID_LAND_COVER_CLASS")

    return {
        "available": True,
        "classCode": code,
        "className": CLASSES[code],
        "dataset": "ESA_WORLDCOVER_2021_V200",
        "datasetYear": 2021,
        "resolutionMeters": 10,
        "tile": tile,
        "source": "ESA WorldCover",
        "quality": "SATELLITE_CLASSIFICATION",
        "locallyValidated": False
    }

@router.get("/api/land-cover")
def get_land_cover(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180)
):
    pool = ThreadPoolExecutor(max_workers=1)
    future = pool.submit(sample_land_cover, lat, lon)

    try:
        return future.result(timeout=20)
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="LAND_COVER_TIMEOUT"
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"LAND_COVER_UNAVAILABLE: {error}"
        )
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
