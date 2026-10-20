// Dot-density points for chart 03: one dot per 50,000 residents (2021 Census).
// Usage (from the repository root):  node tools/make_dot_density.js
// No dependencies. Reads geo/aus_states_2021.topo.json and
// data/03_state_population_choropleth.csv, writes data/03_dot_density_points.csv.
//
// Dots are placed at random inside each state's boundary (seeded, so the output
// is reproducible), with a minimum spacing so they do not clump. The data are
// state totals only, so a dot's position within its state carries no meaning:
// the dots show HOW MANY people live in each state, not WHERE within it.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PEOPLE_PER_DOT = 50000;
const SEED = 3179;
const KM_PER_DEG = 111.32;

// Seeded PRNG (mulberry32)
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);

// --- TopoJSON decoding (quantized, delta-encoded arcs) ---
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "geo/aus_states_2021.topo.json"), "utf8"));
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
});
function ring(indexes) {
  const out = [];
  indexes.forEach((i, k) => {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    out.push(...(k === 0 ? a : a.slice(1)));
  });
  return out;
}
function polygons(geom) {
  const polys = geom.type === "Polygon" ? [geom.arcs] : geom.arcs;
  return polys.map((rings) => rings.map(ring));
}

// Even-odd point-in-polygon across all rings (handles holes)
function inRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolys(x, y, polys) {
  return polys.some((rings) => rings.reduce((acc, r) => (inRing(x, y, r) ? !acc : acc), false));
}

// --- Population ---
const csv = fs.readFileSync(path.join(ROOT, "data/03_state_population_choropleth.csv"), "utf8").replace(/^﻿/, "");
const [header, ...rows] = csv.trim().split(/\r?\n/);
const cols = header.split(",");
const pop = {};
rows.forEach((line) => {
  const v = line.split(",");
  pop[v[cols.indexOf("state_code")]] = Number(v[cols.indexOf("population_2021")]);
});

// --- Label keep-out boxes (labels drawn inside a state, see geo/state_label_points.csv) ---
const LABEL_HALF_W = 2.2, LABEL_HALF_H = 1.6; // degrees, roughly a two-line label at full map size
const labelCsv = fs.readFileSync(path.join(ROOT, "geo/state_label_points.csv"), "utf8").replace(/^﻿/, "");
const [labelHeader, ...labelRows] = labelCsv.trim().split(/\r?\n/);
const lc = labelHeader.split(",");
const labelBoxes = labelRows
  .map((line) => line.split(","))
  .filter((v) => v[lc.indexOf("label_longitude")] === v[lc.indexOf("longitude")] && v[lc.indexOf("label_latitude")] === v[lc.indexOf("latitude")])
  .map((v) => [Number(v[lc.indexOf("label_longitude")]), Number(v[lc.indexOf("label_latitude")])]);
function underLabel(x, y) {
  return labelBoxes.some(([lx, ly]) => Math.abs(x - lx) < LABEL_HALF_W && Math.abs(y - ly) < LABEL_HALF_H);
}

// --- Place dots ---
const out = ["state_code,dot_id,longitude,latitude"];
let total = 0;
topo.objects.states.geometries.forEach((geom) => {
  const code = geom.properties.state_code;
  const n = Math.round(pop[code] / PEOPLE_PER_DOT);
  const polys = polygons(geom);
  const pts = polys.flat(2);
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const maxCos = Math.max(Math.cos((minY * Math.PI) / 180), Math.cos((maxY * Math.PI) / 180));

  // Target spacing: a fraction of the "fair share" cell size; relaxed if it cannot be met
  let minDist = 0.7 * Math.sqrt(geom.properties.area_albers_sqkm / n);
  const placed = [];
  let misses = 0;
  while (placed.length < n) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);
    // equal-area sampling: accept in proportion to cos(latitude)
    if (rand() > Math.cos((y * Math.PI) / 180) / maxCos) continue;
    if (!inPolys(x, y, polys) || underLabel(x, y)) continue;
    const kx = KM_PER_DEG * Math.cos((y * Math.PI) / 180);
    const ok = placed.every(([px, py]) => Math.hypot((px - x) * kx, (py - y) * KM_PER_DEG) >= minDist);
    if (!ok) { if (++misses > 2000) { minDist *= 0.9; misses = 0; } continue; }
    placed.push([x, y]);
  }
  placed.forEach(([x, y], i) => out.push(`${code},${i + 1},${x.toFixed(3)},${y.toFixed(3)}`));
  total += n;
  console.log(`${code}: ${pop[code]} residents -> ${n} dots (min spacing ${minDist.toFixed(0)} km)`);
});

fs.writeFileSync(path.join(ROOT, "data/03_dot_density_points.csv"), out.join("\n") + "\n");
console.log(`Total: ${total} dots -> data/03_dot_density_points.csv`);
