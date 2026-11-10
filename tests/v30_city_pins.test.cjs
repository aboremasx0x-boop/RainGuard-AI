const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("frontend/js/ai_brain_v23.js","utf8");
const html=fs.readFileSync("frontend/national-ai-os-v30.html","utf8");
assert.match(html,/ai_brain_v23\.js\?v=3011-small-city-pins/);
assert.match(src,/this\.map\.getContainer\?\.\(\)\?\.id === "v30Map"/);
assert.match(src,/L\.divIcon\(/);
assert.match(src,/marker\.bindPopup\(/);
assert.match(src,/this\.mapLayers\.push\(/);
const segment=src.slice(src.indexOf("const isV30Map"),src.indexOf("marker.bindPopup"));
assert.match(segment,/L\.marker\(/);
assert.match(segment,/L\.circleMarker\(/); // V23 retains its previous style
assert.doesNotMatch(segment,/L\.circle\(/); // No large radius overlays
console.log("PASS: small, neutral V30 city pins and intact popup; V23 markers unchanged");
