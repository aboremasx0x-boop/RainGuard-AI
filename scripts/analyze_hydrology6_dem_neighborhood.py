"""Hydrology-6: local SRTM HGT neighborhood terrain statistics for review sites.

No external requests. No manufactured road elevations, drainage depths,
flood probabilities, closure notices or approved safe routes.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
import struct
from pathlib import Path

from audit_hydrology4_acc_readiness import inspect_register, read_json, MAX_REGISTER_BYTES
from sample_hydrology5_srtm_hgt import hgt_info, VOID

EARTH_METERS_PER_DEGREE_LAT=111132.0

def neighborhood(hgt, sites, radius=2):
    if type(radius) is not int or not 1 <= radius <= 5:
        raise ValueError("WINDOW_RADIUS_MUST_BE_1_TO_5")
    n, lat0, lon0 = hgt_info(hgt)
    results=[]
    with hgt.open("rb") as stream:
        for site in sites:
            lat,lon=site["latitude"],site["longitude"]
            item={
                "siteId":site["siteId"],"latitude":lat,"longitude":lon,
                "windowRadiusCells":radius,"windowCellCount":(2*radius+1)**2,
                "validCellCount":0,"voidCellCount":0,
                "windowStatus":"NOT_EVALUATED",
                "centerTerrainElevationMeters":None,
                "windowMinTerrainMeters":None,"windowMaxTerrainMeters":None,
                "windowMeanTerrainMeters":None,"localTerrainReliefMeters":None,
                "centerAboveWindowMinimumMeters":None,
                "centerSlopeDegreesApprox":None,
                "roadSurfaceElevationMeters":None,
                "verifiedCulvertStatus":"UNKNOWN",
                "confirmedWadiCrossing":False,
                "floodRisk":"NOT_EVALUATED",
                "safeToDrive":None,
            }
            if not (lat0<=lat<lat0+1 and lon0<=lon<lon0+1):
                item["windowStatus"]="OUTSIDE_HGT_TILE"
                results.append(item)
                continue
            row=round((lat0+1-lat)*(n-1))
            col=round((lon-lon0)*(n-1))
            if row-radius<0 or row+radius>=n or col-radius<0 or col+radius>=n:
                item["windowStatus"]="INCOMPLETE_WINDOW_AT_TILE_EDGE"
                results.append(item)
                continue
            samples={}
            for dr in range(-radius,radius+1):
                rr=row+dr
                stream.seek(2*(rr*n+col-radius))
                raw=stream.read(2*(2*radius+1))
                if len(raw)!=2*(2*radius+1):
                    raise ValueError("TRUNCATED_HGT_ROW")
                vals=struct.unpack(">"+("h"*(2*radius+1)),raw)
                for dc,v in zip(range(-radius,radius+1),vals):
                    samples[(dr,dc)]=None if v==VOID else v
            good=[v for v in samples.values() if v is not None]
            item["validCellCount"]=len(good)
            item["voidCellCount"]=len(samples)-len(good)
            center=samples[(0,0)]
            if center is None:
                item["windowStatus"]="CENTER_VOID_NO_ELEVATION"
            elif len(good)!=len(samples):
                # Partial windows are displayed only as completeness diagnostics,
                # never used for min/slope comparisons.
                item["windowStatus"]="PARTIAL_WINDOW_VOID_VALUES"
                item["centerTerrainElevationMeters"]=center
            else:
                low,high=min(good),max(good)
                item.update({
                    "windowStatus":"COMPLETE_TERRAIN_WINDOW_UNVERIFIED",
                    "centerTerrainElevationMeters":center,
                    "windowMinTerrainMeters":low,
                    "windowMaxTerrainMeters":high,
                    "windowMeanTerrainMeters":round(sum(good)/len(good),2),
                    "localTerrainReliefMeters":high-low,
                    "centerAboveWindowMinimumMeters":center-low,
                })
                dy=EARTH_METERS_PER_DEGREE_LAT/(n-1)
                dx=(111320.0*math.cos(math.radians(lat)))/(n-1)
                if dx>0:
                    dzdx=(samples[(0,1)]-samples[(0,-1)])/(2*dx)
                    dzdy=(samples[(-1,0)]-samples[(1,0)])/(2*dy)
                    item["centerSlopeDegreesApprox"]=round(math.degrees(math.atan(math.hypot(dzdx,dzdy))),3)
            results.append(item)
    return n,results


def build_report(register,hgt,radius=2):
    sites=inspect_register(register)
    n,records=neighborhood(hgt,sites,radius)
    complete=sum(x["windowStatus"]=="COMPLETE_TERRAIN_WINDOW_UNVERIFIED" for x in records)
    return {
        "reportType":"RAINGUARD_HYDROLOGY6_DEM_NEIGHBORHOOD_RESEARCH",
        "status":"LOCAL_TERRAIN_CONTEXT_ONLY_NOT_FLOOD_RISK",
        "tile":hgt.name,"dimension":n,
        "sampleSpacingArcSeconds":3600/(n-1),
        "windowRadiusCells":radius,
        "siteCount":len(records),
        "completeWindowCount":complete,
        "incompleteWindowCount":len(records)-complete,
        "verifiedRoadSurfaceElevationCount":0,
        "verifiedBridgeCulvertCount":0,
        "sourceAuthenticity":"USER_PROVIDED_HGT_UNVERIFIED",
        "verticalDatumVerified":False,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "roadClosureStatus":"UNKNOWN",
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "sites":records,
        "limitations":"Terrain relief and grid gradient are descriptive samples only; neither a measured road grade nor flood susceptibility, stream flow direction, water depth, a depression classification, or routing advice. No hydrologically conditioned DEM, surveyed culvert inventory or field verification.",
    }


def as_csv(report):
    out=io.StringIO()
    keys=("siteId","latitude","longitude","windowStatus","validCellCount",
          "voidCellCount","centerTerrainElevationMeters","windowMinTerrainMeters",
          "windowMaxTerrainMeters","windowMeanTerrainMeters",
          "localTerrainReliefMeters","centerAboveWindowMinimumMeters",
          "centerSlopeDegreesApprox","roadSurfaceElevationMeters","floodRisk")
    writer=csv.writer(out,lineterminator="\n")
    writer.writerow(keys)
    for r in report["sites"]:
        writer.writerow([r[k] for k in keys])
    return out.getvalue()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--register",type=Path,required=True)
    ap.add_argument("--hgt",type=Path,required=True)
    ap.add_argument("--radius-cells",type=int,default=2)
    ap.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology6"))
    args=ap.parse_args()
    paths=[Path(str(args.prefix)+ext) for ext in ("_terrain_context.json","_terrain_context.csv")]
    if any(p.exists() for p in paths):ap.error("Output exists; choose another --prefix")
    try:
        report=build_report(read_json(args.register,MAX_REGISTER_BYTES),args.hgt,args.radius_cells)
        contents=(json.dumps(report,ensure_ascii=False,indent=2)+"\n",as_csv(report))
    except (OSError,ValueError,TypeError,UnicodeError,json.JSONDecodeError) as error:
        ap.error(str(error))
    saved=[]
    try:
        for path,contents_string in zip(paths,contents):
            path.write_text(contents_string,encoding="utf-8-sig" if path.suffix==".csv" else "utf-8")
            saved.append(path)
    except OSError:
        for p in saved:p.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":report["status"],"siteCount":report["siteCount"],
       "completeWindowCount":report["completeWindowCount"],
       "verifiedRoadSurfaceElevationCount":0,"safeToDrive":None,
       "outputs":[str(x) for x in paths]},ensure_ascii=False))


if __name__=="__main__":
    main()
