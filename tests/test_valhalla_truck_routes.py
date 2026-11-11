import os
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from valhalla_truck_routes import router, build_payload, RouteRequest, normalize_result, backend_url

app=FastAPI()
app.include_router(router)
client=TestClient(app)
request={
 "origin":{"lat":21.5433,"lon":39.1728},
 "destination":{"lat":24.7136,"lon":46.6753},
 "vehicle":{"gross_weight_tons":18,"height_meters":4,"width_meters":2.5,
            "length_meters":14,"axle_load_tons":8,"axle_count":5,"hazmat":False}
}

class Tests(unittest.TestCase):
 def test_disabled_by_default(self):
  with patch.dict(os.environ,{"VALHALLA_TRUCK_ROUTING_ENABLED":"false","VALHALLA_TRUCK_BACKEND_URL":"http://127.0.0.1:8002","RAINGUARD_ROUTE_ACCESS_TOKEN":"secret"}):
   response=client.post("/api/truck-routes/valhalla",json=request)
  self.assertEqual(response.status_code,503)

 def test_private_backend_only(self):
  with patch.dict(os.environ,{"VALHALLA_TRUCK_BACKEND_URL":"https://public.example/"}):
   self.assertIsNone(backend_url())
  with patch.dict(os.environ,{"VALHALLA_TRUCK_BACKEND_URL":"http://127.0.0.1:8002"}):
   self.assertEqual(backend_url(),"http://127.0.0.1:8002/route")
  with patch.dict(os.environ,{"VALHALLA_TRUCK_BACKEND_URL":"http://169.254.169.254"}):
   self.assertIsNone(backend_url())

 def test_token_required(self):
  with patch.dict(os.environ,{"VALHALLA_TRUCK_ROUTING_ENABLED":"true","VALHALLA_TRUCK_BACKEND_URL":"http://127.0.0.1:8002","RAINGUARD_ROUTE_ACCESS_TOKEN":"secret"}):
   response=client.post("/api/truck-routes/valhalla",json=request)
  self.assertEqual(response.status_code,403)

 def test_uses_truck_costing(self):
  data=build_payload(RouteRequest(**request))
  self.assertEqual(data["costing"],"truck")
  self.assertEqual(data["costing_options"]["truck"]["weight"],18)
  self.assertEqual(data["costing_options"]["truck"]["height"],4)
  self.assertEqual(data["costing_options"]["truck"]["hgv_no_access_penalty"],43200)

 def test_normalize_never_claims_safe(self):
  out=normalize_result({"trip":{"summary":{"length":70.5,"time":3600},"legs":[{"shape":"encodedShape"}]}})
  self.assertEqual(out["distanceKm"],70.5)
  self.assertEqual(out["estimatedTravelMinutes"],60)
  self.assertIsNone(out["safeToDrive"])
  self.assertFalse(out["alternativeRouteApproved"])
  self.assertEqual(out["restrictionsCoverage"],"UNKNOWN_OSM_COMPLETENESS")

 def test_empty_routes_rejected(self):
  with self.assertRaisesRegex(ValueError,"MISSING_TRIP"):
   normalize_result({})
  with self.assertRaisesRegex(ValueError,"INVALID_ROUTE_SHAPE"):
   normalize_result({"trip":{"summary":{"length":20,"time":120},"legs":[{"shape":""}]}})

 def test_invalid_truck_rejected(self):
  malformed={**request,"vehicle":{**request["vehicle"],"height_meters":0}}
  self.assertEqual(client.post("/api/truck-routes/valhalla",json=malformed).status_code,422)

if __name__=="__main__":unittest.main()
