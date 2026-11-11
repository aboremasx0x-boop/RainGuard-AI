# RainGuard AI — Unified Journey Evidence Report (prototype)

Added `truck_journey_evidence_report.py`: a **research-only, command-line report builder** which combines the existing segment ETA, hourly precipitation exposure, hydrology evidence and official-notice review modules.

The output is explicitly non-operational, structured JSON. Each returned road segment contains:

- Estimated arrival/start/end from a real provider's *per-section* ETA summary if supplied
- Rain exposure only when a separately verified representative road segment midpoint and contiguous hourly weather forecasts are provided
- Hydrological evidence completeness and outstanding requirements
- Official notices and reported closures, **not** proof that a road is open or safe
- Missing evidence and a human review requirement

The sample and CI tests use fabricated numbers, not actual Saudi route geometries or real-time NCM/roads feeds.

## Example invocation
```bash
python truck_journey_evidence_report.py \
  --input /private/reviewed_journey_payload.json \
  --output /private/journey_evidence_report.json
```

The input is provided by **trusted back-end systems only** and must be independently authenticated; the `independentlyVerified` or `ingestionAuthenticated` flags are merely *attestations* to validate upstream, not proof by themselves. This module must not be wired as a public route API accepting arbitrary client-supplied flags or authority registries.

**Never embed route tokens in public HTML. No route provider, NCM official alert feed, road closure service, or hydrological flood-risk model is connected by this addition.**

The report always retains `safeToDrive: null`, `alternativeRouteApproved: false`, `operationalWarningApproved: false`, `officialFeedsConnected: false`. Empty official alerts are not a clear-road verdict. Historic forecast accuracy/calibration also remains pending independent evidence.

## Next actual deployment milestones
1. Configure privately hosted and authenticated Valhalla with verified Saudi road tiles and legally appropriate restrictions, or authorized HERE; provide section-level geometry and ETA.
2. Verify road-segment geometry against real positions, not city-center markers or simply decoded lines.
3. Collect and archive issue-time hourly weather forecasts with trusted acquisition timestamps; join them to each real section's occupancy interval.
4. Secure real official closures, NCM warnings and validated hydrological flood/culvert datasets; obtain permissions and create audit controls.
5. Review on a non-driving pilot for Jeddah–Makkah under an official operating protocol. No driver action recommendations before approvals.

Related: `docs/stage7-pilot-readiness.md`.
