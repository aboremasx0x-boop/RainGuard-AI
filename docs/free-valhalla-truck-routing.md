# Free/open-source truck routes for RainGuard

**Chosen engine:** [Valhalla](https://github.com/valhalla/valhalla), which supports `costing: truck`, dimensional limits, truck-access tags, axle load, and hazmat tags. [Official vehicle options](https://valhalla.github.io/valhalla/api/route/api-reference/). OpenStreetMap data are licensed ODbL; follow attribution and share-alike requirements as applicable.

The adapter `valhalla_truck_routes.py` is installed but **OFF**. No HERE account, bank card, or third-party API key is required by the software itself. However, the user must obtain legitimate Saudi OSM data, build Valhalla routing tiles and **host** a private running Valhalla server. Hosting/build/maintenance may cost money even though software and OSM input are free. Public demonstration servers must not be used for repeated or operational queries.

Configure ONLY after operating a private service and implementing robust authentication, request quotas, SSRF/network firewall protection, logs and usage limits:
- `VALHALLA_TRUCK_BACKEND_URL`: server URL e.g. `http://127.0.0.1:8002` on the *same host* or a trusted `.internal` host (never user-supplied)
- `VALHALLA_TRUCK_ROUTING_ENABLED=true` to enable; default off
- `RAINGUARD_ROUTE_ACCESS_TOKEN`: a strong secret for **server-to-server** requests, never add to public frontend JavaScript/HTML.

Backend request `POST /api/truck-routes/valhalla`, header `X-RainGuard-Route-Token`; JSON origin/destination and heavy vehicle weight (tons), dimensions (meters), axle load (tons), axle count, hazmat status. The external API remains unavailable for untrusted browsers, even if it is deployed on Render. The service does not automatically provision tiles or routing infrastructure.

**Safety and coverage:** OSM restrictions are incomplete in many places. The returned route is a navigation estimate and must not be treated as evidence of flood safety or of open roads, or a legally permissible heavy-vehicle route. `safeToDrive` stays `null`, `alternativeRouteApproved` stays `false`. Access is restricted to a basic secret token, which is not sufficient as the only security measure for a production-public API. For national coverage, test all 13 regions with validated road access points and truck restrictions, then align segment geometry and travel time with verified rainfall and flood evidence.

Next step: deploy your own Valhalla server and build Saudi routing tiles in a separate service. Do not try to run a full nationwide routing engine in the existing Render free Python web process without validating compute and storage requirements.
