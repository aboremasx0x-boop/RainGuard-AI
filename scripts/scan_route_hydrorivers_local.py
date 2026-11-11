"""Local research-only proximity screening: Valhalla route vs HydroRIVERS tile.

No flood prediction, road crossing certification, live source, or safe-to-drive
verdict. One manually chosen route + one checked-in HydroRIVERS tile.
No network calls or external dependencies.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

MAX_ROUTE_POINTS = 60000
MAX_TILE_FEATURES = 5000
MAX_TILE_POINTS = 250000
MAX_FILE_BYTES = 2500000
DEFAULT_THRESHOLD_METERS = 200.0
EXPECTED_TILE = "N20_E038.geojson"


def checked_point(value):
    if (not isinstance(value,list) or len(value)!=2 or
        any(type(v) not in (int,float) or not math.isfinite(v) for v in value) or
        not (38<=value[0]<=40.5 and 20<=value[1]<=22.5)):
        raise ValueError("INVALID_COORDINATE_FOR_JEDDAH_MAKKAH_PILOT")
    return float(value[0]),float(value[1])


def load_json(path:Path):
    if not path.is_file() or path.stat().st_size>MAX_FILE_BYTES:
        raise ValueError("MISSING_OR_OVERSIZE_FILE")
    return json.loads(path.read_text(encoding="utf-8"))


def route_points(data):
    if not isinstance(data,dict) or data.get("type")!="FeatureCollection" or data.get("reportType")!="RESEARCH_ONLY_PUBLIC_DEMO_GEOMETRY" or data.get("safeToDrive","INVALID") is not None or data.get("alternativeRouteApproved") is not False:
        raise ValueError("NOT_A_RESEARCH_ROUTE_EXPORT")
    features=data.get("features")
    if not isinstance(features,list) or len(features)!=1:
        raise ValueError("INVALID_ROUTE_FEATURE")
    geometry=features[0].get("geometry")
    if not isinstance(geometry,dict) or geometry.get("type")!="LineString":
        raise ValueError("INVALID_ROUTE_GEOMETRY")
    pts=geometry.get("coordinates")
    if not isinstance(pts,list) or not 2<=len(pts)<=MAX_ROUTE_POINTS:
        raise ValueError("INVALID_ROUTE_POINTS")
    return [checked_point(p) for p in pts]


def river_features(data):
    if not isinstance(data,dict) or data.get("type")!="FeatureCollection":
        raise ValueError("INVALID_RIVER_COLLECTION")
    features=data.get("features")
    if not isinstance(features,list) or len(features)>MAX_TILE_FEATURES:
        raise ValueError("INVALID_RIVER_FEATURES")
    output=[]
    total_points=0
    for f in features:
        if not isinstance(f,dict):
            raise ValueError("INVALID_RIVER_FEATURE")
        geom=f.get("geometry")
        if not isinstance(geom,dict) or geom.get("type")!="LineString":
            raise ValueError("UNSUPPORTED_RIVER_GEOMETRY")
        pts=geom.get("coordinates")
        if not isinstance(pts,list) or len(pts)<2:
            raise ValueError("INVALID_RIVER_LINE")
        total_points+=len(pts)
        if total_points>MAX_TILE_POINTS:
            raise ValueError("OVERSIZE_RIVER_GEOMETRY")
        props=f.get("properties",{})
        rid=props.get("HYRIV_ID") if isinstance(props,dict) else None
        if type(rid) is not int or rid<=0:
            raise ValueError("MISSING_HYDRORIVERS_IDENTIFIER")
        output.append((rid,[checked_point(p) for p in pts]))
    return output


def meters_xy(point,reference_lat):
    scale=math.pi/180*6371000
    return point[0]*scale*math.cos(reference_lat*math.pi/180),point[1]*scale


def sq_segment_distance(a,b,c,d):
    """Closest squared planar distance of two 2D segments."""
    def dot(u,v):return u[0]*v[0]+u[1]*v[1]
    def sub(u,v):return u[0]-v[0],u[1]-v[1]
    def ptseg(p,q,r):
        v=sub(r,q);w=sub(p,q)
        l=dot(v,v)
        t=max(0.0,min(1.0,dot(w,v)/l)) if l>0 else 0.0
        e=(p[0]-(q[0]+t*v[0]),p[1]-(q[1]+t*v[1]))
        return dot(e,e)
    u=sub(b,a);v=sub(d,c);w=sub(c,a)
    denom=u[0]*v[1]-u[1]*v[0]
    if abs(denom)>1e-9:
        t=(w[0]*v[1]-w[1]*v[0])/denom
        q=(w[0]*u[1]-w[1]*u[0])/denom
        if 0<=t<=1 and 0<=q<=1:
            return 0.0
    return min(ptseg(a,c,d),ptseg(b,c,d),ptseg(c,a,b),ptseg(d,a,b))


def scan(route, rivers, threshold=DEFAULT_THRESHOLD_METERS):
    if type(threshold) not in (int,float) or not 0<threshold<=500:
        raise ValueError("INVALID_PROXIMITY_THRESHOLD")
    reference_lat=sum(p[1] for p in route)/len(route)
    road=[meters_xy(p,reference_lat) for p in route]
    segments=list(zip(road,road[1:]))
    matches=[]
    for rid,river in rivers:
        water=[meters_xy(p,reference_lat) for p in river]
        best=float("inf")
        # Bounding-box pruning keeps the local analysis bounded on typical 636-feature tile.
        for c,d in zip(water,water[1:]):
            lowx,miny,maxx,maxy=min(c[0],d[0])-threshold,min(c[1],d[1])-threshold,max(c[0],d[0])+threshold,max(c[1],d[1])+threshold
            for a,b in segments:
                if max(a[0],b[0])<lowx or min(a[0],b[0])>maxx or max(a[1],b[1])<miny or min(a[1],b[1])>maxy:
                    continue
                ds=sq_segment_distance(a,b,c,d)
                if ds<best:
                    best=ds
        if best<=threshold*threshold:
            matches.append({"riverId":rid,"approximateProximityMeters":round(math.sqrt(best),1)})
    matches.sort(key=lambda x:(x["approximateProximityMeters"],x["riverId"]))
    return {
        "status":"RESEARCH_PROXIMITY_SCREEN_ONLY",
        "dataset":"HydroRIVERS v1.0 / RainGuard checked-in tile",
        "tile":EXPECTED_TILE,
        "bufferMeters":threshold,
        "routePointCount":len(route),
        "tileRiverFeatureCount":len(rivers),
        "nearbyRiverCount":len(matches),
        "nearbyRivers":matches[:30],
        "resultsTruncated":len(matches)>30,
        "officialRoadCrossingConfirmed":False,
        "hydrologicFloodRisk":"NOT_EVALUATED",
        "roadClosureStatus":"UNKNOWN",
        "safeToDrive":None,
        "alternativeRouteApproved":False,
        "operationalWarningApproved":False,
        "dataCompleteness":"SINGLE_TILE_RESEARCH_COVERAGE_ONLY",
        "interpretation":"Geometric line proximity does not establish a wadi crossing, culvert, road flooding or safe driving. Dataset accuracy/provenance require independent review.",
    }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--route",type=Path,required=True)
    parser.add_argument("--tile",type=Path,default=Path("frontend/data/hydrology/tiles")/EXPECTED_TILE)
    parser.add_argument("--output",type=Path,default=Path("jeddah_makkah_hydrorivers_screen.json"))
    args=parser.parse_args()
    if args.tile.name!=EXPECTED_TILE:
        parser.error("Jeddah-Makkah pilot only supports its checked-in N20_E038 tile")
    if args.output.exists():
        parser.error("Output already exists; use a different name to preserve previous evidence")
    try:
        result=scan(route_points(load_json(args.route)),river_features(load_json(args.tile)))
    except (ValueError,TypeError,OverflowError,OSError,UnicodeError,json.JSONDecodeError) as exc:
        parser.error(str(exc))
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({key:result[key] for key in ("status","nearbyRiverCount","tileRiverFeatureCount",
        "dataCompleteness","safeToDrive")},ensure_ascii=False))

if __name__=="__main__":
    main()
