(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3B1";
  const VERSION = "39A.15F6N4B1B3B-H3B1.0";
  const BUILD = "rainguard-v39-canonical-temporal-source-shape-normalization-h3b-binding-hotfix";

  if (global.__RainGuardN4B1B3BH3B1Installed) return;
  global.__RainGuardN4B1B3BH3B1Installed = true;

  const state = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null,
    selectedSourceName: null
  };

  function isObj(v) {
    return !!v && typeof v === "object";
  }

  function str(v) {
    try { return v == null ? "" : String(v); }
    catch (_) { return ""; }
  }

  function norm(v) {
    return str(v).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function identityOf(rec, fallback) {
    if (!isObj(rec)) return norm(fallback);

    const vals = [
      rec.identity,
      rec.authoritativeIdentity,
      rec.persistentId,
      rec.canonicalPersistentId,
      rec.canonicalIdentity,
      rec.identityKey,
      rec.trackId,
      rec.cellId,
      rec.stormId,
      rec.entityId,
      rec.id
    ];

    for (const v of vals) {
      const x = norm(v);
      if (x) return x;
    }

    return norm(fallback);
  }

  function obsOf(rec) {
    if (!isObj(rec)) return [];

    const fields = [
      "observations",
      "history",
      "temporalSequence",
      "points",
      "records",
      "samples",
      "timeline"
    ];

    for (const f of fields) {
      if (Array.isArray(rec[f])) return rec[f].slice();
    }

    return [];
  }

  function objectFromMap(map) {
    const out = {};
    for (const [k, v] of map.entries()) {
      if (!isObj(v)) continue;
      const id = identityOf(v, k);
      if (!id) continue;

      out[id] = Object.assign({}, v, {
        identity: id,
        observations: obsOf(v)
      });
    }
    return out;
  }

  function objectFromArray(arr) {
    const out = {};

    for (const item of arr) {
      if (!isObj(item)) continue;

      const id = identityOf(item, "");
      if (!id) continue;

      if (!out[id]) {
        out[id] = Object.assign({}, item, {
          identity: id,
          observations: []
        });
      }

      const o = obsOf(item);
      if (o.length) {
        out[id].observations.push(...o);
      } else {
        out[id].observations.push(item);
      }
    }

    return out;
  }

  function normalizeIdentityContainer(value, depth = 0) {
    if (!value || depth > 6) return null;

    if (value instanceof Map) {
      const identities = objectFromMap(value);
      return Object.keys(identities).length ? identities : null;
    }

    if (Array.isArray(value)) {
      const identities = objectFromArray(value);
      return Object.keys(identities).length ? identities : null;
    }

    if (!isObj(value)) return null;

    const directKeys = [
      "identities",
      "identityMap",
      "recordsByIdentity",
      "canonicalIdentities",
      "persistentIdentities",
      "data",
      "payload",
      "result",
      "source",
      "accumulator",
      "histories",
      "temporalHistories"
    ];

    for (const key of directKeys) {
      if (value[key] != null && value[key] !== value) {
        const nested = normalizeIdentityContainer(value[key], depth + 1);
        if (nested && Object.keys(nested).length) return nested;
      }
    }

    const out = {};
    let accepted = 0;

    for (const [k, rec] of Object.entries(value)) {
      if (!isObj(rec)) continue;

      const id = identityOf(rec, k);
      if (!id) continue;

      const observations = obsOf(rec);

      out[id] = Object.assign({}, rec, {
        identity: id,
        observations,
        history: Array.isArray(rec.history) ? rec.history.slice() : observations.slice(),
        temporalSequence: Array.isArray(rec.temporalSequence)
          ? rec.temporalSequence.slice()
          : observations.slice()
      });

      accepted++;
    }

    return accepted ? out : null;
  }

  function scoreSource(name, value, identities) {
    if (!identities) return -Infinity;

    const n = str(name).toLowerCase();
    const identityCount = Object.keys(identities).length;

    let observationCount = 0;
    let multiPointIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;

    for (const rec of Object.values(identities)) {
      const o = obsOf(rec);
      observationCount += o.length;

      if (o.length >= 2) multiPointIdentityCount++;
      maxObservedPointsPerIdentity = Math.max(maxObservedPointsPerIdentity, o.length);
    }

    let score = 0;

    if (n.includes("h3a")) score += 250;
    if (n.includes("h2a")) score += 180;
    if (n.includes("h3")) score += 120;
    if (n.includes("canonical")) score += 100;
    if (n.includes("temporal")) score += 90;
    if (n.includes("crosscycle")) score += 80;
    if (n.includes("appendoverride")) score += 70;
    if (n.includes("runtimebound")) score += 60;
    if (n.includes("accumulator")) score += 50;
    if (n.includes("history")) score += 40;

    if (identityCount > 0) score += 20;
    if (identityCount >= 100) score += 40;
    if (identityCount >= 500) score += 30;
    if (multiPointIdentityCount > 0) score += 60;
    if (maxObservedPointsPerIdentity >= 3) score += 20;
    if (observationCount > identityCount) score += 25;

    if (value instanceof Map) score += 10;
    if (Array.isArray(value)) score += 5;

    return {
      score,
      identityCount,
      observationCount,
      multiPointIdentityCount,
      maxObservedPointsPerIdentity
    };
  }

  function inspectSource(name, value) {
    if (!value || typeof value === "function") return null;

    try {
      const identities = normalizeIdentityContainer(value);
      if (!identities || !Object.keys(identities).length) return null;

      const metrics = scoreSource(name, value, identities);
      if (!metrics || metrics.score === -Infinity) return null;

      return {
        sourceName: name,
        sourceType:
          value instanceof Map ? "map" :
          Array.isArray(value) ? "array" :
          typeof value,
        rawValue: value,
        identities,
        score: metrics.score,
        identityCount: metrics.identityCount,
        observationCount: metrics.observationCount,
        multiPointIdentityCount: metrics.multiPointIdentityCount,
        maxObservedPointsPerIdentity: metrics.maxObservedPointsPerIdentity
      };
    } catch (_) {
      return null;
    }
  }

  function discoverCanonicalSources() {
    const preferred = [
      "RainGuardN4B1B3BH3AResultV39",
      "RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39",
      "RainGuardH2ACanonicalTemporalSourceForH3V39",
      "RainGuardN4B1B3BH2TemporalSequenceRepairV39",
      "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
      "RainGuardCrossCycleTemporalAppendOverrideHistoriesV39",
      "RainGuardH2RuntimeBoundTemporalSourceV39",
      "RainGuardN4B1B3BH2AResultV39",
      "RainGuardN4B1B3BH2TemporalSequenceRepairV39",
      "RainGuardN4B1B3BH3RecoveredTemporalSourceV39"
    ];

    const out = [];
    const seen = new Set();

    function add(name, value) {
      if (!name || seen.has(name)) return;
      seen.add(name);

      const candidate = inspectSource(name, value);
      if (candidate) out.push(candidate);
    }

    for (const name of preferred) {
      try { add(name, global[name]); } catch (_) {}
    }

    let keys = [];
    try { keys = Object.keys(global).slice(0, 25000); } catch (_) {}

    for (const name of keys) {
      if (
        !/rainguard|rainarrival/i.test(name) ||
        !/canonical|temporal|identity|append|cycle|history|registry|h2|h3/i.test(name)
      ) continue;

      try { add(name, global[name]); } catch (_) {}
    }

    out.sort((a, b) =>
      b.score - a.score ||
      b.multiPointIdentityCount - a.multiPointIdentityCount ||
      b.observationCount - a.observationCount ||
      b.identityCount - a.identityCount
    );

    return out;
  }

  function publishNormalized(candidate) {
    const normalized = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      sourceName: candidate.sourceName,
      sourceType: candidate.sourceType,
      normalizedAt: Date.now(),
      identities: candidate.identities
    };

    // Canonical bindings consumed by H3B.
    global.RainGuardN4B1B3BH3BCanonicalTemporalSourceV39 = normalized;
    global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39 = normalized;
    global.RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39 = normalized;
    global.RainGuardH2ACanonicalTemporalSourceForH3V39 = normalized;
    global.RainGuardN4B1B3BH2TemporalSequenceRepairV39 = normalized;
    global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = normalized;
    global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = normalized.identities;
    global.RainGuardH2RuntimeBoundTemporalSourceV39 = normalized;

    // Explicit H3B1 binding.
    global.RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39 = normalized;

    return normalized;
  }

  async function run(options) {
    const startedAt = Date.now();

    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "H3B1_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const opts = Object.assign({
        refreshH3A: true,
        invokeH3B: true,
        logCandidates: true,
        tableLimit: 40
      }, options || {});

      let h3aRefresh = {
        available:
          typeof global.runRainGuardN4B1B3BH3AH2ACanonicalTemporalSourceRuntimeDiscoveryBindingHotfix === "function",
        invoked: false,
        success: false
      };

      if (opts.refreshH3A && h3aRefresh.available) {
        try {
          const r = await global.runRainGuardN4B1B3BH3AH2ACanonicalTemporalSourceRuntimeDiscoveryBindingHotfix({
            refreshH2A: true,
            invokeH3: true,
            logCandidates: false
          });

          h3aRefresh = {
            available: true,
            invoked: true,
            success: !(r && r.success === false),
            result: r
          };
        } catch (e) {
          h3aRefresh = {
            available: true,
            invoked: true,
            success: false,
            error: e && e.message ? e.message : str(e)
          };
        }
      }

      const candidates = discoverCanonicalSources();
      const selected = candidates[0] || null;

      if (!selected) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_RUNTIME_CANONICAL_TEMPORAL_SOURCE_SHAPE_DISCOVERED",
          h3aRefresh,
          candidateCount: 0,
          generatedAt: Date.now(),
          durationMs: Date.now() - startedAt
        };

        state.lastRun = result;
        state.lastError = result.status;

        console.error(`[RainGuard Phase ${PHASE}] No canonical temporal source shape discovered.`);
        return result;
      }

      const normalized = publishNormalized(selected);
      state.selectedSourceName = selected.sourceName;

      let h3b = {
        available:
          typeof global.runRainGuardN4B1B3BH3BLiveEvidenceCanonicalIdentityCoordinateAttachmentCrossCycleRecoveryBridge === "function",
        invoked: false,
        success: false
      };

      if (opts.invokeH3B && h3b.available) {
        try {
          const r = await global.runRainGuardN4B1B3BH3BLiveEvidenceCanonicalIdentityCoordinateAttachmentCrossCycleRecoveryBridge();

          h3b = {
            available: true,
            invoked: true,
            success: !(r && r.success === false),
            result: r
          };
        } catch (e) {
          h3b = {
            available: true,
            invoked: true,
            success: false,
            error: e && e.message ? e.message : str(e)
          };
        }
      }

      let status = "CANONICAL_TEMPORAL_SOURCE_NORMALIZED_AND_BOUND_TO_H3B";

      if (h3b.invoked && h3b.success) {
        status = "CANONICAL_TEMPORAL_SOURCE_NORMALIZED_H3B_EXECUTED";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        h3aRefresh,

        selectedSourceName: selected.sourceName,
        selectedSourceType: selected.sourceType,
        selectedSourceScore: selected.score,

        identityCount: selected.identityCount,
        observationCount: selected.observationCount,
        multiPointIdentityCount: selected.multiPointIdentityCount,
        maxObservedPointsPerIdentity: selected.maxObservedPointsPerIdentity,

        normalizedCanonicalSourcePublished:
          !!global.RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39,

        h3bCanonicalSourcePublished:
          !!global.RainGuardN4B1B3BH3BCanonicalTemporalSourceV39,

        h3RecoveredSourcePublished:
          !!global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39,

        crossCycleAccumulatorPublished:
          !!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,

        h2RuntimeSourcePublished:
          !!global.RainGuardH2RuntimeBoundTemporalSourceV39,

        candidateCount: candidates.length,

        candidateSample: candidates.slice(0, opts.tableLimit).map(c => ({
          source: c.sourceName,
          type: c.sourceType,
          score: c.score,
          identities: c.identityCount,
          observations: c.observationCount,
          multiPoint: c.multiPointIdentityCount,
          maxPoints: c.maxObservedPointsPerIdentity
        })),

        h3b,

        normalizedSource: normalized,

        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt
      };

      global.RainGuardN4B1B3BH3B1ResultV39 = result;

      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Canonical Temporal Source Shape Normalization & H3B Binding result:`);
      console.log(result);

      if (opts.logCandidates && console.table) {
        try { console.table(result.candidateSample); } catch (_) {}
      }

      return result;

    } catch (e) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "H3B1_NORMALIZATION_BINDING_FAILED",
        error: e && e.message ? e.message : str(e),
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt
      };

      state.lastRun = result;
      state.lastError = result.error;

      console.error(`[RainGuard Phase ${PHASE}] failed:`, e);
      return result;

    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const sources = discoverCanonicalSources();

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      runs: state.runs,
      selectedSourceName: state.selectedSourceName,

      h3aRunnerAvailable:
        typeof global.runRainGuardN4B1B3BH3AH2ACanonicalTemporalSourceRuntimeDiscoveryBindingHotfix === "function",

      h3bRunnerAvailable:
        typeof global.runRainGuardN4B1B3BH3BLiveEvidenceCanonicalIdentityCoordinateAttachmentCrossCycleRecoveryBridge === "function",

      candidateCount: sources.length,

      candidateSample: sources.slice(0, 20).map(c => ({
        source: c.sourceName,
        type: c.sourceType,
        score: c.score,
        identities: c.identityCount,
        observations: c.observationCount
      })),

      normalizedCanonicalSourceAvailable:
        !!global.RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39,

      lastError: state.lastError,
      lastRun: state.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  global.runRainGuardN4B1B3BH3B1CanonicalTemporalSourceShapeNormalizationH3BBindingHotfix = run;
  global.diagnoseRainGuardN4B1B3BH3B1CanonicalTemporalSourceShapeNormalizationH3BBindingHotfix = diagnose;

  global.RainGuardN4B1B3BH3B1BridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    state
  };

})(window);
