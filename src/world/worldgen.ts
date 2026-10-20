import { CENTER, TOTAL_GARBAGE, WORLD_TILES, tileIndex, inWorld } from '../core/constants';
import { fbm, hash2, mulberry, pickWeighted, valueNoise } from '../core/rng';
import { DISCOVERIES } from '../data/discoveries';
import {
  G_ASPHALT, G_CONCRETE, G_RUINFLOOR, R_CARS, R_CLEARING, R_CONSTRUCTION, R_DOMESTIC, R_ELECTRONICS,
  R_INDUSTRIAL, R_MYSTERY, R_TIRES, REGIONS,
} from '../data/regions';

export const DECO_RUINWALL = 1;
export const DECO_ROAD_H = 2;
export const DECO_ROAD_V = 4;

export interface SpecialPlacement { index: number; tx: number; ty: number; size: number }

export interface GeneratedWorld {
  initial: Uint8Array;
  region: Uint8Array;
  ground: Uint8Array;
  deco: Uint8Array;
  specials: SpecialPlacement[];
}

export const SEED = 1337;
export const DEPOT = { tx: CENTER - 1, ty: CENTER - 1, size: 3 };

export function clearingRadius(tx: number, ty: number): number {
  const a = Math.atan2(ty - CENTER, tx - CENTER);
  return 5.4 + 1.6 * valueNoise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, SEED + 9) + 1.1 * valueNoise(Math.cos(a) * 6 + 9, Math.sin(a) * 6 + 9, SEED + 10);
}

export function generateWorld(): GeneratedWorld {
  const N = WORLD_TILES * WORLD_TILES;
  const initial = new Uint8Array(N);
  const region = new Uint8Array(N);
  const ground = new Uint8Array(N);
  const deco = new Uint8Array(N);
  const weights = new Float32Array(N);
  const rand = mulberry(SEED);

  // --- regions: warped voronoi ---
  const seeds: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 56; i++) {
    const x = rand() * WORLD_TILES, y = rand() * WORLD_TILES;
    const d = Math.hypot(x - CENTER, y - CENTER);
    const opts: [number, number][] = [
      [R_DOMESTIC, d < 40 ? 6 : 3], [R_TIRES, 2], [R_ELECTRONICS, d > 25 ? 2.2 : 0.8], [R_CARS, d > 30 ? 2 : 0.6],
      [R_CONSTRUCTION, 2], [R_INDUSTRIAL, d > 45 ? 2.2 : 0.4], [R_MYSTERY, d > 70 ? 1.2 : 0],
    ];
    seeds.push({ x, y, r: pickWeighted(opts, rand()) });
  }
  seeds.push({ x: CENTER, y: CENTER, r: R_DOMESTIC });

  for (let ty = 0; ty < WORLD_TILES; ty++) {
    for (let tx = 0; tx < WORLD_TILES; tx++) {
      const wx = tx + (fbm(tx / 18, ty / 18, SEED + 1, 3) - 0.5) * 22;
      const wy = ty + (fbm(tx / 18, ty / 18, SEED + 2, 3) - 0.5) * 22;
      let best = 1e9, br = R_DOMESTIC;
      for (const s of seeds) {
        const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
        if (d < best) { best = d; br = s.r; }
      }
      const i = tileIndex(tx, ty);
      region[i] = br;
      ground[i] = REGIONS[br].ground;
    }
  }

  // --- specials placement (needs mystery regions forced around some) ---
  const specials: SpecialPlacement[] = [];
  const taken = new Set<number>();
  DISCOVERIES.forEach((def, index) => {
    for (let attempt = 0; attempt < 400; attempt++) {
      const ang = rand() * Math.PI * 2;
      const dist = def.dist[0] + rand() * (def.dist[1] - def.dist[0]);
      const tx = Math.round(CENTER + Math.cos(ang) * dist);
      const ty = Math.round(CENTER + Math.sin(ang) * dist);
      if (tx < 3 || ty < 3 || tx + def.size > WORLD_TILES - 3 || ty + def.size > WORLD_TILES - 3) continue;
      let ok = true;
      for (let y = -3; y < def.size + 3 && ok; y++) for (let x = -3; x < def.size + 3; x++) if (taken.has(tileIndex(tx + x, ty + y))) { ok = false; break; }
      if (!ok) continue;
      for (let y = -3; y < def.size + 3; y++) for (let x = -3; x < def.size + 3; x++) taken.add(tileIndex(tx + x, ty + y));
      specials.push({ index, tx, ty, size: def.size });
      if (def.mystery) {
        for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
          const ax = tx + x, ay = ty + y;
          if (!inWorld(ax, ay) || x * x + y * y > 81 + hash2(ax, ay, 4) * 20) continue;
          region[tileIndex(ax, ay)] = R_MYSTERY;
          ground[tileIndex(ax, ay)] = G_RUINFLOOR;
        }
      }
      break;
    }
  });

  // --- roads ---
  const roadsH = [38, 61, 131, 152];
  const roadsV = [44, 71, 122, 149];
  for (const ry of roadsH) for (let tx = 0; tx < WORLD_TILES; tx++) {
    if (valueNoise(tx / 9, ry, SEED + 7) < 0.28) continue;
    for (let k = 0; k < 2; k++) { const i = tileIndex(tx, ry + k); ground[i] = G_ASPHALT; if (k === 0) deco[i] |= DECO_ROAD_H; }
  }
  for (const rx of roadsV) for (let ty = 0; ty < WORLD_TILES; ty++) {
    if (valueNoise(rx, ty / 9, SEED + 8) < 0.28) continue;
    for (let k = 0; k < 2; k++) { const i = tileIndex(rx + k, ty); ground[i] = G_ASPHALT; if (k === 0) deco[i] |= DECO_ROAD_V; }
  }

  // --- concrete slabs in industrial / electronics ---
  for (let ty = 0; ty < WORLD_TILES; ty++) for (let tx = 0; tx < WORLD_TILES; tx++) {
    const i = tileIndex(tx, ty);
    const r = region[i];
    if ((r === R_INDUSTRIAL || r === R_CARS || r === R_CONSTRUCTION) && ground[i] !== G_ASPHALT && fbm(tx / 7, ty / 7, SEED + 11, 2) > 0.62) ground[i] = G_CONCRETE;
  }

  // --- ruin buildings: wall outlines ---
  for (let k = 0; k < 70; k++) {
    const x0 = Math.floor(rand() * (WORLD_TILES - 14)) + 4, y0 = Math.floor(rand() * (WORLD_TILES - 14)) + 4;
    if (Math.hypot(x0 - CENTER, y0 - CENTER) < 16) continue;
    const reg = region[tileIndex(x0, y0)];
    if (reg !== R_MYSTERY && rand() > 0.35) continue;
    const w = 4 + Math.floor(rand() * 6), h = 4 + Math.floor(rand() * 5);
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      const i = tileIndex(x0 + x, y0 + y);
      ground[i] = G_RUINFLOOR;
      const edge = x === 0 || y === 0 || x === w || y === h;
      if (edge && hash2(x0 + x, y0 + y, 77) > 0.25) deco[i] |= DECO_RUINWALL;
    }
  }

  // --- garbage weights ---
  let sum = 0;
  for (let ty = 0; ty < WORLD_TILES; ty++) for (let tx = 0; tx < WORLD_TILES; tx++) {
    const i = tileIndex(tx, ty);
    const d = Math.hypot(tx + 0.5 - CENTER, ty + 0.5 - CENTER);
    const cr = clearingRadius(tx, ty);
    if (d < cr) { region[i] = R_CLEARING; ground[i] = REGIONS[R_CLEARING].ground; continue; }
    const ramp = Math.min(1, (d - cr) / 4);
    // patchy border: some tiles near the clearing are already clean
    if (hash2(tx, ty, 55) < (1 - ramp) * 0.55) { weights[i] = 0; continue; }
    const base = fbm(tx / 13, ty / 13, SEED + 20, 4);
    const mound = Math.max(0, fbm(tx / 5, ty / 5, SEED + 21, 3) - 0.45) * 2.2;
    const reg = REGIONS[region[i]];
    let w = reg.density * Math.pow(0.35 + base * 1.1 + mound, 1.4) * (0.55 + 0.45 * ramp);
    if (ground[i] === G_ASPHALT) w *= 0.8;
    // a gentle increase towards the edges of the world
    w *= 0.85 + Math.min(1, d / 90) * 0.35;
    w *= 0.85 + hash2(tx, ty, 99) * 0.3;
    weights[i] = w;
    sum += w;
  }
  for (const sp of specials) for (let y = 0; y < sp.size; y++) for (let x = 0; x < sp.size; x++) {
    const i = tileIndex(sp.tx + x, sp.ty + y);
    if (weights[i] === 0) region[i] = R_DOMESTIC;
    sum += Math.max(0, 1.2 - weights[i]);
    weights[i] = Math.max(weights[i], 1.2);
  }

  const scale = TOTAL_GARBAGE / sum;
  let total = 0;
  const frac: number[] = [];
  for (let i = 0; i < N; i++) {
    if (weights[i] <= 0) continue;
    const v = Math.min(250, weights[i] * scale);
    const f = Math.floor(v);
    initial[i] = f;
    total += f;
    if (f < 250) frac.push(i);
  }
  // distribute the remainder deterministically so the world has exactly TOTAL_GARBAGE units
  let k = 0;
  while (total < TOTAL_GARBAGE && frac.length) {
    const i = frac[Math.floor(hash2(k, 7, SEED) * frac.length)];
    k++;
    if (initial[i] >= 250) continue;
    initial[i]++;
    total++;
  }
  while (total > TOTAL_GARBAGE) {
    const i = Math.floor(hash2(k++, 9, SEED) * N);
    if (initial[i] > 1) { initial[i]--; total--; }
  }
  return { initial, region, ground, deco, specials };
}
