import importlib.util
import json
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from export_public_valhalla_route_geojson import decode_polyline6,extract_geojson,request_once,validate_geojson,ENDPOINT

def encode(points):
    last_lat=last_lon=0
    output=""
    for lat,lon in points:
        ilat,ilon=round(lat*1e6),round(lon*1e6)
        for delta in (ilat-last_lat,ilon-last_lon):
            num=(delta<<1) if delta>=0 else ((-delta<<1)-1)
            while num>=32:
                output+=chr((32|(num&31))+63)
                num>>=5
            output+=chr(num+63)
        last_lat,last_lon=ilat,ilon
    return output

class Response:
    status=200
    def __init__(self,payload):
        self.raw=json.dumps(payload).encode()
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,n):return self.raw[:n]

class TestDemoExport(unittest.TestCase):
    def setUp(self):
        shape=encode([(21.5433,39.1728),(21.49,39.4),(21.3891,39.8579)])
        self.payload={"trip":{"summary":{"length":91.8,"time":4116},
                              "legs":[{"shape":shape}]}}

    def test_geometry_export_contains_real_decoded_points(self):
        result=extract_geojson(self.payload)
        self.assertEqual(result["type"],"FeatureCollection")
        self.assertEqual(len(result["features"][0]["geometry"]["coordinates"]),3)
        self.assertEqual(result["features"][0]["geometry"]["coordinates"][0],[39.1728,21.5433])
        self.assertEqual(result["features"][0]["properties"]["distanceKm"],91.8)
        self.assertEqual(result["features"][0]["properties"]["estimatedTravelMinutes"],68.6)
        self.assertTrue(validate_geojson(result))
        self.assertIsNone(result["safeToDrive"])
        self.assertFalse(result["operationalWarningApproved"])

    def test_single_request_without_redirects_or_auth_headers(self):
        calls=[]
        def fake(request,timeout):
            calls.append((request,timeout))
            return Response(self.payload)
        result=request_once(fake)
        self.assertEqual(len(calls),1)
        req,timeout=calls[0]
        self.assertEqual(timeout,15)
        self.assertEqual(req.full_url,ENDPOINT)
        self.assertEqual(req.get_method(),"POST")
        self.assertNotIn("Authorization",req.headers)
        self.assertEqual(result["features"][0]["geometry"]["coordinates"][-1],[39.8579,21.3891])

    def test_invalid_geometry_never_produces_straight_fake_line(self):
        for value in (None,"", "abc","!", "\\", "????????"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    decode_polyline6(value)
        for bad in ({"trip":{"summary":{"length":80,"time":4000},"legs":[{}]}},
                    {"trip":{"summary":{"length":80,"time":4000},"legs":[]}},
                    {"trip":{"summary":{"length":0,"time":4000},"legs":self.payload["trip"]["legs"]}}):
            with self.subTest(payload=bad),self.assertRaises(ValueError):
                extract_geojson(bad)

    def test_rejects_unsafe_flags_and_outside_saudi(self):
        result=extract_geojson(self.payload)
        result["safeToDrive"]=True
        with self.assertRaises(ValueError):validate_geojson(result)
        result["safeToDrive"]=None
        result["features"][0]["geometry"]["coordinates"][0]=[10.1,2.1]
        with self.assertRaises(ValueError):validate_geojson(result)

if __name__=="__main__":
    unittest.main()
