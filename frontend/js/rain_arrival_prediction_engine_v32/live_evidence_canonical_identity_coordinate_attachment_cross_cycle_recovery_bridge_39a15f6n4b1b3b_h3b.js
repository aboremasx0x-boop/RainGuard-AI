(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3B";
  const VERSION = "39A.15F6N4B1B3B-H3B.0";
  const BUILD = "rainguard-v39-live-evidence-canonical-identity-coordinate-attachment-cross-cycle-recovery-bridge";

  if (global.__RainGuardN4B1B3BH3BInstalled) return;
  global.__RainGuardN4B1B3BH3BInstalled = true;

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
  function num(v){ const x = Number(v); return Number.isFinite(x) ? x : null; }

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

  function aliasList(r){
    if(!isObj(r)) return [];
    const out = new Set();
    const push = v => {
      const x = norm(v);
      if(x) out.add(x);
    };

    push(r.identity);
    push(r.authoritativeIdentity);
    push(r.persistentId);
    push(r.canonicalPersistentId);
    push(r.canonicalIdentity);
    push(r.identityKey);
    push(r.trackId);
    push(r.cellId);
    push(r.stormId);
    push(r.entityId);
    push(r.id);

    if(Array.isArray(r.aliases)){
      for(const a of r.aliases) push(isObj(a) ? (a.id ?? a.alias ?? a.identity ?? a.key) : a);
    }

    return [...out];
  }

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

  function observationsOf(rec){
    if(!isObj(rec)) return [];
    if(Array.isArray(rec.observations)) return rec.observations.slice();
    if(Array.isArray(rec.history)) return rec.history.slice();
    if(Array.isArray(rec.temporalSequence)) return rec.temporalSequence.slice();
    if(Array.isArray(rec.points)) return rec.points.slice();
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

  function canonicalSource(){
    const candidates = [
      ["RainGuardN4B1B3BH3RecoveredTemporalSourceV39", global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39],
      ["RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39", global.RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39],
      ["RainGuardH2ACanonicalTemporalSourceForH3V39", global.RainGuardH2ACanonicalTemporalSourceForH3V39],
      ["RainGuardN4B1B3BH2TemporalSequenceRepairV39", global.RainGuardN4B1B3BH2TemporalSequenceRepairV39],
      ["RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39", global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39],
      ["RainGuardH2RuntimeBoundTemporalSourceV39", global.RainGuardH2RuntimeBoundTemporalSourceV39]
    ];

    for(const [name, value] of candidates){
      if(isObj(value) && isObj(value.identities)){
        return {name, root:value, identities:value.identities};
      }
    }

    return null;
  }

  function discoverLiveObjects(){
    const preferred = [
      "RainArrivalStableStormEntities",
      "RainGuardStableStormEntities",
      "RainArrivalLiveTrackHistory",
      "RainGuardLiveTrackHistory",
      "RainArrivalLiveStormEntities",
      "RainGuardLiveStormEntities"
    ];

    let keys = [];
    try { keys = Object.keys(global).slice(0,20000); } catch(_) {}

    const dynamic = keys.filter(k =>
      /live|storm|track|entity|radar|rain|cell|history/i.test(k) &&
      !/h3b|result|diagnostic|canonical|temporalappendoverride/i.test(k) &&
      typeof global[k] !== "function"
    );

    return [...new Set([...preferred, ...dynamic])]
      .filter(name => global[name] != null)
      .map(name => ({name, value:global[name]}));
  }

  function collectLiveEvidence(){
    const evidence = [];
    const sources = discoverLiveObjects();

    function push(rec, sourceName, inheritedId){
      if(!isObj(rec)) return;

      const coord = coordOf(rec);
      if(!coord) return;

      const ids = aliasList(rec);
      if(inheritedId) ids.push(norm(inheritedId));

      evidence.push({
        sourceName,
        ids: [...new Set(ids.filter(Boolean))],
        identity: idOf(rec, inheritedId || ""),
        timestamp: tsOf(rec),
        cycleId: cycleOf(rec),
        lat: coord.lat,
        lon: coord.lon,
        raw: rec
      });
    }

    function walk(value, sourceName, depth, inheritedId){
      if(depth > 4 || !value) return;

      if(Array.isArray(value)){
        for(const rec of value.slice(0,8000)){
          if(!isObj(rec)) continue;
          const iid = idOf(rec, inheritedId || "");
          push(rec, sourceName, iid);

          for(const key of ["observations","history","points","temporalSequence"]){
            if(Array.isArray(rec[key])){
              for(const obs of rec[key].slice(0,2500)){
                push(obs, sourceName, iid);
              }
            }
          }
        }
        return;
      }

      if(!isObj(value)) return;

      if(isObj(value.identities)){
        walk(value.identities, sourceName, depth+1, inheritedId);
        return;
      }

      let count = 0;
      for(const [k, rec] of Object.entries(value)){
        if(++count > 8000) break;
        if(!isObj(rec)) continue;

        const iid = idOf(rec, k || inheritedId || "");
        push(rec, sourceName, iid);

        for(const key of ["observations","history","points","temporalSequence"]){
          if(Array.isArray(rec[key])){
            for(const obs of rec[key].slice(0,2500)){
              push(obs, sourceName, iid);
            }
          }
        }
      }
    }

    for(const src of sources){
      try { walk(src.value, src.name, 0, ""); } catch(_) {}
    }

    return {evidence, sourceNames:sources.map(s=>s.name)};
  }

  function buildAliasIndex(canonicalIdentities){
    const index = new Map();

    for(const [key, rec] of Object.entries(canonicalIdentities || {})){
      if(!isObj(rec)) continue;

      const canonicalId = idOf(rec, key);
      const aliases = new Set([canonicalId, norm(key), ...aliasList(rec)]);

      for(const obs of observationsOf(rec)){
        for(const a of aliasList(obs)) aliases.add(a);
      }

      for(const alias of aliases){
        if(!alias) continue;
        if(!index.has(alias)) index.set(alias, new Set());
        index.get(alias).add(canonicalId);
      }
    }

    return index;
  }

  function scoreEvidence(canonicalId, canonicalRec, obs, live, aliasIndex){
    let score = 0;

    const canonicalAliases = new Set([
      canonicalId,
      ...aliasList(canonicalRec),
      ...aliasList(obs)
    ]);

    let aliasMatched = false;

    for(const lid of live.ids){
      if(canonicalAliases.has(lid)){
        score += 1000;
        aliasMatched = true;
        break;
      }

      const mapped = aliasIndex.get(lid);
      if(mapped && mapped.has(canonicalId)){
        score += 900;
        aliasMatched = true;
        break;
      }
    }

    const ct = tsOf(obs);
    const lt = live.timestamp;
    if(ct !== null && lt !== null){
      const dt = Math.abs(ct-lt);
      if(dt <= 60*1000) score += 500;
      else if(dt <= 5*60*1000) score += 350;
      else if(dt <= 15*60*1000) score += 200;
      else if(dt <= 60*60*1000) score += 50;
      else score -= 100;
    }

    const cc = cycleOf(obs);
    const lc = live.cycleId;
    if(cc && lc){
      if(cc === lc) score += 500;
      else score -= 50;
    }

    const stored = coordOf(obs);
    if(stored){
      const d = haversineMeters(stored,{lat:live.lat,lon:live.lon});
      if(d !== null){
        if(d <= 250) score += 25;
        else if(d <= 5000) score += 15;
        else if(d <= 50000) score += 5;
      }
    }

    if(!aliasMatched && !(ct !== null && lt !== null) && !(cc && lc)) return -Infinity;
    return score;
  }

  function bestEvidence(canonicalId, canonicalRec, obs, allEvidence, aliasIndex, threshold){
    let best = null;
    let bestScore = -Infinity;

    for(const live of allEvidence){
      const score = scoreEvidence(canonicalId, canonicalRec, obs, live, aliasIndex);
      if(score > bestScore){
        bestScore = score;
        best = live;
      }
    }

    if(!best || bestScore < threshold) return null;
    return {live:best, score:bestScore};
  }

  function uniqueCoordCount(observations){
    const set = new Set();
    for(const obs of observations){
      const c = coordOf(obs);
      if(c) set.add(c.lat.toFixed(7)+","+c.lon.toFixed(7));
    }
    return set.size;
  }

  function sortTemporal(obs){
    return obs.slice().sort((a,b)=>{
      const ta = tsOf(a), tb = tsOf(b);
      if(ta !== null && tb !== null && ta !== tb) return ta-tb;

      const ca = cycleOf(a), cb = cycleOf(b);
      if(ca && cb) return ca.localeCompare(cb);

      return 0;
    });
  }

  async function run(options){
    const startedAt = Date.now();

    if(state.running){
      return {success:false, phase:PHASE, version:VERSION, build:BUILD, status:"H3B_ALREADY_RUNNING"};
    }

    state.running = true;

    try{
      const opts = Object.assign({
        minEvidenceScore: 700,
        minMovementMeters: 250,
        appendEvidenceWhenCycleDistinct: true,
        invokeB1B3B: true,
        logTable: true,
        tableLimit: 60
      }, options || {});

      const source = canonicalSource();
      if(!source){
        const r = {
          success:false, phase:PHASE, version:VERSION, build:BUILD,
          status:"NO_CANONICAL_TEMPORAL_SOURCE_AVAILABLE",
          generatedAt:Date.now(),
          durationMs:Date.now()-startedAt
        };
        state.lastRun = r;
        return r;
      }

      const live = collectLiveEvidence();
      const aliasIndex = buildAliasIndex(source.identities);

      let identityCount = 0;
      let liveCoordinateEvidenceCount = live.evidence.length;
      let matchedCanonicalIdentityCount = 0;
      let coordinatesAttachedCount = 0;
      let appendedObservationCount = 0;
      let replacedCoordinateCount = 0;
      let coordinateChangingIdentityCountBefore = 0;
      let coordinateChangingIdentityCountAfter = 0;
      let multiPointIdentityCountBefore = 0;
      let multiPointIdentityCountAfter = 0;
      let maxObservedPointsPerIdentityBefore = 0;
      let maxObservedPointsPerIdentityAfter = 0;
      let maxRecoveredMovementMeters = 0;

      const repairedIdentities = {};
      const audit = [];

      for(const [key, rec] of Object.entries(source.identities || {})){
        if(!isObj(rec)) continue;

        const canonicalId = idOf(rec,key);
        if(!canonicalId) continue;
        identityCount++;

        const original = observationsOf(rec);
        const beforeUnique = uniqueCoordCount(original);
        if(beforeUnique >= 2) coordinateChangingIdentityCountBefore++;
        if(original.length >= 2) multiPointIdentityCountBefore++;
        maxObservedPointsPerIdentityBefore = Math.max(maxObservedPointsPerIdentityBefore, original.length);

        let matchedForIdentity = false;
        const repaired = original.map(x => Object.assign({},x));

        for(let i=0; i<repaired.length; i++){
          const obs = repaired[i];
          const matched = bestEvidence(canonicalId, rec, obs, live.evidence, aliasIndex, opts.minEvidenceScore);
          if(!matched) continue;

          matchedForIdentity = true;
          const lc = {lat:matched.live.lat, lon:matched.live.lon};
          const sc = coordOf(obs);
          const movement = sc ? haversineMeters(sc,lc) : null;

          if(!sc || (movement !== null && movement >= opts.minMovementMeters)){
            repaired[i] = Object.assign({},obs,{
              latitude:lc.lat,
              longitude:lc.lon,
              lat:lc.lat,
              lon:lc.lon,
              lng:lc.lon,
              coordinate:{latitude:lc.lat,longitude:lc.lon},
              __n4b1b3bH3B:{
                attached:true,
                evidenceSource:matched.live.sourceName,
                evidenceScore:matched.score,
                sourceTimestamp:matched.live.timestamp,
                sourceCycleId:matched.live.cycleId,
                originalCoordinate:sc,
                attachedCoordinate:lc,
                displacementMeters:movement
              }
            });

            coordinatesAttachedCount++;
            replacedCoordinateCount++;
            if(movement !== null) maxRecoveredMovementMeters = Math.max(maxRecoveredMovementMeters,movement);
          }

          if(audit.length < opts.tableLimit){
            audit.push({
              identity:canonicalId,
              cycleId:cycleOf(obs),
              timestamp:tsOf(obs),
              source:matched.live.sourceName,
              score:matched.score,
              storedLat:sc?sc.lat:null,
              storedLon:sc?sc.lon:null,
              liveLat:lc.lat,
              liveLon:lc.lon,
              displacementMeters:movement===null?null:Math.round(movement),
              action:(!sc || (movement!==null && movement>=opts.minMovementMeters)) ? "ATTACH" : "KEEP"
            });
          }
        }

        if(opts.appendEvidenceWhenCycleDistinct){
          const existingKeys = new Set(
            repaired.map(o => {
              const t=tsOf(o), c=cycleOf(o), p=coordOf(o);
              return `${c}|${t}|${p?p.lat.toFixed(7):""}|${p?p.lon.toFixed(7):""}`;
            })
          );

          for(const ev of live.evidence){
            const fakeObs = {
              identity:canonicalId,
              cycleId:ev.cycleId,
              timestamp:ev.timestamp,
              lat:ev.lat,
              lon:ev.lon
            };

            const sc = scoreEvidence(canonicalId, rec, fakeObs, ev, aliasIndex);
            if(sc < opts.minEvidenceScore) continue;

            const k = `${ev.cycleId}|${ev.timestamp}|${ev.lat.toFixed(7)}|${ev.lon.toFixed(7)}`;
            if(existingKeys.has(k)) continue;

            // Do not append identity-less evidence merely on geometry.
            const mapped = ev.ids.some(a=>{
              if(a===canonicalId) return true;
              const m=aliasIndex.get(a);
              return !!(m && m.has(canonicalId));
            });
            if(!mapped) continue;

            repaired.push({
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
              __n4b1b3bH3B:{
                appendedFromLiveEvidence:true,
                evidenceSource:ev.sourceName,
                evidenceScore:sc
              }
            });

            existingKeys.add(k);
            appendedObservationCount++;
            coordinatesAttachedCount++;
          }
        }

        const sorted = sortTemporal(repaired);
        const afterUnique = uniqueCoordCount(sorted);

        if(afterUnique >= 2) coordinateChangingIdentityCountAfter++;
        if(sorted.length >= 2) multiPointIdentityCountAfter++;
        maxObservedPointsPerIdentityAfter = Math.max(maxObservedPointsPerIdentityAfter, sorted.length);

        if(matchedForIdentity) matchedCanonicalIdentityCount++;

        repairedIdentities[canonicalId] = Object.assign({},rec,{
          identity:canonicalId,
          observations:sorted,
          history:sorted,
          temporalSequence:sorted,
          coordinateCountBefore:beforeUnique,
          coordinateCountAfter:afterUnique,
          h3bCoordinateAttachmentApplied:true
        });
      }

      const published = {
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        sourceName:source.name,
        generatedAt:Date.now(),
        identities:repairedIdentities
      };

      global.RainGuardN4B1B3BH3BCanonicalTemporalSourceV39 = published;
      global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39 = published;
      global.RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39 = published;
      global.RainGuardN4B1B3BH2TemporalSequenceRepairV39 = published;
      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = published;
      global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = published.identities;
      global.RainGuardH2RuntimeBoundTemporalSourceV39 = published;

      let downstream = {
        available: typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge === "function",
        invoked:false,
        success:false
      };

      if(opts.invokeB1B3B && downstream.available){
        try{
          const rr = await global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge();
          downstream = {
            available:true,
            invoked:true,
            success:!(rr && rr.success === false),
            result:rr
          };
        }catch(e){
          downstream = {
            available:true,
            invoked:true,
            success:false,
            error:e && e.message ? e.message : str(e)
          };
        }
      }

      let status;
      if(coordinateChangingIdentityCountAfter > 0){
        status = "LIVE_EVIDENCE_ATTACHED_CROSS_CYCLE_COORDINATE_CHANGE_RECOVERED";
      }else if(matchedCanonicalIdentityCount > 0){
        status = "LIVE_EVIDENCE_MATCHED_BUT_NO_COORDINATE_CHANGE_RECOVERED";
      }else{
        status = "LIVE_EVIDENCE_FOUND_BUT_NO_CANONICAL_IDENTITY_MATCH";
      }

      const result = {
        success:true,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status,

        selectedCanonicalSource:source.name,

        liveEvidenceSourceCount:live.sourceNames.length,
        liveEvidenceSourceNames:live.sourceNames.slice(0,50),
        liveCoordinateEvidenceCount,

        identityCount,
        matchedCanonicalIdentityCount,
        coordinatesAttachedCount,
        appendedObservationCount,
        replacedCoordinateCount,

        multiPointIdentityCountBefore,
        multiPointIdentityCountAfter,
        maxObservedPointsPerIdentityBefore,
        maxObservedPointsPerIdentityAfter,

        coordinateChangingIdentityCountBefore,
        coordinateChangingIdentityCountAfter,
        coordinateChangeRecoveryGatePassed:coordinateChangingIdentityCountAfter > 0,
        maxRecoveredMovementMeters:Math.round(maxRecoveredMovementMeters),

        canonicalTemporalSourceRepublished:true,
        crossCycleAccumulatorRepublished:true,
        h2RuntimeSourceRepublished:true,

        auditSample:audit,
        downstream,

        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      global.RainGuardN4B1B3BH3BResultV39 = result;
      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Live Evidence → Canonical Identity Coordinate Attachment & Cross-Cycle Recovery result:`);
      console.log(result);

      if(opts.logTable && console.table){
        try { console.table(audit); } catch(_) {}
      }

      return result;

    }catch(e){
      const r = {
        success:false,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:"H3B_COORDINATE_ATTACHMENT_RECOVERY_FAILED",
        error:e && e.message ? e.message : str(e),
        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      state.lastRun = r;
      state.lastError = r.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return r;
    }finally{
      state.running = false;
    }
  }

  function diagnose(){
    const r = {
      success:true,
      phase:PHASE,
      version:VERSION,
      build:BUILD,
      installed:true,
      running:state.running,
      runs:state.runs,
      canonicalSourceAvailable:!!canonicalSource(),
      b1b3bRunnerAvailable:
        typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge === "function",
      lastError:state.lastError,
      lastRun:state.lastRun
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,r);
    return r;
  }

  global.runRainGuardN4B1B3BH3BLiveEvidenceCanonicalIdentityCoordinateAttachmentCrossCycleRecoveryBridge = run;
  global.diagnoseRainGuardN4B1B3BH3BLiveEvidenceCanonicalIdentityCoordinateAttachmentCrossCycleRecoveryBridge = diagnose;

  global.RainGuardN4B1B3BH3BBridgeV39 = {
    phase:PHASE,
    version:VERSION,
    build:BUILD,
    run,
    diagnose,
    state
  };

})(window);
