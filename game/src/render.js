// render.js — the painter. A small software 3D projector draws the whole
// world to the 2D canvas: gradient sky and sun first, then every polygon of
// sea, island, strip, prop, ring and aeroplane sorted far to near, with a
// warm fog that melts the distance into the horizon. No library, no images:
// the look is all arithmetic, in one golden-hour style.

import { VIEW_W, VIEW_H, PALETTE, STORM } from './config.js';
import { heightAt, RUNWAY, RING_COURSE, RING_RADIUS } from './world.js';
import { planePolygons } from './plane.js';

const FOCAL = 610;               // projection scale, ~62 degrees vertical
const NEAR = 2.5;                // metres; nearer than this is behind us
const SUN_DIR = norm3(-0.52, 0.55, -0.44); // toward the low western sun
const CELL = 46;                 // terrain grid pitch in metres
const GRID_HALF = 26;            // grid extends this many cells each way

// Smoothed chase camera; snapCamera() cuts straight to the plane.
const cam = { x: 0, y: 30, z: 0, yaw: 0, pitch: 0, roll: 0, ready: false };

export function snapCamera() {
  cam.ready = false;
}

function updateCamera(plane, dt) {
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  const back = plane.onGround ? 16 : 19.5;
  const up = plane.onGround ? 5.4 : 6.9;
  const tx = plane.x - fx * back;
  const tz = plane.z - fz * back;
  const groundThere = Math.max(heightAt(tx, tz), 0);
  const ty = Math.max(plane.y + up, groundThere + 2.6);
  if (!cam.ready) {
    cam.x = tx; cam.y = ty; cam.z = tz;
    cam.yaw = plane.heading; cam.pitch = plane.pitch * 0.55; cam.roll = plane.roll * 0.7;
    cam.ready = true;
    return;
  }
  const k = Math.min(1, dt * 5.2);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * Math.min(1, dt * 3.4);
  cam.z += (tz - cam.z) * k;
  cam.yaw += wrapAngle(plane.heading - cam.yaw) * k;
  cam.pitch += (plane.pitch * 0.55 - 0.088 - cam.pitch) * Math.min(1, dt * 3.2);
  cam.roll += (plane.roll * 0.72 - cam.roll) * Math.min(1, dt * 4.2);
}

// Camera basis vectors for the current frame.
function cameraBasis() {
  const f = {
    x: Math.sin(cam.yaw) * Math.cos(cam.pitch),
    y: Math.sin(cam.pitch),
    z: -Math.cos(cam.yaw) * Math.cos(cam.pitch),
  };
  // Right when the wings are level: perpendicular to forward, kept flat.
  const r = norm3(-f.z, 0, f.x);
  const u0 = norm3(
    r.y * f.z - r.z * f.y,
    r.z * f.x - r.x * f.z,
    r.x * f.y - r.y * f.x,
  );
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);
  const right = {
    x: r.x * cr - u0.x * sr,
    y: r.y * cr - u0.y * sr,
    z: r.z * cr - u0.z * sr,
  };
  const up = {
    x: r.x * sr + u0.x * cr,
    y: r.y * sr + u0.y * cr,
    z: r.z * sr + u0.z * cr,
  };
  return { f, r: right, u: up };
}

// Project a world point; returns {x, y, depth} on screen or null if behind.
export function projectPoint(basis, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const depth = dx * basis.f.x + dy * basis.f.y + dz * basis.f.z;
  if (depth < NEAR) return null;
  const cx = dx * basis.r.x + dy * basis.r.y + dz * basis.r.z;
  const cy = dx * basis.u.x + dy * basis.u.y + dz * basis.u.z;
  return { x: VIEW_W / 2 + (cx * FOCAL) / depth, y: VIEW_H / 2 - (cy * FOCAL) / depth, depth };
}

// The frame's draw list: flat records the sorter can chew quickly.
function makeItemList() {
  return { items: [], push(depth, kind, a, b, c, d) { this.items.push({ depth, kind, a, b, c, d }); } };
}

// Draw the whole world. opts:
//   plane        the aeroplane state (also the camera's anchor)
//   storm        true on the storm sortie (grey palette, rain, low cloud)
//   timeSec      session clock, for water sparkle and cloud drift
//   rings        { nextIndex } during the ring sortie, else null
//   target       { x, z, r, y } active drop target, else null
//   parcels      falling/landed mail parcels to draw
//   camOverride  { x, y, z, yaw, pitch, roll } for staged screenshots
export function drawWorld(ctx, opts) {
  const storm = !!opts.storm;
  const pal = storm ? { ...PALETTE, ...STORM } : PALETTE;
  if (opts.camOverride) {
    Object.assign(cam, opts.camOverride);
    cam.ready = true;
  } else {
    updateCamera(opts.plane, opts.dt ?? 1 / 60);
  }
  const basis = cameraBasis();

  drawSky(ctx, basis, pal, storm);
  const list = makeItemList();
  collectTerrain(list, basis, pal, storm, opts.timeSec);
  collectRunway(list, basis, pal);
  collectProps(list, basis, pal, opts.timeSec);
  collectClouds(list, basis, pal, opts.timeSec, storm);
  if (opts.rings) collectRings(list, basis, opts.rings.nextIndex);
  if (opts.target) collectTarget(list, basis, opts.target, opts.timeSec);
  for (const parcel of opts.parcels ?? []) collectParcel(list, basis, parcel);
  if (opts.plane) {
    for (const poly of planePolygons(opts.plane)) {
      pushWorldPoly(list, basis, poly.pts, poly.fill, poly.shade);
    }
  }
  list.items.sort((a, b) => b.depth - a.depth);
  for (const item of list.items) drawItem(ctx, item);
  if (storm) drawRain(ctx, opts.timeSec);
  return basis;
}

// --- sky, sun and weather -------------------------------------------------

function drawSky(ctx, basis, pal, storm) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(0.42, pal.skyMid);
  grad.addColorStop(0.72, pal.skyLow);
  grad.addColorStop(1, pal.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // The sun itself, low in the west, with a broad warm glow.
  const sun = projectPoint(basis, cam.x + SUN_DIR.x * 6000, cam.y + SUN_DIR.y * 6000, cam.z + SUN_DIR.z * 6000);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, storm ? 190 : 300);
    glow.addColorStop(0, 'rgba(255, 240, 196, 0.95)');
    glow.addColorStop(0.18, pal.sunGlow);
    glow.addColorStop(1, 'rgba(255, 178, 92, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 320, sun.y - 320, 640, 640);
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, storm ? 17 : 23, 0, Math.PI * 2);
    ctx.fillStyle = pal.sunCore;
    ctx.fill();
  }
}

function drawRain(ctx, timeSec) {
  ctx.strokeStyle = 'rgba(200, 214, 226, 0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 110; i++) {
    const seed = i * 127.1;
    const x = ((seed * 13.7 + timeSec * 620) % (VIEW_W + 80)) - 40;
    const y = ((seed * 7.3 + timeSec * 940) % (VIEW_H + 60)) - 30;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 7, y + 17);
  }
  ctx.stroke();
}

// --- terrain, sea and strip ----------------------------------------------

function collectTerrain(list, basis, pal, storm, timeSec) {
  // Two tiers: a fine grid around the camera for the ground you fly over,
  // and a coarse ring beyond it so the world reaches the horizon — at
  // ground level a 1.2 km world would end in open sky.
  collectTerrainLayer(list, basis, pal, storm, timeSec, CELL, GRID_HALF, 0);
  collectTerrainLayer(list, basis, pal, storm, timeSec, 184, 16, 1210);
}

function collectTerrainLayer(list, basis, pal, storm, timeSec, cell, half, minCentreDist) {
  const cx = Math.round(cam.x / cell) * cell;
  const cz = Math.round(cam.z / cell) * cell;
  const n = half * 2 + 1;
  // Project the shared vertex grid once; quads reuse the corners.
  const vx = new Float32Array(n);
  const vz = new Float32Array(n);
  const heights = [];
  const screen = [];
  for (let i = 0; i < n; i++) { vx[i] = cx + (i - half) * cell; vz[i] = cz + (i - half) * cell; }
  for (let j = 0; j < n; j++) {
    heights.push(new Float32Array(n));
    screen.push(new Array(n));
    for (let i = 0; i < n; i++) {
      heights[j][i] = heightAt(vx[i], vz[j]);
      screen[j][i] = projectPoint(basis, vx[i], Math.max(heights[j][i], 0), vz[j]);
    }
  }
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const p00 = screen[j][i], p10 = screen[j][i + 1], p01 = screen[j + 1][i], p11 = screen[j + 1][i + 1];
      if (!p00 || !p10 || !p01 || !p11) continue;
      const h00 = heights[j][i], h10 = heights[j][i + 1], h01 = heights[j + 1][i], h11 = heights[j + 1][i + 1];
      const depth = (p00.depth + p10.depth + p01.depth + p11.depth) / 4;
      if (depth > 3400) continue;
      if (minCentreDist > 0) {
        // The coarse ring leaves the middle to the fine grid (a square
        // hole, like the fine grid's own footprint).
        const qx = Math.abs((vx[i] + vx[i + 1]) / 2 - cx);
        const qz = Math.abs((vz[j] + vz[j + 1]) / 2 - cz);
        if (Math.max(qx, qz) < minCentreDist) continue;
      }
      const pts = [p00, p10, p11, p01];
      if (Math.max(h00, h10, h01, h11) < 0.05) {
        // Open water: flat quad at sea level, a whisper of per-cell tone
        // variation and a rare sun glint — calm, not a checkerboard.
        const hash = Math.abs(Math.sin(vx[i] * 12.9898 + vz[j] * 78.233) * 43758.5453) % 1;
        const glint = Math.sin(vx[i] * 0.11 + vz[j] * 0.13 + timeSec * 0.7) > 0.96 ? 0.3 : 0;
        const base = mix(pal.seaDeep, pal.seaLight, hash * 0.1 + glint);
        list.push(depth, 'poly', pts, fogged(base, depth, pal), null, 0);
      } else {
        const avgH = (h00 + h10 + h01 + h11) / 4;
        // Surface normal from the corner heights, for the sun's shading.
        const ex = { x: cell, y: h10 - h00, z: 0 };
        const ez = { x: 0, y: h01 - h00, z: cell };
        const nrm = norm3(ex.y * ez.z - ex.z * ez.y, ex.z * ez.x - ex.x * ez.z, ex.x * ez.y - ex.y * ez.x);
        const light = 0.6 + 0.47 * Math.max(0, nrm.x * SUN_DIR.x + nrm.y * SUN_DIR.y + nrm.z * SUN_DIR.z);
        const slope = 1 - Math.abs(nrm.y);
        const base = terrainColour(avgH, slope, pal);
        list.push(depth, 'poly', pts, fogged(shade(base, light * (storm ? STORM.dim : 1)), depth, pal), null, 0);
      }
    }
  }
}

function terrainColour(h, slope, pal) {
  // Bands blend into one another so the coast reads as one landscape,
  // not a quilt: sand into grass, grass into pine, pine into rock and snow.
  let base;
  if (h < 2.2) base = pal.sand;
  else if (h < 9) base = mix(pal.sand, pal.grassLow, (h - 2.2) / 6.8);
  else if (h < 46) base = mix(pal.grassLow, pal.grassHigh, (h - 9) / 37);
  else if (h < 62) base = mix(pal.grassHigh, pal.pine, (h - 46) / 16);
  else if (h < 112) base = pal.pine;
  else if (h < 132) base = mix(pal.pine, pal.rock, (h - 112) / 20);
  else if (h < 168) base = pal.rock;
  else if (h < 188) base = mix(pal.rock, pal.snow, (h - 168) / 20);
  else base = pal.snow;
  if (slope > 0.34 && h >= 2.2) base = mix(base, pal.rock, Math.min(1, (slope - 0.34) * 2.2));
  return base;
}

function collectRunway(list, basis, pal) {
  const y = RUNWAY.alt + 0.18;
  const hw = RUNWAY.width / 2;
  const hl = RUNWAY.length / 2;
  const corners = [
    { x: RUNWAY.cx - hw, y, z: RUNWAY.cz - hl },
    { x: RUNWAY.cx + hw, y, z: RUNWAY.cz - hl },
    { x: RUNWAY.cx + hw, y, z: RUNWAY.cz + hl },
    { x: RUNWAY.cx - hw, y, z: RUNWAY.cz + hl },
  ];
  pushWorldPoly(list, basis, corners, '#7a7c46', 1);
  // Centreline dashes and threshold bars, so a landing reads as a landing.
  for (let d = -hl + 40; d < hl - 30; d += 56) {
    pushWorldPoly(list, basis, [
      { x: RUNWAY.cx - 0.8, y, z: RUNWAY.cz + d },
      { x: RUNWAY.cx + 0.8, y, z: RUNWAY.cz + d },
      { x: RUNWAY.cx + 0.8, y, z: RUNWAY.cz + d + 22 },
      { x: RUNWAY.cx - 0.8, y, z: RUNWAY.cz + d + 22 },
    ], '#e8dfc8', 1);
  }
  for (const end of [-1, 1]) {
    for (let b = -2; b <= 2; b++) {
      if (b === 0) continue;
      pushWorldPoly(list, basis, [
        { x: RUNWAY.cx + b * 4.4 - 1.5, y, z: RUNWAY.cz + end * (hl - 16) },
        { x: RUNWAY.cx + b * 4.4 + 1.5, y, z: RUNWAY.cz + end * (hl - 16) },
        { x: RUNWAY.cx + b * 4.4 + 1.5, y, z: RUNWAY.cz + end * (hl - 4) },
        { x: RUNWAY.cx + b * 4.4 - 1.5, y, z: RUNWAY.cz + end * (hl - 4) },
      ], '#e8dfc8', 1);
    }
  }
}

// --- props, clouds, rings, targets, parcels -------------------------------

function collectProps(list, basis, pal, timeSec) {
  // Imported lazily through a parameter would tangle the module graph; the
  // world list is read from the global registry the world module fills.
  for (const prop of worldProps) {
    const dx = prop.x - cam.x;
    const dz = prop.z - cam.z;
    if (dx * dx + dz * dz > 2100 * 2100) continue;
    drawProp(list, basis, prop, pal, timeSec);
  }
}

// The world module's prop list, bound at boot by main.js (avoids a cycle:
// world.js does not know render.js, render.js reads what main hands it).
let worldProps = [];
let worldClouds = [];
export function bindWorld(props, clouds) {
  worldProps = props;
  worldClouds = clouds;
}

function drawProp(list, basis, prop, pal, timeSec) {
  const { x, z, y, s } = prop;
  if (prop.kind === 'pine' || prop.kind === 'palm') {
    const trunk = [
      { x: x - 0.5 * s, y, z }, { x: x + 0.5 * s, y, z },
      { x: x + 0.35 * s, y: y + 3.4 * s, z }, { x: x - 0.35 * s, y: y + 3.4 * s, z },
    ];
    pushWorldPoly(list, basis, trunk, '#6b4a2f', 0.9);
    const tiers = prop.kind === 'pine' ? 3 : 1;
    for (let t = 0; t < tiers; t++) {
      const baseY = y + (2.6 + t * 1.9) * s;
      const w = (3.6 - t * 0.95) * s;
      const topY = baseY + 3.4 * s;
      pushWorldPoly(list, basis, [
        { x: x - w, y: baseY, z }, { x: x + w, y: baseY, z }, { x, y: topY, z },
      ], prop.kind === 'pine' ? pal.pine : '#5d7d3a', 0.85 + t * 0.1);
      pushWorldPoly(list, basis, [
        { x, y: baseY, z: z - w }, { x, y: baseY, z: z + w }, { x, y: topY, z },
      ], prop.kind === 'pine' ? pal.pine : '#5d7d3a', 1.05 + t * 0.1);
    }
  } else if (prop.kind === 'house') {
    const c = Math.cos(prop.rot), sn = Math.sin(prop.rot);
    const corner = (lx, lz) => ({ x: x + (lx * c - lz * sn) * s, y: 0, z: z + (lx * sn + lz * c) * s });
    const w = 4.6, d = 3.6, wallH = 3.1;
    const a = corner(-w / 2, -d / 2), b = corner(w / 2, -d / 2), cc = corner(w / 2, d / 2), dd = corner(-w / 2, d / 2);
    for (const [p, q] of [[a, b], [b, cc], [cc, dd], [dd, a]]) {
      pushWorldPoly(list, basis, [
        { ...p, y }, { ...q, y },
        { x: q.x, y: y + wallH * s, z: q.z }, { x: p.x, y: y + wallH * s, z: p.z },
      ], '#e6d3ac', 0.92);
    }
    pushWorldPoly(list, basis, [
      { x: a.x, y: y + wallH * s, z: a.z }, { x: b.x, y: y + wallH * s, z: b.z },
      { x: (b.x + cc.x) / 2, y: y + (wallH + 2.1) * s, z: (b.z + cc.z) / 2 },
      { x: (a.x + dd.x) / 2, y: y + (wallH + 2.1) * s, z: (a.z + dd.z) / 2 },
    ], '#a34a2e', 1);
  } else if (prop.kind === 'lighthouse') {
    for (let seg = 0; seg < 6; seg++) {
      const a0 = (seg / 6) * Math.PI * 2;
      const a1 = ((seg + 1) / 6) * Math.PI * 2;
      pushWorldPoly(list, basis, [
        { x: x + Math.cos(a0) * 2.6 * s, y, z: z + Math.sin(a0) * 2.6 * s },
        { x: x + Math.cos(a1) * 2.6 * s, y, z: z + Math.sin(a1) * 2.6 * s },
        { x: x + Math.cos(a1) * 1.9 * s, y: y + 15 * s, z: z + Math.sin(a1) * 1.9 * s },
        { x: x + Math.cos(a0) * 1.9 * s, y: y + 15 * s, z: z + Math.sin(a0) * 1.9 * s },
      ], seg % 2 ? '#e8e0cc' : '#b8433a', 0.9 + 0.1 * Math.cos(a0 + 0.5));
    }
    pushWorldPoly(list, basis, [
      { x: x - 2.2 * s, y: y + 15 * s, z }, { x: x + 2.2 * s, y: y + 15 * s, z },
      { x, y: y + 18.4 * s, z },
    ], '#3a3f4a', 1);
  } else if (prop.kind === 'windsock') {
    pushWorldPoly(list, basis, [
      { x: x - 0.18, y, z }, { x: x + 0.18, y, z },
      { x: x + 0.18, y: y + 7, z }, { x: x - 0.18, y: y + 7, z },
    ], '#d8d2c2', 0.9);
    const wave = Math.sin(timeSec * 3) * 0.5;
    pushWorldPoly(list, basis, [
      { x, y: y + 7, z }, { x: x + 3.6, y: y + 6.6 + wave * 0.3, z },
      { x: x + 3.6, y: y + 5.7 + wave * 0.3, z }, { x, y: y + 6.1, z },
    ], '#e06a2c', 1.05);
  } else if (prop.kind === 'hangar') {
    pushWorldPoly(list, basis, [
      { x: x - 9, y, z: z - 6 }, { x: x + 9, y, z: z - 6 },
      { x: x + 9, y: y + 5.4, z: z - 6 }, { x: x - 9, y: y + 5.4, z: z - 6 },
    ], '#7d6a52', 0.95);
    pushWorldPoly(list, basis, [
      { x: x - 9, y: y + 5.4, z: z - 6 }, { x: x + 9, y: y + 5.4, z: z - 6 },
      { x: x + 9, y: y + 5.4, z: z + 6 }, { x: x - 9, y: y + 5.4, z: z + 6 },
    ], '#5d4f3c', 1.05);
    pushWorldPoly(list, basis, [
      { x: x - 9, y, z: z + 6 }, { x: x + 9, y, z: z + 6 },
      { x: x + 9, y: y + 5.4, z: z + 6 }, { x: x - 9, y: y + 5.4, z: z + 6 },
    ], '#6d5c46', 0.85);
  }
}

function collectClouds(list, basis, pal, timeSec, storm) {
  worldClouds.forEach((cloud, index) => {
    const driftX = cloud.x + timeSec * cloud.drift;
    const centre = projectPoint(basis, driftX, cloud.y, cloud.z);
    if (!centre || centre.depth > 5200) return;
    const r = (cloud.s * FOCAL) / centre.depth;
    list.push(centre.depth + 40, 'cloud', centre.x, centre.y, r, { storm, seed: index * 3.7 });
  });
}

function collectRings(list, basis, nextIndex) {
  RING_COURSE.forEach((ring, index) => {
    if (index < nextIndex) return;
    const isNext = index === nextIndex;
    const yaw = (ring.yaw * Math.PI) / 180;
    const rx = Math.cos(yaw), rz = Math.sin(yaw);
    const pts = [];
    let depthSum = 0;
    let ok = true;
    for (let s = 0; s <= 22; s++) {
      const a = (s / 22) * Math.PI * 2;
      const p = projectPoint(
        basis,
        ring.x + rx * Math.cos(a) * RING_RADIUS,
        ring.alt + Math.sin(a) * RING_RADIUS,
        ring.z + rz * Math.cos(a) * RING_RADIUS,
      );
      if (!p) { ok = false; break; }
      pts.push(p);
      depthSum += p.depth;
    }
    if (!ok) return;
    const depth = depthSum / pts.length;
    if (isNext) list.push(depth, 'ringGlow', pts, null, null, 0);
    list.push(depth, 'ring', pts, isNext ? '#ffd968' : 'rgba(140, 230, 220, 0.55)', null, 0);
  });
}

function collectTarget(list, basis, target, timeSec) {
  const pts = [];
  let depthSum = 0;
  for (let s = 0; s <= 26; s++) {
    const a = (s / 26) * Math.PI * 2;
    const p = projectPoint(basis, target.x + Math.cos(a) * target.r, target.y + 0.4, target.z + Math.sin(a) * target.r);
    if (!p) return;
    pts.push(p);
    depthSum += p.depth;
  }
  list.push(depthSum / pts.length, 'ring', pts, '#ff9d4d', null, 0);
  // A pillar of light over the active pad, pulsing gently — visible for miles.
  const base = projectPoint(basis, target.x, target.y, target.z);
  const top = projectPoint(basis, target.x, target.y + 130, target.z);
  if (base && top) {
    const w = Math.max(2, (5.5 * FOCAL) / base.depth);
    list.push(base.depth, 'beam', { x: base.x, y: base.y }, { x: top.x, y: top.y }, w, 0.13 + 0.05 * Math.sin(timeSec * 2.4));
  }
}

function collectParcel(list, basis, parcel) {
  const s = 0.55;
  const box = [
    { x: parcel.x - s, y: parcel.y - s, z: parcel.z },
    { x: parcel.x + s, y: parcel.y - s, z: parcel.z },
    { x: parcel.x + s, y: parcel.y + s, z: parcel.z },
    { x: parcel.x - s, y: parcel.y + s, z: parcel.z },
  ];
  pushWorldPoly(list, basis, box, '#b07a3e', 1);
  if (parcel.chute) {
    const c = projectPoint(basis, parcel.x, parcel.y + 2.6, parcel.z);
    if (c) list.push(c.depth, 'chute', c.x, c.y, (3.4 * FOCAL) / c.depth, null);
    const top = projectPoint(basis, parcel.x, parcel.y + 2.4, parcel.z);
    const bot = projectPoint(basis, parcel.x, parcel.y, parcel.z);
    if (top && bot) list.push(bot.depth, 'line', top, bot, 'rgba(240,230,210,0.8)', 1);
  }
}

// Project a world-space polygon and queue it with sun shading applied.
export function pushWorldPoly(list, basis, worldPts, fill, shadeFactor = 1) {
  const pts = [];
  let depthSum = 0;
  for (const p of worldPts) {
    const s = projectPoint(basis, p.x, p.y, p.z);
    if (!s) return;
    pts.push(s);
    depthSum += s.depth;
  }
  const shaded = fill.startsWith('#') ? shade(fill, shadeFactor) : fill;
  list.push(depthSum / pts.length, 'poly', pts, shaded, null, 0);
}

function drawItem(ctx, item) {
  if (item.kind === 'poly') {
    const pts = item.a;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = item.b;
    ctx.fill();
  } else if (item.kind === 'ring') {
    const pts = item.a;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = item.b;
    ctx.lineWidth = Math.max(2, Math.min(10, 780 / item.depth));
    ctx.stroke();
  } else if (item.kind === 'ringGlow') {
    const pts = item.a;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 190, 80, 0.35)';
    ctx.lineWidth = Math.max(6, Math.min(26, 2600 / item.depth));
    ctx.stroke();
  } else if (item.kind === 'beam') {
    ctx.strokeStyle = `rgba(255, 170, 80, ${item.d})`;
    ctx.lineWidth = item.c;
    ctx.beginPath();
    ctx.moveTo(item.a.x, item.a.y);
    ctx.lineTo(item.b.x, item.b.y);
    ctx.stroke();
  } else if (item.kind === 'cloud') {
    // A cloud is a cluster of soft puffs, not a disc: six overlapping
    // ellipses at seeded offsets, lit warm on top, shaded underneath.
    const { a: x, b: y, c: r } = item;
    const { storm, seed } = item.d;
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const a = seed + i * 2.39;
      puffs.push({
        dx: Math.sin(a * 3.1) * r * 0.72,
        dy: Math.cos(a * 1.7) * r * 0.16,
        rx: r * (0.5 + (Math.abs(Math.sin(a * 5.3)) * 0.55)),
        ry: 0,
      });
      puffs[i].ry = puffs[i].rx * 0.46;
    }
    ctx.fillStyle = storm ? 'rgba(74, 80, 96, 0.82)' : 'rgba(250, 205, 150, 0.8)';
    ctx.beginPath();
    for (const puff of puffs) ctx.ellipse(x + puff.dx, y + puff.dy, puff.rx, puff.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!storm) {
      ctx.fillStyle = 'rgba(214, 138, 105, 0.28)';
      ctx.beginPath();
      for (const puff of puffs) ctx.ellipse(x + puff.dx, y + puff.dy + puff.ry * 0.55, puff.rx * 0.92, puff.ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (item.kind === 'chute') {
    ctx.beginPath();
    ctx.arc(item.a, item.b, Math.max(2, item.c), Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#e8e2d2';
    ctx.fill();
    ctx.strokeStyle = '#b8433a';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (item.kind === 'line') {
    ctx.strokeStyle = item.c;
    ctx.lineWidth = item.d;
    ctx.beginPath();
    ctx.moveTo(item.a.x, item.a.y);
    ctx.lineTo(item.b.x, item.b.y);
    ctx.stroke();
  }
}

// --- colour helpers --------------------------------------------------------

const colourCache = new Map();

export function shade(colour, factor) {
  const key = colour + '|' + factor.toFixed(3);
  const hit = colourCache.get(key);
  if (hit) return hit;
  const { r, g, b } = colour.startsWith('#') ? hexRgb(colour) : rgbOf(colour);
  const out = `rgb(${clamp255(r * factor)}, ${clamp255(g * factor)}, ${clamp255(b * factor)})`;
  if (colourCache.size > 4000) colourCache.clear();
  colourCache.set(key, out);
  return out;
}

export function mix(colourA, colourB, t) {
  const a = colourA.startsWith('#') ? hexRgb(colourA) : rgbOf(colourA);
  const b = colourB.startsWith('#') ? hexRgb(colourB) : rgbOf(colourB);
  return `rgb(${clamp255(a.r + (b.r - a.r) * t)}, ${clamp255(a.g + (b.g - a.g) * t)}, ${clamp255(a.b + (b.b - a.b) * t)})`;
}

function fogged(colour, depth, pal) {
  const f = Math.min(1, Math.max(0, (depth - 620) / 2600)) * 0.82;
  if (f <= 0.01) return colour;
  const c = colour.startsWith('#') ? hexRgb(colour) : rgbOf(colour);
  const fog = hexRgb(pal.skyHorizon);
  return `rgb(${clamp255(c.r + (fog.r - c.r) * f)}, ${clamp255(c.g + (fog.g - c.g) * f)}, ${clamp255(c.b + (fog.b - c.b) * f)})`;
}

function hexRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbOf(rgb) {
  const m = rgb.match(/\d+(\.\d+)?/g);
  return { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]) };
}

function clamp255(v) {
  return Math.round(Math.min(255, Math.max(0, v)));
}

function norm3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
