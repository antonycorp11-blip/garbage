/** Deterministic integer hash -> [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hash3(x: number, y: number, z: number, seed = 0): number {
  return hash2(x + Math.imul(z, 7919), y - Math.imul(z, 104729), seed);
}

/** Small fast seeded PRNG (mulberry32). */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [0,1], optionally periodic. */
export function valueNoise(x: number, y: number, seed: number, period = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const w = (ix: number, iy: number) => {
    if (period > 0) { ix = ((ix % period) + period) % period; iy = ((iy % period) + period) % period; }
    return hash2(ix, iy, seed);
  };
  const a = w(x0, y0), b = w(x0 + 1, y0), c = w(x0, y0 + 1), d = w(x0 + 1, y0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x: number, y: number, seed: number, octaves = 4, period = 0): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 31, period ? period * freq : 0);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

export function pickWeighted<T>(items: readonly (readonly [T, number])[], r: number): T {
  let total = 0;
  for (const it of items) total += it[1];
  let v = r * total;
  for (const it of items) { v -= it[1]; if (v <= 0) return it[0]; }
  return items[items.length - 1][0];
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
