"""Conservative route timing anchors from Valhalla maneuver sections.

Only expose provider-estimated elapsed seconds at maneuver boundaries, never
distribute total trip ETA evenly across distance or invent per-edge timing.
"""
import math

def haversine_km(a, b):
    p=math.pi/180
    dy=(b[1]-a[1])*p
    dx=(b[0]-a[0])*p
    z=math.sin(dy/2)**2+math.cos(a[1]*p)*math.cos(b[1]*p)*math.sin(dx/2)**2
    return 12742*math.atan2(math.sqrt(z),math.sqrt(max(0,1-z)))


def build_time_anchors(legs, coordinates_by_leg, total_seconds):
    """Return 3 at exact maneuver boundaries or None on incomplete evidence.

    No inferred within-maneuver speed is used. Target midpoint is chosen
    from maneuver boundaries by distance, with a maximum 25% off midpoint.
    """
    if (type(total_seconds) not in (int,float) or
        not math.isfinite(total_seconds) or total_seconds<=0 or
        not isinstance(legs,list) or not 1<=len(legs)<=30 or
        len(legs)!=len(coordinates_by_leg)):
        return None
    flat=[]
    anchors=[{"pointIndex":0,"elapsedSeconds":0}]
    cumulative_time=0.0
    for leg,coords in zip(legs,coordinates_by_leg):
        if not isinstance(leg,dict) or not isinstance(coords,list) or len(coords)<2:
            return None
        if flat and flat[-1]!=coords[0]:
            return None
        offset=len(flat)-1 if flat else 0
        flat.extend(coords[1:] if flat else coords)
        maneuvers=leg.get("maneuvers")
        if not isinstance(maneuvers,list) or not 1<=len(maneuvers)<=5000:
            return None
        previous=0
        for maneuver in maneuvers:
            if not isinstance(maneuver,dict):
                return None
            start,end=maneuver.get("begin_shape_index"),maneuver.get("end_shape_index")
            seconds=maneuver.get("time")
            if (type(start) is not int or type(end) is not int or
                not 0<=start<=end<len(coords) or
                start!=previous or type(seconds) not in (int,float) or
                not math.isfinite(seconds) or seconds<0):
                return None
            cumulative_time+=seconds
            if end>start:
                anchors.append({"pointIndex":offset+end,"elapsedSeconds":round(cumulative_time,3)})
            previous=end
        if previous!=len(coords)-1:
            return None
    if not flat or len(flat)<3:
        return None
    if abs(cumulative_time-total_seconds)>max(60,total_seconds*0.05):
        return None
    if anchors[-1]["pointIndex"]!=len(flat)-1:
        return None
    cumulative=[0.0]
    for a,b in zip(flat,flat[1:]):
        cumulative.append(cumulative[-1]+haversine_km(a,b))
    total=cumulative[-1]
    if not total>0.1:
        return None
    candidates=[a for a in anchors[1:-1] if a["pointIndex"]>0
                and a["pointIndex"]<len(flat)-1]
    if not candidates:
        return None
    middle=min(candidates,key=lambda a:abs(cumulative[a["pointIndex"]]-total/2))
    if abs(cumulative[middle["pointIndex"]]-total/2)>total*.25:
        return None
    anchors_out=[anchors[0],middle,anchors[-1]]
    if not (0<anchors_out[1]["elapsedSeconds"]<anchors_out[2]["elapsedSeconds"]):
        return None
    return [{
        "sampleId":i+1,
        "pointIndex":a["pointIndex"],
        "elapsedSeconds":a["elapsedSeconds"],
        "source":"VALHALLA_MANEUVER_BOUNDARY_ESTIMATE",
        "arrivalTimeUtc":None,
        "timeVerifiedAgainstObservations":False,
    } for i,a in enumerate(anchors_out)]
