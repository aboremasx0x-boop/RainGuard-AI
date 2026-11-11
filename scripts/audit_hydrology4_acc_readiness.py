"""Hydrology-4 offline flow-accumulation evidence availability audit.

HydroSHEDS ACC encodes upstream contributing-cell counts, NOT elevations,
water depths or a flood-risk classification. This audits local files and
samples a grid cell at each unverified review site without network requests.
"""
from __future__ import annotations
import argparse
import csv
import io
import json
import math
import struct
from pathlib import Path

MAX_METADATA_BYTES=16000
MAX_REGISTER_BYTES=2500000
MAX_SITES=300
EXPECTED_META={
    "dataset":"HydroSHEDS v1.1 Flow Accumulation (ACC)",
    "crs":"EPSG:4326","dtype":"uint32","byteOrder":"little-endian",
    "layout":"row-major","syntheticData":False,
}
OUTCOME="FLOW_ACCUMULATION_CONTEXT_ONLY_NOT_ELEVATION"


def read_json(path,max_bytes):
    if not path.is_file() or not 0<path.stat().st_size<=max_bytes:
        raise ValueError("INPUT_MISSING_OR_TOO_LARGE")
    return json.loads(path.read_text(encoding="utf-8"))


def metadata_info(meta):
    if not isinstance(meta,dict) or any(meta.get(k)!=v for k,v in EXPECTED_META.items()):
        raise ValueError("INVALID_ACC_METADATA_IDENTITY")
    width,height=meta.get("width"),meta.get("height")
    if type(width) is not int or type(height) is not int or not 1<=width<=20000 or not 1<=height<=20000:
        raise ValueError("INVALID_ACC_DIMENSIONS")
    left,top,px,py=(meta.get(k) for k in ("left","top","pixelWidth","pixelHeight"))
    if any(type(x) not in (int,float) or not math.isfinite(x) for x in (left,top,px,py)) or px<=0 or py<=0:
        raise ValueError("INVALID_ACC_GRID_ORIGIN")
    if not (-180<=left<=180 and -90<=top<=90 and left+width*px<=180.01 and top-height*py>=-90.01):
        raise ValueError("INVALID_ACC_GRID_EXTENT")
    nodata=meta.get("nodata")
    if type(nodata) is not int or not 0<=nodata<=0xffffffff:
        raise ValueError("INVALID_NODATA")
    return width,height,left,top,px,py,nodata


def inspect_register(reg):
    if (not isinstance(reg,dict)
        or reg.get("reportType")!="RAINGUARD_HYDROLOGY3_UNVERIFIED_EVIDENCE_REGISTER"
        or reg.get("status")!="REVIEW_REGISTER_ONLY_NO_SAFETY_DECISION"
        or reg.get("safeToDrive","INVALID") is not None
        or reg.get("alternativeRouteApproved") is not False
        or reg.get("operationalWarningApproved") is not False
        or reg.get("independentlyVerifiedEvidenceCount")!=0):
        raise ValueError("INVALID_UNVERIFIED_HYDROLOGY3_REGISTER")
    sites=reg.get("sites")
    if not isinstance(sites,list) or not 1<=len(sites)<=MAX_SITES or len(sites)!=reg.get("siteCount"):
        raise ValueError("INVALID_SITE_COUNT")
    ids=set()
    for s in sites:
        if not isinstance(s,dict) or s.get("siteId") in ids or not isinstance(s.get("siteId"),str) or not s["siteId"].startswith("RG-HYDRO-REVIEW-"):
            raise ValueError("INVALID_SITE_ID")
        ids.add(s["siteId"])
        lat,lon=s.get("latitude"),s.get("longitude")
        if any(type(x) not in (int,float) or not math.isfinite(x) for x in (lat,lon)) or not (20<=lat<=22.5 and 38<=lon<=40.5):
            raise ValueError("INVALID_SITE_LOCATION")
        if s.get("safeToDrive","INVALID") is not None or s.get("reviewStatus")!="HUMAN_REVIEW_REQUIRED":
            raise ValueError("UNSUPPORTED_SITE_APPROVAL")
    return sites


def sample_site_values(reg,meta,acc_file):
    sites=inspect_register(reg)
    width,height,left,top,px,py,nodata=metadata_info(meta)
    expected=width*height*4
    if not acc_file.is_file() or acc_file.stat().st_size!=expected:
        return [{
            "siteId":s["siteId"],"latitude":s["latitude"],"longitude":s["longitude"],
            "gridStatus":"ACC_BINARY_MISSING_OR_SIZE_MISMATCH",
            "accumulatedUpstreamCellCount":None,
            "roadElevationMeters":None,
            "culvertEvidence":"MISSING",
            "bridgeEvidence":"MISSING",
            "floodRisk":"NOT_EVALUATED",
        } for s in sites]
    out=[]
    with acc_file.open("rb") as fh:
        for s in sites:
            row=math.floor((top-s["latitude"])/py)
            col=math.floor((s["longitude"]-left)/px)
            record={
                "siteId":s["siteId"],"latitude":s["latitude"],"longitude":s["longitude"],
                "gridStatus":"ACC_GRID_OUTSIDE_COVERAGE",
                "accumulatedUpstreamCellCount":None,
                "roadElevationMeters":None,
                "culvertEvidence":"MISSING",
                "bridgeEvidence":"MISSING",
                "floodRisk":"NOT_EVALUATED",
            }
            if 0<=row<height and 0<=col<width:
                fh.seek((row*width+col)*4)
                b=fh.read(4)
                if len(b)!=4:raise ValueError("INCOMPLETE_ACC_READ")
                value=struct.unpack("<I",b)[0]
                if value==nodata:
                    record["gridStatus"]="ACC_NODATA"
                else:
                    record["gridStatus"]="ACC_CELL_PRESENT_UNVERIFIED"
                    record["accumulatedUpstreamCellCount"]=value
                record["gridRow"],record["gridCol"]=row,col
            out.append(record)
    return out


def build_audit(reg,meta,acc_file):
    items=sample_site_values(reg,meta,acc_file)
    available=sum(x["gridStatus"]=="ACC_CELL_PRESENT_UNVERIFIED" for x in items)
    return {
        "reportType":"RAINGUARD_HYDROLOGY4_ACC_READINESS_ONLY",
        "status":OUTCOME,
        "siteCount":len(items),
        "accGridAvailableSiteCount":available,
        "accGridUnavailableSiteCount":len(items)-available,
        "demElevationVerifiedCount":0,
        "bridgeCulvertVerifiedCount":0,
        "observedRoadFloodingVerifiedCount":0,
        "sourceDataset":"HydroSHEDS v1.1 ACC (upstream contributing grid cells)",
        "sourceResolutionArcSeconds":meta["resolutionArcSeconds"],
        "roadElevationAvailable":False,
        "accIsDemElevation":False,
        "officialRoadCrossingConfirmed":False,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "roadClosureStatus":"UNKNOWN",
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "sites":items,
        "limitations":"ACC cell count cannot be converted into road height, flood depth, road crossing, flood probability or a safe route. A cell may be absent or spatially inaccurate. No culvert or bridge inventory is verified.",
    }


def as_csv(report):
    buf=io.StringIO()
    writer=csv.writer(buf,lineterminator="\n")
    columns=["siteId","latitude","longitude","gridStatus","accumulatedUpstreamCellCount",
             "roadElevationMeters","culvertEvidence","bridgeEvidence","floodRisk"]
    writer.writerow(columns)
    for row in report["sites"]:
        writer.writerow([row.get(k) for k in columns])
    return buf.getvalue()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--register",type=Path,required=True)
    parser.add_argument("--metadata",type=Path,default=Path("data/hydrology/saudi_hydrosheds_acc_15s.meta.json"))
    parser.add_argument("--acc",type=Path,default=Path("frontend/data/hydrology/saudi_hydrosheds_acc_15s.u32"))
    parser.add_argument("--prefix",type=Path,default=Path("jeddah_makkah_hydrology4"))
    args=parser.parse_args()
    outputs=[Path(str(args.prefix)+ext) for ext in ("_acc_audit.json","_acc_sites.csv")]
    if any(path.exists() for path in outputs):
        parser.error("Reports already exist; use a new --prefix")
    try:
        register=read_json(args.register,MAX_REGISTER_BYTES)
        meta=read_json(args.metadata,MAX_METADATA_BYTES)
        report=build_audit(register,meta,args.acc)
        bodies=[json.dumps(report,ensure_ascii=False,indent=2)+"\n",as_csv(report)]
    except (ValueError,TypeError,OSError,UnicodeError,json.JSONDecodeError) as exc:
        parser.error(str(exc))
    written=[]
    try:
        for path,body in zip(outputs,bodies):
            path.write_text(body,encoding="utf-8-sig" if path.suffix==".csv" else "utf-8")
            written.append(path)
    except OSError:
        for path in written:path.unlink(missing_ok=True)
        raise
    print(json.dumps({
        "status":report["status"],"siteCount":report["siteCount"],
        "accGridAvailableSiteCount":report["accGridAvailableSiteCount"],
        "demElevationVerifiedCount":0,"bridgeCulvertVerifiedCount":0,
        "safeToDrive":None,"outputs":[str(x) for x in outputs],
    },ensure_ascii=False))

if __name__=="__main__":
    main()
