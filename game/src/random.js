// random.js — a small seeded random generator and the value-noise field the
// archipelago is carved from. Seeded so the islands are the same islands on
// every visit: a pilot can learn this coast.

// mulberry32: tiny, fast, good enough for terrain and gusts.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, low, high) {
  return low + (high - low) * rng();
}

// A tileable value-noise grid: random heights at lattice points, smooth
// interpolation between them, summed over octaves for hills with detail.
export class NoiseField {
  constructor(seed, latticeSize = 64) {
    const rng = makeRng(seed);
    this.size = latticeSize;
    this.grid = new Float32Array(latticeSize * latticeSize);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng() * 2 - 1;
  }

  lattice(ix, iz) {
    const s = this.size;
    return this.grid[((iz % s + s) % s) * s + ((ix % s + s) % s)];
  }

  sample(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = this.lattice(ix, iz);
    const b = this.lattice(ix + 1, iz);
    const c = this.lattice(ix, iz + 1);
    const d = this.lattice(ix + 1, iz + 1);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  }

  // Fractal sum: broad swells plus fine roughness.
  fbm(x, z, octaves = 4) {
    let total = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      total += this.sample(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return total / norm;
  }
}
