"""Hydrology-5: offline SRTM HGT terrain sampling for unverified road review sites.

Only user-provided NASA SRTM-compatible HGT tiles. Every sampled elevation
remains unverified. A terrain sample is NOT a surveyed road level; comparisons
cannot predict flood depth, culvert capacity or driving safety.
No internet, credentials, GDAL or rasterio needed.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import struct
from pathlib import Path

from audit_hydrology4_acc_readiness import inspect_register, read_json, MAX_REGISTER_BYTES

HGT_NAME = re.compile(r"^[NS](?:0[0-9]|[1-8][0-9])[EW](?:0[0-9][0-9]|1[0-7][0-9])\.hgt$",re.I)
SIZES = {1201:1201*1201*2,3601:3601*3601*2}
VOID = -32768


def hgt_info(path):
    if not path.is_file() or not HGT_NAME.fullmatch(path.name):
        raise ValueError("INVALID_HGT_TILE_NAME_OR_FILE")
    size=path.stat().st_size
    n=next((k for k,v in SIZES.items() if v==size),None)
    if n is None:
        raise ValueError("UNSUPPORTED_HGT_TILE_SIZE_EXPECT_1201_OR_3601")
    name=path.stem.upper()
    lat=(1 if name[0]=="N" else -1)*int(name[1:3])
    lon=(1 if name[3]=="E" else -1)*int(name[4:7])
    return n,lat,lon


def sample_hgt(path,sites):
    n,lat0,lon0=hgt_info(path)
    records=[]
    with path.open("rb") as stream:
        for site in sites:
            lat,lon=site["latitude"],site["longitude"]
            # SRTM HGT has north-to-south rows, west-to-east columns.
            if not (lat0<=lat<lat0+1 and lon0<=lon<lon0+1):
                status="OUTSIDE_TILE"
                val=None
                row=col=None
            else:
                row=round((lat0+1-lat)*(n-1))
                col=round((lon-lon0)*(n-1))
                row=max(0,min(n-1,row))
                col=max(0,min(n-1,col))
                stream.seek(2*(row*n+col))
                data=stream.read(2)
                if len(data)!=2:raise ValueError("INCOMPLETE_HGT_CELL")
                v=struct.unpack(">h",data)[0]
                status="VOID_NO_ELEVATION" if v==VOID else "TERRAIN_SAMPLE_UNVERIFIED"
                val=None if v==VOID else v
            records.append({
                "siteId":site["siteId"],"latitude":lat,"longitude":lon,
                "sampleStatus":status,"sampledTerrainElevationMeters":val,
                "nearestGridRow":row,"nearestGridColumn":col,
                "roadSurfaceElevationMeters":None,
                "verticalDatumVerification":"NOT_PERFORMED",
                "bridgeOrCulvertStatus":"UNKNOWN",
                "floodRisk":"NOT_EVALUATED",
                "safeToDrive":None,
            })
    return n,records


def audit(register,hgt_path):
    sites=inspect_register(register)
    n,results=sample_hgt(hgt_path,sites)
    count=sum(s["sampleStatus"]=="TERRAIN_SAMPLE_UNVERIFIED" for s in results)
    return {
        "reportType":"RAINGUARD_HYDROLOGY5_DEM_TERRAIN_SAMPLE",
        "status":"LOCAL_TERRAIN_SAMPLES_NOT_VALIDATED_FOR_ROADS",
        "tileName":hgt_path.name,
        "declaredFormat":"SRTM HGT big-endian signed int16",
        "tileDimension":n,
        "terrainGridSpacingArcseconds":3600/(n-1),
        "siteCount":len(results),
        "sampledTerrainCellCount":count,
        "missingOrVoidSampleCount":len(results)-count,
        "verifiedRoadSurfaceElevationCount":0,
        "validatedDEMProvenanceCount":0,
        "bridgeCulvertVerifiedCount":0,
        "sourceAuthenticity":"USER_PROVIDED_FILE_UNVERIFIED",
        "datumVerification":"NOT_PERFORMED",
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "officialRoadCrossingConfirmed":False,
        "sites":results,
        "limitations":"HGT values are sampled terrain heights of a user-provided dataset, not surveyed road deck elevations; bridges, culverts and vertical datum must be independently checked. No flood risk or safe-route inference.",
    }


def to_csv(report):
    out=io.StringIO()
    writer=csv.writer(out,lineterminator="\n")
    keys=("siteId","latitude","longitude","sampleStatus","sampledTerrainElevationMeters",
          "roadSurfaceElevationMeters","verticalDatumVerification","bridgeOrCulvertStatus","floodRisk")
    writer.writerow(keys)
    for site in report["sites"]:writer.writerow([site[k] for k in keys])
    return out.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register",type=Path,required=True)
    parser.add_argument("--hgt",type=Path,required=True,help="Existing local N21E039.hgt (not downloaded by this tool)")
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology5"))
    args=parser.parse_args()
    outputs=[Path(str(args.prefix)+s) for s in ("_terrain_samples.json","_terrain_samples.csv")]
    if any(x.exists() for x in outputs):
        parser.error("Output file exists. Choose a fresh --prefix to preserve evidence")
    try:
        result=audit(read_json(args.register,MAX_REGISTER_BYTES),args.hgt)
        bodies=[json.dumps(result,ensure_ascii=False,indent=2)+"\n",to_csv(result)]
    except (ValueError,TypeError,OSError,UnicodeError,json.JSONDecodeError) as err:
        parser.error(str(err))
    written=[]
    try:
        for p,body in zip(outputs,bodies):
            p.write_text(body,encoding="utf-8-sig" if p.suffix==".csv" else "utf-8")
            written.append(p)
    except OSError:
        for p in written:p.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":result["status"],"siteCount":result["siteCount"],
        "sampledTerrainCellCount":result["sampledTerrainCellCount"],
        "verifiedRoadSurfaceElevationCount":0,
        "sourceAuthenticity":result["sourceAuthenticity"],
        "safeToDrive":None,"outputs":[str(x) for x in outputs]},ensure_ascii=False))


if __name__=="__main__":
    main()
