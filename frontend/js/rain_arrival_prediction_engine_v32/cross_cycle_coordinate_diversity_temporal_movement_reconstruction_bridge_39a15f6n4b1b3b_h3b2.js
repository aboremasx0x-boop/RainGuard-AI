(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3B2";
  const VERSION = "39A.15F6N4B1B3B-H3B2.0";
  const BUILD = "rainguard-v39-cross-cycle-coordinate-diversity-temporal-movement-reconstruction-bridge";

  if (global.__RainGuardN4B1B3BH3B2Installed) return;
  global.__RainGuardN4B1B3BH3B2Installed = true;

  const state = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null
  };

  function isObj(v){ return !!v && typeof v === "object"; }
  function str(v){ try { return v == null ? "" : String(v); } catch(_) { return ""; } }
  function norm(v){ return str(v).trim().toLowerCase().replace(/\s+/g," "); }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

  function tsOf(r){
    if(!isObj(r)) return null;
    const vals = [
      r.timestamp, r.timestampMs, r.observedAt, r.observationTime, r.observationTimestamp,
      r.capturedAt, r.captureTime, r.generatedAt, r.updatedAt, r.createdAt, r.time,
      r.datetime, r.dateTime, r.scanTimestamp, r.cycleTimestamp, r.lastSeenAt
    ];
    for(const v of vals){
      if(v == null || v === "") continue;
      if(typeof v === "number" && Number.isFinite(v)){
        if(v > 1e12) return Math.round(v);
        if(v > 1e9) return Math.round(v * 1000);
      }
      if(typeof v === "string"){
        const z = v.trim();
        if(/^\d{13,}$/.test(z)) return Number(z.slice(0,13));
        if(/^\d{10}$/.test(z)) return Number(z) * 1000;
        const p = Date.parse(z);
        if(Number.isFinite(p)) return p;
      }
    }
    return null;
  }

  function cycleOf(r){
    if(!isObj(r)) return "";
    const vals = [
      r.cycleId, r.cycleID, r.cycle, r.cycleKey, r.scanCycleId,
      r.forecastCycleId, r.trackingCycleId, r.runtimeCycleId,
      r.sequenceId, r.cycleSequence
    ];
    for(const v of vals){
      const x = str(v).trim();
      if(x) return x;
    }
    return "";
  }

  function coordOf(r){
    if(!isObj(r)) return null;

    const lat = num(
      r.latitude ?? r.lat ??
      (r.coordinate && (r.coordinate.latitude ?? r.coordinate.lat)) ??
      (r.coordinates && (r.coordinates.latitude ?? r.coordinates.lat)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[0] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[0] : undefined)
    );

    const lon = num(
      r.longitude ?? r.lon ?? r.lng ??
      (r.coordinate && (r.coordinate.longitude ?? r.coordinate.lon ?? r.coordinate.lng)) ??
      (r.coordinates && (r.coordinates.longitude ?? r.coordinates.lon ?? r.coordinates.lng)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[1] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[1] : undefined)
    );

    if(lat === null || lon === null) return null;
    if(lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {lat, lon};
  }

  function idOf(r, fallback){
    if(!isObj(r)) return norm(fallback);
    const vals = [
      r.identity, r.authoritativeIdentity, r.persistentId, r.canonicalPersistentId,
      r.canonicalIdentity, r.identityKey, r.trackId, r.cellId, r.stormId, r.entityId, r.id
    ];
    for(const v of vals){
      const x = norm(v);
      if(x) return x;
    }
    return norm(fallback);
  }

  function aliasesOf(r){
    if(!isObj(r)) return [];
    const out = new Set();
    const add = v => {
      const x = norm(v);
      if(x) out.add(x);
    };

    add(r.identity);
    add(r.authoritativeIdentity);
    add(r.persistentId);
    add(r.canonicalPersistentId);
    add(r.canonicalIdentity);
    add(r.identityKey);
    add(r.trackId);
    add(r.cellId);
    add(r.stormId);
    add(r.entityId);
    add(r.id);

    if(Array.isArray(r.aliases)){
      for(const a of r.aliases){
        add(isObj(a) ? (a.id ?? a.alias ?? a.identity ?? a.key) : a);
      }
    }

    return [...out];
  }

  function obsOf(rec){
    if(!isObj(rec)) return [];
    const keys = ["observations","history","temporalSequence","points","records","samples","timeline"];
    for(const k of keys){
      if(Array.isArray(rec[k])) return rec[k].slice();
    }
    return [];
  }

  function haversineMeters(a,b){
    if(!a || !b) return null;
    const R = 6371000;
    const p1 = a.lat * Math.PI/180;
    const p2 = b.lat * Math.PI/180;
    const dp = (b.lat-a.lat) * Math.PI/180;
    const dl = (b.lon-a.lon) * Math.PI/180;
    const h = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  function bearingDegrees(a,b){
    if(!a || !b) return null;
    const p1 = a.lat * Math.PI/180;
    const p2 = b.lat * Math.PI/180;
    const dl = (b.lon-a.lon) * Math.PI/180;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1)*Math.sin(p2) - Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return (Math.atan2(y,x) * 180/Math.PI + 360) % 360;
  }

  function source(){
    const preferred = [
      ["RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39", global.RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39],
      ["RainGuardN4B1B3BH3BCanonicalTemporalSourceV39", global.RainGuardN4B1B3BH3BCanonicalTemporalSourceV39],
      ["RainGuardN4B1B3BH3RecoveredTemporalSourceV39", global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39],
      ["RainGuardH2ACanonicalTemporalSourceForH3V39", global.RainGuardH2ACanonicalTemporalSourceForH3V39],
      ["RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39", global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39]
    ];

    for(const [name, value] of preferred){
      if(isObj(value) && isObj(value.identities) && Object.keys(value.identities).length){
        return {name, root:value, identities:value.identities};
      }
    }

    return null;
  }

  function discoverLiveSources(){
    const preferred = [
      "RainArrivalLiveStormEntities",
      "RainArrivalStableStormEntities",
      "RainGuardStableStormEntities",
      "RainArrivalLiveTrackHistory",
      "RainGuardLiveTrackHistory",
      "RainArrivalLiveStormEntities",
      "RainGuardLiveStormEntities",
      "RainGuardNestedCoordinateRecordsV39"
    ];

    let keys = [];
    try { keys = Object.keys(global).slice(0,25000); } catch(_) {}

    const dynamic = keys.filter(k =>
      /rain|storm|track|entity|history|radar|cell|coordinate/i.test(k) &&
      !/h3b2|result|diagnostic|canonicaltemporalsource/i.test(k) &&
      typeof global[k] !== "function"
    );

    return [...new Set([...preferred,...dynamic])]
      .filter(name => global[name] != null)
      .map(name => ({name, value:global[name]}));
  }

  function flattenLiveEvidence(){
    const rows = [];
    const srcs = discoverLiveSources();

    function push(rec, sourceName, inheritedId){
      if(!isObj(rec)) return;
      const c = coordOf(rec);
      if(!c) return;

      const ids = new Set(aliasesOf(rec));
      if(inheritedId) ids.add(norm(inheritedId));

      rows.push({
        sourceName,
        identity: idOf(rec, inheritedId || ""),
        aliases:[...ids].filter(Boolean),
        timestamp: tsOf(rec),
        cycleId: cycleOf(rec),
        lat:c.lat,
        lon:c.lon,
        raw:rec
      });
    }

    function walk(v, sourceName, depth, inheritedId){
      if(depth > 5 || !v) return;

      if(v instanceof Map){
        let count = 0;
        for(const [k, rec] of v.entries()){
          if(++count > 10000) break;
          if(!isObj(rec)) continue;
          const iid = idOf(rec,k);
          push(rec,sourceName,iid);
          for(const key of ["observations","history","points","temporalSequence"]){
            if(Array.isArray(rec[key])){
              for(const o of rec[key].slice(0,3000)) push(o,sourceName,iid);
            }
          }
        }
        return;
      }

      if(Array.isArray(v)){
        for(const rec of v.slice(0,10000)){
          if(!isObj(rec)) continue;
          const iid = idOf(rec,inheritedId||"");
          push(rec,sourceName,iid);
          for(const key of ["observations","history","points","temporalSequence"]){
            if(Array.isArray(rec[key])){
              for(const o of rec[key].slice(0,3000)) push(o,sourceName,iid);
            }
          }
        }
        return;
      }

      if(!isObj(v)) return;

      if(isObj(v.identities)){
        walk(v.identities,sourceName,depth+1,inheritedId);
        return;
      }

      let count = 0;
      for(const [k, rec] of Object.entries(v)){
        if(++count > 10000) break;
        if(!isObj(rec)) continue;

        const iid = idOf(rec,k || inheritedId || "");
        push(rec,sourceName,iid);

        for(const key of ["observations","history","points","temporalSequence"]){
          if(Array.isArray(rec[key])){
            for(const o of rec[key].slice(0,3000)) push(o,sourceName,iid);
          }
        }
      }
    }

    for(const src of srcs){
      try { walk(src.value,src.name,0,""); } catch(_) {}
    }

    return {rows, sourceNames:srcs.map(s=>s.name)};
  }

  function buildIdentityAliasIndex(identities){
    const idx = new Map();

    for(const [key, rec] of Object.entries(identities || {})){
      if(!isObj(rec)) continue;

      const canonicalId = idOf(rec,key);
      const set = new Set([canonicalId,norm(key),...aliasesOf(rec)]);

      for(const o of obsOf(rec)){
        for(const a of aliasesOf(o)) set.add(a);
      }

      for(const alias of set){
        if(!alias) continue;
        if(!idx.has(alias)) idx.set(alias,new Set());
        idx.get(alias).add(canonicalId);
      }
    }

    return idx;
  }

  function evidenceForIdentity(canonicalId, rec, allEvidence, aliasIndex){
    const aliases = new Set([canonicalId,...aliasesOf(rec)]);

    for(const o of obsOf(rec)){
      for(const a of aliasesOf(o)) aliases.add(a);
    }

    const out = [];

    for(const ev of allEvidence){
      let matched = false;

      for(const a of ev.aliases){
        if(aliases.has(a)){
          matched = true;
          break;
        }

        const mapped = aliasIndex.get(a);
        if(mapped && mapped.has(canonicalId)){
          matched = true;
          break;
        }
      }

      if(matched) out.push(ev);
    }

    return out;
  }

  function distinctEvidenceSequence(evidence){
    const sorted = evidence.slice().sort((a,b)=>{
      const ta = a.timestamp, tb = b.timestamp;

      if(ta != null && tb != null && ta !== tb) return ta-tb;

      const ca = str(a.cycleId), cb = str(b.cycleId);
      if(ca && cb && ca !== cb) return ca.localeCompare(cb);

      return 0;
    });

    const out = [];
    const seen = new Set();

    for(const e of sorted){
      const key = [
        e.cycleId || "",
        e.timestamp || "",
        e.lat.toFixed(7),
        e.lon.toFixed(7),
        e.sourceName
      ].join("|");

      if(seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }

    return out;
  }

  function coordKey(c){
    return c ? `${c.lat.toFixed(7)},${c.lon.toFixed(7)}` : "";
  }

  function buildMovementPairs(observations, minMovementMeters){
    const sorted = observations.slice().sort((a,b)=>{
      const ta = tsOf(a), tb = tsOf(b);
      if(ta != null && tb != null && ta !== tb) return ta-tb;

      const ca = cycleOf(a), cb = cycleOf(b);
      if(ca && cb && ca !== cb) return ca.localeCompare(cb);

      return 0;
    });

    const pairs = [];

    for(let i=1;i<sorted.length;i++){
      const a = sorted[i-1];
      const b = sorted[i];
      const ca = coordOf(a);
      const cb = coordOf(b);

      if(!ca || !cb) continue;

      const distanceMeters = haversineMeters(ca,cb);
      if(distanceMeters == null) continue;

      const ta = tsOf(a), tb = tsOf(b);
      const dtMs = (ta != null && tb != null) ? (tb-ta) : null;
      const validTemporalOrder = dtMs == null ? true : dtMs > 0;
      const coordinateChanged = distanceMeters >= minMovementMeters;

      pairs.push({
        fromIndex:i-1,
        toIndex:i,
        fromCycleId:cycleOf(a),
        toCycleId:cycleOf(b),
        fromTimestamp:ta,
        toTimestamp:tb,
        dtMs,
        fromLat:ca.lat,
        fromLon:ca.lon,
        toLat:cb.lat,
        toLon:cb.lon,
        distanceMeters,
        bearingDegrees:bearingDegrees(ca,cb),
        coordinateChanged,
        validTemporalOrder
      });
    }

    return pairs;
  }

  function reconstructIdentity(canonicalId, rec, evidence, opts){
    const existing = obsOf(rec).map(o => Object.assign({},o));
    const live = distinctEvidenceSequence(evidence);

    const byTemporalKey = new Map();

    function temporalKey(o){
      const t = tsOf(o);
      const c = cycleOf(o);
      if(t != null) return `t:${t}`;
      if(c) return `c:${c}`;
      return "";
    }

    for(const o of existing){
      const k = temporalKey(o);
      if(k && !byTemporalKey.has(k)) byTemporalKey.set(k,o);
    }

    let replaced = 0;
    let appended = 0;
    let diverseRecovered = 0;
    let maxMovement = 0;

    for(const ev of live){
      const temporal = ev.timestamp != null ? `t:${ev.timestamp}` : (ev.cycleId ? `c:${ev.cycleId}` : "");

      if(temporal && byTemporalKey.has(temporal)){
        const target = byTemporalKey.get(temporal);
        const oldCoord = coordOf(target);
        const newCoord = {lat:ev.lat,lon:ev.lon};
        const d = oldCoord ? haversineMeters(oldCoord,newCoord) : null;

        if(!oldCoord || (d != null && d >= opts.minMovementMeters)){
          target.latitude = ev.lat;
          target.longitude = ev.lon;
          target.lat = ev.lat;
          target.lon = ev.lon;
          target.lng = ev.lon;
          target.coordinate = {latitude:ev.lat,longitude:ev.lon};
          target.sourceName = ev.sourceName;
          target.__n4b1b3bH3B2 = {
            reconstructed:true,
            method:"TEMPORAL_KEY_REPLACEMENT",
            evidenceSource:ev.sourceName,
            sourceTimestamp:ev.timestamp,
            sourceCycleId:ev.cycleId,
            previousCoordinate:oldCoord,
            recoveredCoordinate:newCoord,
            displacementMeters:d
          };

          replaced++;
          if(d != null){
            maxMovement = Math.max(maxMovement,d);
            if(d >= opts.minMovementMeters) diverseRecovered++;
          }
        }

      } else if(opts.allowTemporalAppend) {
        const obs = {
          identity:canonicalId,
          authoritativeIdentity:canonicalId,
          cycleId:ev.cycleId || "",
          timestamp:ev.timestamp,
          latitude:ev.lat,
          longitude:ev.lon,
          lat:ev.lat,
          lon:ev.lon,
          lng:ev.lon,
          coordinate:{latitude:ev.lat,longitude:ev.lon},
          sourceName:ev.sourceName,
          __n4b1b3bH3B2:{
            reconstructed:true,
            method:"CROSS_CYCLE_LIVE_APPEND",
            evidenceSource:ev.sourceName
          }
        };

        existing.push(obs);
        if(temporal) byTemporalKey.set(temporal,obs);
        appended++;
      }
    }

    // Strong de-duplication: same timestamp/cycle + same coordinate.
    const deduped = [];
    const seen = new Set();

    for(const o of existing.slice().sort((a,b)=>{
      const ta = tsOf(a), tb = tsOf(b);
      if(ta != null && tb != null && ta !== tb) return ta-tb;

      const ca = cycleOf(a), cb = cycleOf(b);
      if(ca && cb && ca !== cb) return ca.localeCompare(cb);

      return 0;
    })){
      const c = coordOf(o);
      const key = [
        tsOf(o) ?? "",
        cycleOf(o) || "",
        c ? c.lat.toFixed(7) : "",
        c ? c.lon.toFixed(7) : ""
      ].join("|");

      if(seen.has(key)) continue;
      seen.add(key);
      deduped.push(o);
    }

    const uniqueCoords = new Set();
    for(const o of deduped){
      const c = coordOf(o);
      if(c) uniqueCoords.add(coordKey(c));
    }

    const movementPairs = buildMovementPairs(deduped,opts.minMovementMeters);
    const validMovementPairs = movementPairs.filter(p =>
      p.coordinateChanged && p.validTemporalOrder
    );

    for(const p of validMovementPairs){
      maxMovement = Math.max(maxMovement,p.distanceMeters || 0);
    }

    return {
      observations:deduped,
      evidenceCount:live.length,
      replaced,
      appended,
      uniqueCoordinateCount:uniqueCoords.size,
      coordinateChanging:uniqueCoords.size >= 2,
      movementPairs,
      validMovementPairs,
      validMovementPairCount:validMovementPairs.length,
      maxMovementMeters:maxMovement,
      diverseRecovered
    };
  }

  async function run(options){
    const startedAt = Date.now();

    if(state.running){
      return {
        success:false,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:"H3B2_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try{
      const opts = Object.assign({
        minMovementMeters:250,
        allowTemporalAppend:true,
        invokeH3B3B:false,
        logTable:true,
        tableLimit:60
      }, options || {});

      const src = source();

      if(!src){
        const result = {
          success:false,
          phase:PHASE,
          version:VERSION,
          build:BUILD,
          status:"NO_H3B1_CANONICAL_TEMPORAL_SOURCE_AVAILABLE",
          generatedAt:Date.now(),
          durationMs:Date.now()-startedAt
        };

        state.lastRun = result;
        state.lastError = result.status;
        return result;
      }

      const live = flattenLiveEvidence();
      const aliasIndex = buildIdentityAliasIndex(src.identities);

      let identityCount = 0;
      let identitiesWithEvidence = 0;
      let coordinateChangingIdentityCountBefore = 0;
      let coordinateChangingIdentityCountAfter = 0;
      let multiPointIdentityCountBefore = 0;
      let multiPointIdentityCountAfter = 0;
      let reconstructedObservationCount = 0;
      let replacedCoordinateCount = 0;
      let appendedObservationCount = 0;
      let validTemporalMovementPairCount = 0;
      let maxRecoveredMovementMeters = 0;
      let maxObservedPointsPerIdentityBefore = 0;
      let maxObservedPointsPerIdentityAfter = 0;

      const repaired = {};
      const audit = [];

      for(const [key, rec] of Object.entries(src.identities || {})){
        if(!isObj(rec)) continue;

        const canonicalId = idOf(rec,key);
        if(!canonicalId) continue;

        identityCount++;

        const beforeObs = obsOf(rec);
        const beforeCoords = new Set();

        for(const o of beforeObs){
          const c = coordOf(o);
          if(c) beforeCoords.add(coordKey(c));
        }

        if(beforeCoords.size >= 2) coordinateChangingIdentityCountBefore++;
        if(beforeObs.length >= 2) multiPointIdentityCountBefore++;

        maxObservedPointsPerIdentityBefore = Math.max(
          maxObservedPointsPerIdentityBefore,
          beforeObs.length
        );

        const evidence = evidenceForIdentity(canonicalId,rec,live.rows,aliasIndex);

        if(evidence.length) identitiesWithEvidence++;

        const r = reconstructIdentity(canonicalId,rec,evidence,opts);

        if(r.coordinateChanging) coordinateChangingIdentityCountAfter++;
        if(r.observations.length >= 2) multiPointIdentityCountAfter++;

        maxObservedPointsPerIdentityAfter = Math.max(
          maxObservedPointsPerIdentityAfter,
          r.observations.length
        );

        replacedCoordinateCount += r.replaced;
        appendedObservationCount += r.appended;
        reconstructedObservationCount += r.replaced + r.appended;
        validTemporalMovementPairCount += r.validMovementPairCount;
        maxRecoveredMovementMeters = Math.max(maxRecoveredMovementMeters,r.maxMovementMeters);

        repaired[canonicalId] = Object.assign({},rec,{
          identity:canonicalId,
          observations:r.observations,
          history:r.observations,
          temporalSequence:r.observations,
          movementPairs:r.movementPairs,
          validMovementPairs:r.validMovementPairs,
          coordinateChanging:r.coordinateChanging,
          uniqueCoordinateCount:r.uniqueCoordinateCount,
          h3b2MovementReconstructed:true
        });

        if(audit.length < opts.tableLimit){
          audit.push({
            identity:canonicalId,
            beforeObs:beforeObs.length,
            afterObs:r.observations.length,
            evidence:r.evidenceCount,
            uniqueCoordinates:r.uniqueCoordinateCount,
            replaced:r.replaced,
            appended:r.appended,
            validMovementPairs:r.validMovementPairCount,
            maxMovementMeters:Math.round(r.maxMovementMeters)
          });
        }
      }

      const published = {
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        sourceName:src.name,
        generatedAt:Date.now(),
        identities:repaired
      };

      global.RainGuardN4B1B3BH3B2MovementReadyTemporalSourceV39 = published;
      global.RainGuardN4B1B3BH3BCanonicalTemporalSourceV39 = published;
      global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39 = published;
      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = published;
      global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = published.identities;
      global.RainGuardH2RuntimeBoundTemporalSourceV39 = published;

      const movementRecoveryGatePassed =
        coordinateChangingIdentityCountAfter > 0 &&
        validTemporalMovementPairCount > 0 &&
        maxRecoveredMovementMeters > 0;

      let status = "TEMPORAL_MOVEMENT_RECONSTRUCTION_COMPLETED_NO_VALID_MOVEMENT";

      if(movementRecoveryGatePassed){
        status = "CROSS_CYCLE_COORDINATE_DIVERSITY_AND_TEMPORAL_MOVEMENT_RECOVERED";
      }else if(identitiesWithEvidence > 0){
        status = "LIVE_EVIDENCE_BOUND_BUT_COORDINATE_DIVERSITY_NOT_YET_RECOVERED";
      }

      const result = {
        success:true,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status,

        selectedCanonicalSource:src.name,

        liveEvidenceSourceCount:live.sourceNames.length,
        liveEvidenceSourceNames:live.sourceNames.slice(0,50),
        liveEvidenceRecordCount:live.rows.length,

        identityCount,
        identitiesWithEvidence,

        multiPointIdentityCountBefore,
        multiPointIdentityCountAfter,
        maxObservedPointsPerIdentityBefore,
        maxObservedPointsPerIdentityAfter,

        coordinateChangingIdentityCountBefore,
        coordinateChangingIdentityCountAfter,

        reconstructedObservationCount,
        replacedCoordinateCount,
        appendedObservationCount,

        validTemporalMovementPairCount,
        maxRecoveredMovementMeters:Math.round(maxRecoveredMovementMeters),

        movementRecoveryGatePassed,

        movementReadyTemporalSourcePublished:true,
        crossCycleAccumulatorRepublished:true,
        h2RuntimeSourceRepublished:true,

        auditSample:audit,

        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      global.RainGuardN4B1B3BH3B2ResultV39 = result;

      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Coordinate Diversity & Temporal Movement Reconstruction result:`);
      console.log(result);

      if(opts.logTable && console.table){
        try { console.table(audit); } catch(_) {}
      }

      return result;

    }catch(e){
      const result = {
        success:false,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:"H3B2_TEMPORAL_MOVEMENT_RECONSTRUCTION_FAILED",
        error:e && e.message ? e.message : str(e),
        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      state.lastRun = result;
      state.lastError = result.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return result;

    }finally{
      state.running = false;
    }
  }

  function diagnose(){
    const src = source();

    const result = {
      success:true,
      phase:PHASE,
      version:VERSION,
      build:BUILD,
      installed:true,
      running:state.running,
      runs:state.runs,
      canonicalSourceAvailable:!!src,
      canonicalSourceName:src ? src.name : null,
      lastError:state.lastError,
      lastRun:state.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result);
    return result;
  }

  global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge = run;
  global.diagnoseRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge = diagnose;

  global.RainGuardN4B1B3BH3B2BridgeV39 = {
    phase:PHASE,
    version:VERSION,
    build:BUILD,
    run,
    diagnose,
    state
  };

})(window);
