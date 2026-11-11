"""Explain why Valhalla maneuver-derived ETA anchors cannot be used.

Only structural counts/diagnostic labels leave the server. No raw
provider response, road coordinates, credentials, or invented ETA.
"""
from __future__ import annotations
import math
from valhalla_maneuver_timing import build_time_anchors, haversine_km

def timing_diagnostic(legs, points_by_leg, trip_seconds):
    result={
        "status":"NOT_AVAILABLE",
        "reason":"UNKNOWN_INCOMPLETE_EVIDENCE",
        "maneuverCount":0,
        "legCount":len(legs) if isinstance(legs,list) else 0,
        "interiorTimedBoundaries":0,
        "summarySeconds":round(trip_seconds,1) if type(trip_seconds) in (int,float)
                            and math.isfinite(trip_seconds) and trip_seconds>0 else None,
        "maneuverSeconds":None,
        "closestBoundaryOffsetFromHalfPct":None,
        "recommendedAction":"Do not infer elapsed time from total journey duration.",
    }
    def fail(reason):return {**result,"reason":reason}
    if not isinstance(legs,list) or not isinstance(points_by_leg,list) or not 1<=len(legs)<=30 or len(legs)!=len(points_by_leg):
        return fail("INVALID_LEG_COLLECTION")
    if result["summarySeconds"] is None:
        return fail("INVALID_TOTAL_TIME")
    all_points=[]
    boundaries=[]
    elapsed=0.0
    for leg,coords in zip(legs,points_by_leg):
        if not isinstance(leg,dict) or not isinstance(coords,list) or len(coords)<2:
            return fail("MISSING_SHAPE_POINTS")
        if all_points and all_points[-1]!=coords[0]:
            return fail("DISCONNECTED_LEG_GEOMETRY")
        offset=len(all_points)-1 if all_points else 0
        all_points.extend(coords[1:] if all_points else coords)
        maneuvers=leg.get("maneuvers")
        if not isinstance(maneuvers,list) or not 1<=len(maneuvers)<=5000:
            return fail("MISSING_MANEUVER_ARRAY")
        previous=0
        for m in maneuvers:
            result["maneuverCount"]+=1
            if not isinstance(m,dict):
                return fail("MALFORMED_MANEUVER")
            start,end=m.get("begin_shape_index"),m.get("end_shape_index")
            seconds=m.get("time")
            if type(start) is not int or type(end) is not int or not 0<=start<=end<len(coords):
                return fail("MANEUVER_INDEX_OUT_OF_RANGE")
            if start!=previous:
                return fail("NONCONTIGUOUS_MANEUVER_INDEX")
            if type(seconds) not in (int,float) or not math.isfinite(seconds) or seconds<0:
                return fail("INVALID_MANEUVER_TIME")
            elapsed+=seconds
            if end>start:
                boundaries.append((offset+end,elapsed))
            previous=end
        if previous!=len(coords)-1:
            return fail("MANEUVERS_DO_NOT_REACH_LEG_END")
    result["maneuverSeconds"]=round(elapsed,2)
    if abs(elapsed-trip_seconds)>max(60,trip_seconds*.05):
        return fail("MANEUVER_TIMES_DISAGREE_WITH_TOTAL")
    if len(all_points)<3:
        return fail("INSUFFICIENT_ROUTE_POINTS")
    dist=[0.0]
    for a,b in zip(all_points,all_points[1:]):
        dist.append(dist[-1]+haversine_km(a,b))
    total=dist[-1]
    if total<=.1:return fail("ROUTE_TOO_SHORT")
    candidates=[(idx,t) for idx,t in boundaries if 0<idx<len(all_points)-1 and 0<t<elapsed]
    result["interiorTimedBoundaries"]=len(candidates)
    if not candidates:
        return fail("NO_INTERIOR_MANEUVER_BOUNDARY")
    idx,time=min(candidates,key=lambda item:abs(dist[item[0]]-total/2))
    deviation=abs(dist[idx]-total/2)/total*100
    result["closestBoundaryOffsetFromHalfPct"]=round(deviation,2)
    if deviation>25:
        return fail("NO_TIMED_BOUNDARY_WITHIN_MIDPOINT_WINDOW")
    anchors=build_time_anchors(legs,points_by_leg,trip_seconds)
    if not anchors:
        return fail("INCOMPLETE_ANCHOR_VALIDATION")
    result["status"]="PROVIDER_ESTIMATED_ANCHORS"
    result["reason"]="OK_PROVIDER_ESTIMATE_NOT_OBSERVED"
    result["recommendedAction"]="Use estimated maneuver boundaries for research only; never certify road safety."
    return result
