# RainGuard Stage 4 — hydrology, wadis, road closure evidence readiness

The stage 4 module `truck_hydrology_evidence_gate.py` checks **provenance and completeness of evidence only**. It requires for each route segment independently reviewed and spatiotemporally matched evidence in five categories: validated DEM, wadi network, culvert inventory, flood-model validation and official road closure feed.

It rejects evidence records with missing provenance, expired validity, missing independent review, or unmatched segment. Even if every category is evidenced, the only outcome is `EVIDENCE_COMPLETE_REQUIRES_HUMAN_REVIEW`; **no automatic safe-route verdict, flood depth, flood probability or approved alternative** is emitted.

The repository does not yet contain these five independently verified input feeds for operational coverage. This stage has regression tests with explicitly synthetic samples; their results are not evidence of real-world effectiveness.

Next stage: negotiate/authorize NCM warnings and road closure feed access, ingest signed source records, confirm freshness, cover all relevant road segments, and develop human-review escalation and audit trail. Also validate a hydrological model against independently observed flood/water depth events. Never equate rainfall with road inundation.

`safeToDrive=null`, `alternativeRouteApproved=false`, `operationalWarningApproved=false` remain mandatory.
