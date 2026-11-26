// plane.js — the Wren D-4 “Duskwing” herself: a high-wing bush aeroplane
// built from flat-shaded polygons in her own local frame, then rolled,
// pitched and yawed into the world each frame. Cream and red livery, a
// glass canopy, fixed gear with fat tyres for rough strips, and a prop
// that blurs to a disc when she is working.

const SUN = norm3(-0.52, 0.55, -0.44);

// Local frame: x right, y up, z toward the nose. Cross-sections of the
// fuselage from nose to tail: z, half-width, top, bottom.
const SECTIONS = [
  { z: 2.6, hw: 0.40, top: 0.40, bot: -0.36 },
  { z: 0.7, hw: 0.56, top: 0.60, bot: -0.50 },
  { z: -1.6, hw: 0.47, top: 0.48, bot: -0.38 },
  { z: -4.2, hw: 0.15, top: 0.28, bot: -0.10 },
];

const CREAM = '#f0dfba';
const CREAM_DARK = '#d9c491';
const RED = '#c8512f';
const RED_DARK = '#9c3a22';
const GLASS = '#33566b';
const TYRE = '#2c2724';
const METAL = '#8b8578';

export function planePolygons(plane) {
  const polys = [];
  const put = (localPts, fill) => {
    const world = localPts.map((p) => toWorld(plane, p));
    polys.push({ pts: world, fill, shade: faceShade(world) });
  };
  const putFixed = (localPts, fill, shadeFactor) => {
    const world = localPts.map((p) => toWorld(plane, p));
    polys.push({ pts: world, fill, shade: shadeFactor });
  };

  // Fuselage: quads stitched between neighbouring cross-sections.
  for (let i = 0; i < SECTIONS.length - 1; i++) {
    const a = SECTIONS[i];
    const b = SECTIONS[i + 1];
    put([pt(-a.hw, a.top, a.z), pt(a.hw, a.top, a.z), pt(b.hw, b.top, b.z), pt(-b.hw, b.top, b.z)], CREAM); // top
    put([pt(-a.hw, a.bot, a.z), pt(-b.hw, b.bot, b.z), pt(b.hw, b.bot, b.z), pt(a.hw, a.bot, a.z)], CREAM_DARK); // belly
    put([pt(-a.hw, a.top, a.z), pt(-b.hw, b.top, b.z), pt(-b.hw, b.bot, b.z), pt(-a.hw, a.bot, a.z)], CREAM); // left
    put([pt(a.hw, a.top, a.z), pt(a.hw, a.bot, a.z), pt(b.hw, b.bot, b.z), pt(b.hw, b.top, b.z)], CREAM); // right
  }
  // Nose cap and a darker cowl band behind the prop.
  const nose = SECTIONS[0];
  put([pt(-nose.hw, nose.top, nose.z), pt(nose.hw, nose.top, nose.z), pt(nose.hw, nose.bot, nose.z), pt(-nose.hw, nose.bot, nose.z)], RED_DARK);

  // Canopy: a glasshouse over the cabin, with a sloped windscreen.
  put([pt(-0.44, 0.60, 0.75), pt(0.44, 0.60, 0.75), pt(0.40, 1.06, 0.05), pt(-0.40, 1.06, 0.05)], GLASS);
  put([pt(-0.40, 1.06, 0.05), pt(0.40, 1.06, 0.05), pt(0.38, 1.04, -1.15), pt(-0.38, 1.04, -1.15)], GLASS);
  put([pt(-0.44, 0.60, 0.75), pt(-0.40, 1.06, 0.05), pt(-0.38, 1.04, -1.15), pt(-0.42, 0.60, -1.15)], GLASS);
  put([pt(0.44, 0.60, 0.75), pt(0.42, 0.60, -1.15), pt(0.38, 1.04, -1.15), pt(0.40, 1.06, 0.05)], GLASS);

  // High wing: a thin red box on top, cream underneath, struts to the belly.
  put([pt(-4.6, 1.02, 0.85), pt(4.6, 1.02, 0.85), pt(4.6, 1.02, -0.75), pt(-4.6, 1.02, -0.75)], RED);
  put([pt(-4.6, 0.90, 0.85), pt(-4.6, 0.90, -0.75), pt(4.6, 0.90, -0.75), pt(4.6, 0.90, 0.85)], CREAM_DARK);
  put([pt(-4.6, 1.02, 0.85), pt(-4.6, 0.90, 0.85), pt(-4.6, 0.90, -0.75), pt(-4.6, 1.02, -0.75)], RED_DARK);
  put([pt(4.6, 1.02, 0.85), pt(4.6, 1.02, -0.75), pt(4.6, 0.90, -0.75), pt(4.6, 0.90, 0.85)], RED_DARK);
  for (const side of [-1, 1]) {
    put([pt(side * 0.5, -0.42, 0.55), pt(side * 0.62, -0.42, 0.35), pt(side * 1.7, 0.92, 0.1), pt(side * 1.7, 0.92, 0.3)], METAL);
  }

  // Tail: red fin and a cream tailplane at the back.
  put([pt(-0.07, 0.25, -4.35), pt(0.07, 0.25, -4.35), pt(0.07, 1.3, -3.9), pt(-0.07, 1.3, -3.9)], RED);
  put([pt(-0.07, 0.25, -3.35), pt(-0.07, 1.3, -3.9), pt(0.07, 1.3, -3.9), pt(0.07, 0.25, -3.35)], RED_DARK);
  put([pt(-1.75, 0.22, -4.3), pt(1.75, 0.22, -4.3), pt(1.75, 0.22, -3.45), pt(-1.75, 0.22, -3.45)], CREAM);
  put([pt(-1.75, 0.13, -4.3), pt(-1.75, 0.13, -3.45), pt(1.75, 0.13, -3.45), pt(1.75, 0.13, -4.3)], CREAM_DARK);

  // Fixed gear: two legs, fat tyres, and a tail wheel.
  for (const side of [-1, 1]) {
    put([pt(side * 0.8, -0.45, 0.75), pt(side * 0.95, -0.45, 0.55), pt(side * 1.0, -1.28, 0.6), pt(side * 0.85, -1.28, 0.8)], METAL);
    put([pt(side * 1.0 - 0.14, -1.58, 0.92), pt(side * 1.0 + 0.14, -1.58, 0.92), pt(side * 1.0 + 0.14, -1.02, 0.92), pt(side * 1.0 - 0.14, -1.02, 0.92)], TYRE);
    put([pt(side * 1.0 - 0.14, -1.58, 0.38), pt(side * 1.0 - 0.14, -1.02, 0.38), pt(side * 1.0 + 0.14, -1.02, 0.38), pt(side * 1.0 + 0.14, -1.58, 0.38)], TYRE);
  }
  put([pt(-0.1, -0.5, -3.95), pt(0.1, -0.5, -3.95), pt(0.1, -0.18, -3.8), pt(-0.1, -0.18, -3.8)], TYRE);

  // Propeller: a blurred disc and two blade streaks, spinning with the engine.
  const disc = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    disc.push(pt(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 2.68));
  }
  putFixed(disc, 'rgba(28, 24, 22, 0.34)', 1);
  for (const offset of [0, Math.PI]) {
    const a = plane.propSpin + offset;
    const tip = { x: Math.cos(a) * 1.04, y: Math.sin(a) * 1.04 };
    const root = { x: Math.cos(a) * 0.16, y: Math.sin(a) * 0.16 };
    const perp = { x: -Math.sin(a) * 0.09, y: Math.cos(a) * 0.09 };
    putFixed([
      pt(root.x + perp.x, root.y + perp.y, 2.7), pt(tip.x + perp.x, tip.y + perp.y, 2.7),
      pt(tip.x - perp.x, tip.y - perp.y, 2.7), pt(root.x - perp.x, root.y - perp.y, 2.7),
    ], '#3a332c', 1);
  }
  putFixed([pt(-0.16, 0.16, 2.72), pt(0.16, 0.16, 2.72), pt(0.16, -0.16, 2.72), pt(-0.16, -0.16, 2.72)], METAL, 1);

  return polys;
}

function pt(x, y, z) {
  return { x, y, z };
}

// Local → world: roll about the nose axis, pitch about the wing axis, then
// the heading rotation and the plane's position.
function toWorld(plane, p) {
  const cr = Math.cos(plane.roll);
  const sr = Math.sin(plane.roll);
  const x1 = p.x * cr + p.y * sr;
  const y1 = -p.x * sr + p.y * cr;
  const cp = Math.cos(plane.pitch);
  const sp = Math.sin(plane.pitch);
  const y2 = y1 * cp + p.z * sp;
  const z2 = -y1 * sp + p.z * cp;
  const ch = Math.cos(plane.heading);
  const sh = Math.sin(plane.heading);
  return {
    x: plane.x + x1 * ch + z2 * sh,
    y: plane.y + y2,
    z: plane.z + x1 * sh - z2 * ch,
  };
}

// Flat shading from the face normal, warm sun from the west.
function faceShade(worldPts) {
  const [a, b, c] = worldPts;
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  const n = norm3(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  const facing = Math.abs(n.x * SUN.x + n.y * SUN.y + n.z * SUN.z);
  return 0.5 + 0.58 * facing;
}

function norm3(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}
