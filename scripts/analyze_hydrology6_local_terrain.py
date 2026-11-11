"""Hydrology-6: local SRTM 5x5 terrain-window descriptives, not flood risk.

Offline, no dependencies. Reads a few HGT cells for each Hydrology-3
unverified candidate; does not infer road elevation, depressions with
hydrological significance, road safety or inundation from DEM alone.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
import struct
from pathlib import Path
from audit_hydrology4_acc_readiness import inspect_register,read_json,MAX_REGISTER_BYTES
from sample_hydrology5_srtm_hgt import hgt_info,VOID

WINDOW_RADIUS=2
STATUS="LOCAL_DEM_NEIGHBORHOOD_DESCRIPTIVES_UNVERIFIED"


def window_samples(path,sites,radius=WINDOW_RADIUS):
    if type(radius) is not int or not 1<=radius<=4:
        raise ValueError("INVALID_WINDOW_RADIUS")
    n,lat0,lon0=hgt_info(path)
    records=[]
    with path.open("rb") as file:
        for site in sites:
            lat,lon=site["latitude"],site["longitude"]
            result={
                "siteId":site["siteId"],"latitude":lat,"longitude":lon,
                "sampleStatus":"OUTSIDE_TILE",
                "windowRadiusCells":radius,"windowCellCount":(2*radius+1)**2,
                "validWindowCellCount":0,"voidWindowCellCount":0,
                "centerTerrainMeters":None,"minTerrainMeters":None,
                "maxTerrainMeters":None,"medianTerrainMeters":None,
                "maxMinusMinMeters":None,"centerMinusMedianMeters":None,
                "roadSurfaceElevationMeters":None,"roadCrossingVerified":False,
                "bridgeOrCulvertStatus":"UNKNOWN","floodRisk":"NOT_EVALUATED",
                "safeToDrive":None,
            }
            if not (lat0<=lat<lat0+1 and lon0<=lon<lon0+1):
                records.append(result);continue
            row=round((lat0+1-lat)*(n-1))
            col=round((lon-lon0)*(n-1))
            if not (radius<=row<n-radius and radius<=col<n-radius):
                result["sampleStatus"]="INCOMPLETE_WINDOW_TILE_EDGE"
                records.append(result);continue
            rows=[]
            for r in range(row-radius,row+radius+1):
                file.seek(2*(r*n+col-radius))
                b=file.read(2*(2*radius+1))
                if len(b)!=2*(2*radius+1):
                    raise ValueError("INCOMPLETE_HGT_WINDOW_READ")
                rows.append(struct.unpack(">"+("h"*(2*radius+1)),b))
            vals=[v for line in rows for v in line if v!=VOID]
            result["validWindowCellCount"]=len(vals)
            result["voidWindowCellCount"]=result["windowCellCount"]-len(vals)
            center=rows[radius][radius]
            if center==VOID:
                result["sampleStatus"]="CENTER_VOID"
            elif len(vals)<result["windowCellCount"]:
                result["sampleStatus"]="INCOMPLETE_WINDOW_NODATA"
                result["centerTerrainMeters"]=center
            else:
                ordered=sorted(vals)
                median=ordered[len(ordered)//2]
                result.update({
                    "sampleStatus":"WINDOW_SAMPLES_PRESENT_UNVERIFIED",
                    "centerTerrainMeters":center,
                    "minTerrainMeters":ordered[0],
                    "maxTerrainMeters":ordered[-1],
                    "medianTerrainMeters":median,
                    "maxMinusMinMeters":ordered[-1]-ordered[0],
                    "centerMinusMedianMeters":center-median,
                })
            records.append(result)
    return n,records


def build_report(register,hgt_path,radius=WINDOW_RADIUS):
    sites=inspect_register(register)
    n,items=window_samples(hgt_path,sites,radius)
    complete=sum(x["sampleStatus"]=="WINDOW_SAMPLES_PRESENT_UNVERIFIED" for x in items)
    return {
        "reportType":"RAINGUARD_HYDROLOGY6_LOCAL_TERRAIN_WINDOWS",
        "status":STATUS,
        "sourceTile":hgt_path.name,
        "sourceFormat":"SRTM HGT int16 big endian; provenance not independently authenticated",
        "tileDimension":n,
        "windowRadiusCells":radius,
        "siteCount":len(items),
        "completeWindowCount":complete,
        "incompleteWindowCount":len(items)-complete,
        "validatedDEMProvenanceCount":0,
        "verifiedRoadSurfaceElevationCount":0,
        "bridgeCulvertVerifiedCount":0,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "officialRoadClosureStatus":"UNKNOWN",
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "sites":items,
        "limitations":"Cell extrema and center-minus-median describe sampled terrain only, not hydrologic depressions, road grade, bridge deck, culvert capacity, water levels or flood probability. Void or edge windows are unknown; no interpolation.",
    }


def as_csv(report):
    columns=["siteId","latitude","longitude","sampleStatus","validWindowCellCount",
             "voidWindowCellCount","centerTerrainMeters","minTerrainMeters","maxTerrainMeters",
             "medianTerrainMeters","maxMinusMinMeters","centerMinusMedianMeters",
             "roadSurfaceElevationMeters","bridgeOrCulvertStatus","floodRisk"]
    buffer=io.StringIO()
    writer=csv.writer(buffer,lineterminator="\n")
    writer.writerow(columns)
    for s in report["sites"]:
        writer.writerow([s.get(k) for k in columns])
    return buffer.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register",type=Path,required=True)
    parser.add_argument("--hgt",type=Path,required=True)
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology6"))
    args=parser.parse_args()
    paths=[Path(str(args.prefix)+x) for x in ("_terrain_windows.json","_terrain_windows.csv")]
    if any(p.exists() for p in paths):
        parser.error("Existing outputs will not be overwritten; specify a fresh --prefix")
    try:
        report=build_report(read_json(args.register,MAX_REGISTER_BYTES),args.hgt)
        contents=[json.dumps(report,ensure_ascii=False,indent=2)+"\n",as_csv(report)]
    except (OSError,UnicodeError,ValueError,TypeError,json.JSONDecodeError) as exc:
        parser.error(str(exc))
    written=[]
    try:
        for p,c in zip(paths,contents):
            p.write_text(c,encoding="utf-8-sig" if p.suffix==".csv" else "utf-8")
            written.append(p)
    except OSError:
        for p in written:p.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":report["status"],"siteCount":report["siteCount"],
        "completeWindowCount":report["completeWindowCount"],
        "incompleteWindowCount":report["incompleteWindowCount"],
        "verifiedRoadSurfaceElevationCount":0,"safeToDrive":None,
        "outputs":[str(p) for p in paths]},ensure_ascii=False))


if __name__=="__main__":
    main()
