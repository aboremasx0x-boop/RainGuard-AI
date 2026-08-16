/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1B1 — Authoritative Registry Runtime Binding & Deferred Execution Bridge
 * Version: 39A.15F6N4B1B1.0
 *
 * Mission
 * -------
 * Eliminate the N4B1B failure:
 *   NO_AUTHORITATIVE_IDENTITIES_FOUND
 *
 * by discovering the authoritative persistent identity registry at runtime,
 * binding it to the canonical names expected by downstream bridges, optionally
 * invoking prerequisite discovery/rehydration bridges, and deferring execution
 * until the authoritative identity population is actually available.
 *
 * Public API
 * ----------
 * window.runRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge(options?)
 * window.diagnoseRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge()
 *
 * Canonical bindings published
 * ----------------------------
 * window.RainGuardAuthoritativePersistentStormIdentitiesV39
 * window.RainGuardPublishedAuthoritativePersistentStormIdentitiesV39
 * window.RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39
 * window.RainGuardRuntimeAuthoritativeRegistryBindingV39
 *
 * Downstream execution
 * --------------------
 * If available, this bridge runs:
 *   window.runRainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridge()
 */

(function installRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B1";
  const VERSION = "39A.15F6N4B1B1.0";
  const BUILD = "rainguard-v39-authoritative-registry-runtime-binding-deferred-execution-bridge";

  const INSTALL_FLAG =
    "__RainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridgeInstalled";

  if (global[INSTALL_FLAG]) return;
  global[INSTALL_FLAG] = true;

  const DEFAULTS = Object.freeze({
    minIdentityCount: 2,
    preferredIdentityCount: 100,
    maxAttempts: 12,
    retryDelayMs: 350,
    invokePrerequisites: true,
    invokeN4B1B: true,
    publishCanonicalAliases: true,
    logCandidates: true,
    maxScanKeys: 7000,
    maxNestedDepth: 2
  });

  const state = {
    installed: true,
    running: false,
    lastRun: null,
    lastError: null,
    lastBoundSourceName: null,
    lastBoundIdentityCount: 0,
    attempts: 0
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const now = () => Date.now();

  function isObject(v) {
    return !!v && typeof v === "object";
  }

  function isPlainObject(v) {
    if (!isObject(v)) return false;
    const p = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null;
  }

  function safeString(v) {
    try {
      return v == null ? "" : String(v);
    } catch (_) {
      return "";
    }
  }

  function safeKeys(obj) {
    try {
      return Object.keys(obj || {});
    } catch (_) {
      return [];
    }
  }

  function safeValues(obj) {
    try {
      return Object.values(obj || {});
    } catch (_) {
      return [];
    }
  }

  function normalizeIdentityKey(v) {
    return safeString(v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^(track|storm|cell|identity|persistent):/i, "");
  }

  function extractIdentityKey(record) {
    if (!isObject(record)) return "";

    const candidates = [
      record.persistentId,
      record.canonicalPersistentId,
      record.authoritativeIdentity,
      record.canonicalIdentity,
      record.canonicalTrackId,
      record.canonicalId,
      record.identityKey,
      record.recoveredIdentityKey,
      record.identity,
      record.trackId,
      record.cellId,
      record.stormId,
      record.entityId,
      record.id,
      record.name
    ];

    for (const value of candidates) {
      const key = normalizeIdentityKey(value);
      if (key) return key;
    }

    return "";
  }

  function countIdentityLike(records) {
    let count = 0;
    const sample = Array.isArray(records) ? records.slice(0, 100) : [];

    for (const record of sample) {
      if (!isObject(record)) continue;
      if (extractIdentityKey(record)) count++;
    }

    return count;
  }

  function unwrapCollection(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    if (value instanceof Map || value instanceof Set) {
      try {
        return Array.from(value.values());
      } catch (_) {
        return [];
      }
    }

    if (!isObject(value)) return [];

    const preferred = [
      "identities",
      "authoritativeIdentities",
      "persistentIdentities",
      "registry",
      "records",
      "items",
      "data",
      "entities",
      "tracks",
      "observations",
      "history",
      "values"
    ];

    for (const key of preferred) {
      let nested;
      try {
        nested = value[key];
      } catch (_) {
        continue;
      }

      if (Array.isArray(nested)) return nested;

      if (nested instanceof Map || nested instanceof Set) {
        try {
          return Array.from(nested.values());
        } catch (_) {}
      }

      if (isObject(nested)) {
        const vals = safeValues(nested);
        if (vals.length) return vals;
      }
    }

    const vals = safeValues(value);
    return vals.length ? vals : [];
  }

  function scoreCandidate(name, value, records) {
    const lname = safeString(name).toLowerCase();
    const count = records.length;
    const identityLikeCount = countIdentityLike(records);
    const sampleSize = Math.min(records.length, 100) || 1;
    const identityRatio = identityLikeCount / sampleSize;

    let score = 0;

    // Strong naming signals
    if (/authoritative/.test(lname)) score += 42;
    if (/persistent/.test(lname)) score += 24;
    if (/identity|identit/.test(lname)) score += 26;
    if (/registry/.test(lname)) score += 20;
    if (/integrated/.test(lname)) score += 12;
    if (/motionrecord|motion_record|motionrecords/.test(lname)) score += 12;
    if (/storm/.test(lname)) score += 6;
    if (/v39|39a/.test(lname)) score += 5;

    // Penalize known weak/secondary feeds
    if (/sample|diagnostic|result|status|config|cache/.test(lname)) score -= 16;
    if (/history/.test(lname) && !/identity/.test(lname)) score -= 12;
    if (/live.?track.?history/.test(lname)) score -= 18;

    // Population / quality signals
    if (count >= 1000) score += 28;
    else if (count >= 500) score += 24;
    else if (count >= 100) score += 18;
    else if (count >= 20) score += 10;
    else if (count >= 2) score += 4;

    score += Math.round(identityRatio * 30);

    // Direct object metadata
    if (isObject(value)) {
      const status = safeString(value.status).toUpperCase();
      if (/AUTHORITATIVE.*READY/.test(status)) score += 30;
      if (/PERSISTENT.*REGISTRY.*READY/.test(status)) score += 28;
      if (/DISCOVERED_AND_BOUND/.test(status)) score += 24;
      if (/INTEGRATED/.test(status)) score += 14;

      const phase = safeString(value.phase);
      if (/39A-15F6N4A1|39A-15F6N4A|39A-15F6N4/.test(phase)) score += 20;
    }

    return {
      name,
      value,
      records,
      identityCount: count,
      identityLikeCount,
      identityRatio,
      score
    };
  }

  function collectExplicitCandidates() {
    const names = [
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardIntegratedIdentityPersistentRegistryV39",
      "RainGuardIntegratedPersistentIdentityRegistryV39",
      "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
      "RainGuardRuntimeAuthoritativeRegistryBindingV39",
      "RainGuardPersistentIdentityMotionRecordsV39",
      "RainGuardPersistentIdentityTemporalAccumulatorV39",
      "RainGuardPersistentObservationMemoryV39"
    ];

    const out = [];

    for (const name of names) {
      let value;
      try {
        value = global[name];
      } catch (_) {
        continue;
      }

      if (!value) continue;

      const records = unwrapCollection(value);
      if (!records.length) continue;

      out.push(scoreCandidate(name, value, records));
    }

    return out;
  }

  function collectDynamicCandidates(cfg) {
    const out = [];
    const keys = safeKeys(global).slice(0, cfg.maxScanKeys);

    for (const name of keys) {
      if (!/rain|storm|identity|registry|track/i.test(name)) continue;

      let value;
      try {
        value = global[name];
      } catch (_) {
        continue;
      }

      if (!value || typeof value === "function") continue;

      const records = unwrapCollection(value);

      if (records.length >= cfg.minIdentityCount) {
        const scored = scoreCandidate(name, value, records);

        // avoid random UI structures with weak identity content
        if (
          scored.identityLikeCount > 0 ||
          /identity|registry|authoritative|persistent/i.test(name)
        ) {
          out.push(scored);
        }
      }
    }

    return out;
  }

  function dedupeCandidates(candidates) {
    const seen = new Set();
    const out = [];

    for (const c of candidates) {
      const key = c.name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }

    return out;
  }

  function chooseBestCandidate(cfg) {
    const candidates = dedupeCandidates([
      ...collectExplicitCandidates(),
      ...collectDynamicCandidates(cfg)
    ]);

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.identityCount !== a.identityCount) return b.identityCount - a.identityCount;
      return b.identityRatio - a.identityRatio;
    });

    if (cfg.logCandidates && typeof console.table === "function") {
      try {
        console.table(
          candidates.slice(0, 15).map(c => ({
            source: c.name,
            identities: c.identityCount,
            identityLike: c.identityLikeCount,
            score: c.score
          }))
        );
      } catch (_) {}
    }

    return {
      selected: candidates[0] || null,
      candidates
    };
  }

  function cloneArrayShallow(records) {
    try {
      return records.slice();
    } catch (_) {
      return Array.from(records || []);
    }
  }

  function publishCanonicalBindings(selected, cfg) {
    const records = cloneArrayShallow(selected.records);

    const binding = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "AUTHORITATIVE_REGISTRY_RUNTIME_BOUND",
      selectedSourceName: selected.name,
      selectedSourceScore: selected.score,
      selectedIdentityCount: selected.identityCount,
      identityLikeCount: selected.identityLikeCount,
      generatedAt: now(),
      identities: records,
      registry: records,
      records
    };

    global.RainGuardRuntimeAuthoritativeRegistryBindingV39 = binding;
    global.RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39 = records;

    if (cfg.publishCanonicalAliases) {
      global.RainGuardAuthoritativePersistentStormIdentitiesV39 = records;
      global.RainGuardPublishedAuthoritativePersistentStormIdentitiesV39 = records;

      // Additional compatibility aliases for older bridges.
      global.RainGuardIntegratedPersistentStormIdentitiesV39 = records;
      global.RainGuardIntegratedIdentityPersistentRegistryV39 = records;
      global.RainGuardIntegratedPersistentIdentityRegistryV39 = records;
    }

    return binding;
  }

  async function invokeIfAvailable(name, args) {
    const fn = global[name];
    if (typeof fn !== "function") {
      return {
        invoked: false,
        name,
        reason: "FUNCTION_NOT_AVAILABLE"
      };
    }

    try {
      const result = await fn.apply(global, Array.isArray(args) ? args : []);
      return {
        invoked: true,
        name,
        success: !(result && result.success === false),
        result
      };
    } catch (error) {
      return {
        invoked: true,
        name,
        success: false,
        error: error && error.message ? error.message : safeString(error)
      };
    }
  }

  async function runPrerequisites() {
    const chain = [
      "runRainGuardPublishedAuthoritativeIdentitySourcePriorityRecovery",
      "runRainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridge",
      "runRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge",
      "runRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge"
    ];

    const results = [];

    for (const name of chain) {
      if (typeof global[name] === "function") {
        results.push(await invokeIfAvailable(name));
      }
    }

    return results;
  }

  async function waitForAuthoritativeRegistry(cfg) {
    let best = null;
    const snapshots = [];

    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      state.attempts = attempt;

      const discovery = chooseBestCandidate(cfg);
      const selected = discovery.selected;

      snapshots.push({
        attempt,
        candidateCount: discovery.candidates.length,
        selectedSourceName: selected ? selected.name : null,
        selectedIdentityCount: selected ? selected.identityCount : 0,
        selectedScore: selected ? selected.score : null
      });

      if (selected && selected.identityCount >= cfg.minIdentityCount) {
        best = {
          selected,
          candidates: discovery.candidates,
          attempts: attempt,
          snapshots
        };

        if (selected.identityCount >= cfg.preferredIdentityCount) break;
      }

      if (attempt < cfg.maxAttempts) {
        await sleep(cfg.retryDelayMs);
      }
    }

    return best;
  }

  async function run(options) {
    const started = now();

    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "AUTHORITATIVE_REGISTRY_BINDING_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options) ? options : {});

      const prerequisiteResults = cfg.invokePrerequisites
        ? await runPrerequisites()
        : [];

      const discovered = await waitForAuthoritativeRegistry(cfg);

      if (!discovered || !discovered.selected) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_RUNTIME_AUTHORITATIVE_REGISTRY_FOUND",
          prerequisiteResults,
          attempts: state.attempts,
          generatedAt: now(),
          durationMs: now() - started
        };

        state.lastRun = result;
        state.lastError = null;
        return result;
      }

      const selected = discovered.selected;
      const binding = publishCanonicalBindings(selected, cfg);

      state.lastBoundSourceName = selected.name;
      state.lastBoundIdentityCount = selected.identityCount;

      let downstream = {
        invoked: false,
        name: "runRainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridge",
        reason: "DISABLED"
      };

      if (cfg.invokeN4B1B) {
        // One microtask + short delay allows canonical aliases to become visible
        // to any bridge that snapshots runtime sources when starting.
        await Promise.resolve();
        await sleep(25);

        downstream = await invokeIfAvailable(
          "runRainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridge"
        );
      }

      let status = "AUTHORITATIVE_REGISTRY_BOUND";

      if (downstream.invoked && downstream.success) {
        const dsStatus =
          downstream.result && downstream.result.status
            ? downstream.result.status
            : "";

        if (
          dsStatus === "TEMPORAL_COORDINATE_SEQUENCES_RECOVERED_WITH_REAL_CHANGE"
        ) {
          status =
            "AUTHORITATIVE_REGISTRY_BOUND_AND_TEMPORAL_SEQUENCE_RECOVERY_PASSED";
        } else {
          status =
            "AUTHORITATIVE_REGISTRY_BOUND_AND_N4B1B_EXECUTED";
        }
      } else if (downstream.invoked && !downstream.success) {
        status =
          "AUTHORITATIVE_REGISTRY_BOUND_BUT_N4B1B_EXECUTION_FAILED";
      } else if (!downstream.invoked) {
        status =
          "AUTHORITATIVE_REGISTRY_BOUND_N4B1B_NOT_INVOKED";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        selectedSourceName: selected.name,
        selectedSourceScore: selected.score,
        authoritativeIdentityCount: selected.identityCount,
        identityLikeCount: selected.identityLikeCount,

        canonicalBindings: [
          "RainGuardAuthoritativePersistentStormIdentitiesV39",
          "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
          "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
          "RainGuardRuntimeAuthoritativeRegistryBindingV39",
          "RainGuardIntegratedPersistentStormIdentitiesV39",
          "RainGuardIntegratedIdentityPersistentRegistryV39",
          "RainGuardIntegratedPersistentIdentityRegistryV39"
        ],

        candidateCount: discovered.candidates.length,
        candidateSample: discovered.candidates.slice(0, 15).map(c => ({
          sourceName: c.name,
          identityCount: c.identityCount,
          identityLikeCount: c.identityLikeCount,
          score: c.score
        })),

        attempts: discovered.attempts,
        attemptSnapshots: discovered.snapshots,

        binding,
        prerequisiteResults,
        downstream,

        downstreamStatus:
          downstream && downstream.result
            ? downstream.result.status || null
            : null,

        downstreamFunctionalPass:
          !!(
            downstream &&
            downstream.result &&
            downstream.result.functionalPass === true
          ),

        coordinateChangingIdentityCount:
          downstream &&
          downstream.result &&
          Number.isFinite(Number(downstream.result.coordinateChangingIdentityCount))
            ? Number(downstream.result.coordinateChangingIdentityCount)
            : null,

        multiPointIdentityCount:
          downstream &&
          downstream.result &&
          Number.isFinite(Number(downstream.result.multiPointIdentityCount))
            ? Number(downstream.result.multiPointIdentityCount)
            : null,

        maxUniqueCoordinatesPerIdentity:
          downstream &&
          downstream.result &&
          Number.isFinite(Number(downstream.result.maxUniqueCoordinatesPerIdentity))
            ? Number(downstream.result.maxUniqueCoordinatesPerIdentity)
            : null,

        generatedAt: now(),
        durationMs: now() - started
      };

      global.RainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionResultV39 =
        result;

      state.lastRun = result;
      state.lastError = null;

      console.log(
        `[RainGuard Phase ${PHASE}] Authoritative Registry Runtime Binding & Deferred Execution result:`
      );
      console.log(result);

      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "AUTHORITATIVE_REGISTRY_RUNTIME_BINDING_FAILED",
        error: error && error.message ? error.message : safeString(error),
        generatedAt: now(),
        durationMs: now() - started
      };

      state.lastRun = result;
      state.lastError = result.error;

      console.error(`[RainGuard Phase ${PHASE}] failed:`, error);
      return result;

    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const candidates = chooseBestCandidate(DEFAULTS);

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      lastError: state.lastError,
      lastBoundSourceName: state.lastBoundSourceName,
      lastBoundIdentityCount: state.lastBoundIdentityCount,
      attempts: state.attempts,
      bestCandidate: candidates.selected
        ? {
            sourceName: candidates.selected.name,
            identityCount: candidates.selected.identityCount,
            identityLikeCount: candidates.selected.identityLikeCount,
            score: candidates.selected.score
          }
        : null,
      candidateCount: candidates.candidates.length,
      lastRun: state.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  global.runRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge =
    run;

  global.diagnoseRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge =
    diagnose;

  global.RainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridgeV39 =
    {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      run,
      diagnose,
      state
    };

})(window);
