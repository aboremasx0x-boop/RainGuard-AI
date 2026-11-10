const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("frontend/national-ai-os-v30.html", "utf8");
const js = fs.readFileSync("frontend/js/v30_orchestrator.js", "utf8");
const expected = {
  observe: "v30Map",
  collect: "sourceAdapterStatusPanel",
  normalize: "verificationSourceMatrix",
  verify: "multiSourceVerificationPanel",
  compare: "verificationSourceMatrix",
  conflict: "multiSourceVerificationPanel",
  decide: "decisionPanel",
  gate: "decisionPanel",
  learn: "adaptive-motion-learning-panel"
};
for (const [phase, id] of Object.entries(expected)) {
  assert.match(html, new RegExp('data-v30-phase="' + phase + '"', "i"), phase);
  assert.ok(html.includes('id="' + id + '"'), "missing panel: " + id);
  assert.ok(js.includes(phase + ': "' + id + '"'), "missing phase mapping: " + phase);
}
assert.match(js, /target\.closest\("article\.panel"\)/);
assert.match(js, /target\)\s*\{[\s\S]*scrollIntoView/);
console.log("PASS: phase buttons map to existing dashboard panels");
