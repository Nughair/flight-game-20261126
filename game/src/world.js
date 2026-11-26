// world.js — the Sora Archipelago: seven islands in a warm sea, one grass
// strip, a ring course, three mail-drop villages and the props that dress
// them. Terrain height is one analytic function used by the renderer, the
// flight model and the landing judge alike, so what you see is what you hit.

import { makeRng, NoiseField, randRange } from './random.js';

export const SEA_LEVEL = 0;
export const WORLD_SEED = 20261126;

// Island shapes: centre, radius of influence, peak height above the sea.
const ISLANDS = [
  { name: 'Sora Field', x: 0, z: 800, r: 760, peak: 13 },
  { name: 'Mount Sora', x: -1500, z: -600, r: 860, peak: 215 },
  { name: 'Cinder Cay', x: 1300, z: -300, r: 500, peak: 62 },
  { name: 'Tern Island', x: 700, z: -1600, r: 580, peak: 88 },
  { name: 'Kala Bay', x: -900, z: -2150, r: 680, peak: 124 },
  { name: 'Palm Cay', x: 2150, z: 750, r: 440, peak: 36 },
  { name: 'North Rock', x: -350, z: -3300, r: 520, peak: 98 },
];

const detailNoise = new NoiseField(WORLD_SEED, 64);
const beachNoise = new NoiseField(WORLD_SEED + 7, 64);

// Raw island height before the runway and drop clearings are levelled.
function rawHeight(x, z) {
  let h = -14;
  for (const isle of ISLANDS) {
    const dx = x - isle.x;
    const dz = z - isle.z;
    const d2 = (dx * dx + dz * dz) / (isle.r * isle.r);
    if (d2 < 4) h += (isle.peak + 14) * Math.exp(-2.1 * d2);
  }
  if (h > -2) {
    const land = Math.min(1, Math.max(0, (h + 2) / 26));
    h += detailNoise.fbm(x * 0.0038, z * 0.0038, 4) * 13 * land;
    h += beachNoise.fbm(x * 0.021, z * 0.021, 2) * 1.6 * land;
  }
  return h;
}

// The home strip: a levelled grass runway on Sora Field, pointing north.
export const RUNWAY = {
  cx: 0,
  cz: 800,
  length: 620,
  width: 26,
  headingDeg: 0, // takes off and lands toward the north (-z)
  alt: 10,
};

// The three mail-drop clearings; their pad heights are read from the raw
// terrain once, then the terrain is levelled to meet them.
export const DROP_TARGETS = [
  { name: 'Tern Island village', x: 648, z: -1508, r: 30, alt: 0 },
  { name: 'Kala Bay village', x: -838, z: -2078, r: 30, alt: 0 },
  { name: 'Cinder Cay village', x: 1252, z: -238, r: 30, alt: 0 },
];
for (const target of DROP_TARGETS) target.alt = rawHeight(target.x, target.z);

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Terrain height with the strip and the drop pads levelled into it.
export function heightAt(x, z) {
  let h = rawHeight(x, z);
  // Runway clearing: full strength inside the strip, feathered at the edges.
  const inX = 1 - smoothstep(RUNWAY.width / 2 + 14, RUNWAY.width / 2 + 74, Math.abs(x - RUNWAY.cx));
  const inZ = smoothstep(RUNWAY.cz - RUNWAY.length / 2 - 70, RUNWAY.cz - RUNWAY.length / 2 + 10, z)
    * (1 - smoothstep(RUNWAY.cz + RUNWAY.length / 2 - 10, RUNWAY.cz + RUNWAY.length / 2 + 70, z));
  const stripMask = Math.min(inX, inZ);
  if (stripMask > 0) h = h + (RUNWAY.alt - h) * stripMask;
  // Drop pads.
  for (const target of DROP_TARGETS) {
    const dx = x - target.x;
    const dz = z - target.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const mask = 1 - smoothstep(target.r * 0.7, target.r + 26, d);
    if (mask > 0) h = h + (target.alt - h) * mask;
  }
  return h;
}

// Slope of the ground at a point, as rise over run (for colour and crashes).
export function slopeAt(x, z) {
  const e = 6;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
}

// The sortie 1 ring course: six gates flown in order, home at both ends.
// yaw is the heading a pilot flies through the gate; alt is above the sea.
export const RING_COURSE = [
  { x: 0, z: -160, alt: 95, yaw: 0 },
  { x: -520, z: -760, alt: 135, yaw: -38 },
  { x: -1330, z: -330, alt: 205, yaw: 82 },
  { x: 330, z: -950, alt: 125, yaw: 155 },
  { x: 1240, z: -260, alt: 88, yaw: 196 },
  { x: -140, z: 260, alt: 78, yaw: 352 },
];
export const RING_RADIUS = 27;

// Dressing: pines, palms, houses, a lighthouse and the strip windsock.
// Positions are drawn once from the seed and kept for the whole session.
function scatterProps() {
  const rng = makeRng(WORLD_SEED + 31);
  const props = [];
  for (let i = 0; i < 900 && props.length < 210; i++) {
    const x = randRange(rng, -2600, 2600);
    const z = randRange(rng, -3600, 1700);
    const h = heightAt(x, z);
    if (h < 3 || h > 120) continue;
    if (Math.abs(x - RUNWAY.cx) < 60 && z > 420 && z < 1180) continue;
    if (slopeAt(x, z) > 0.55) continue;
    props.push({ kind: h < 26 ? 'palm' : 'pine', x, z, y: h, s: randRange(rng, 0.8, 1.5), rot: rng() * Math.PI * 2 });
  }
  const villages = [
    { x: 648, z: -1508 }, { x: -838, z: -2078 }, { x: 1252, z: -238 }, { x: 60, z: 430 },
  ];
  for (const village of villages) {
    for (let i = 0; i < 5; i++) {
      const x = village.x + randRange(rng, -70, 70);
      const z = village.z + randRange(rng, -70, 70);
      const h = heightAt(x, z);
      if (h < 1.5) continue;
      props.push({ kind: 'house', x, z, y: h, s: randRange(rng, 0.9, 1.3), rot: rng() * Math.PI * 2 });
    }
  }
  props.push({ kind: 'lighthouse', x: -350, z: -3260, y: heightAt(-350, -3260), s: 1.4, rot: 0 });
  props.push({ kind: 'windsock', x: 24, z: 560, y: RUNWAY.alt, s: 1, rot: 0 });
  props.push({ kind: 'hangar', x: -34, z: 470, y: RUNWAY.alt, s: 1.2, rot: Math.PI / 2 });
  return props;
}

function scatterClouds() {
  const rng = makeRng(WORLD_SEED + 77);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    clouds.push({
      x: randRange(rng, -3400, 3400),
      y: randRange(rng, 250, 430),
      z: randRange(rng, -4200, 2200),
      s: randRange(rng, 85, 195),
      drift: randRange(rng, 1.5, 3.5),
    });
  }
  return clouds;
}

export const PROPS = scatterProps();
export const CLOUDS = scatterClouds();
export const ISLAND_NAMES = ISLANDS.map((isle) => isle.name);
