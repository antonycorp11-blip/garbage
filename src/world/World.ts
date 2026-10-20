import { CHUNKS, CHUNK, CHUNK_MARGIN, TOTAL_GARBAGE, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { MAT_COUNT, M_RARE } from '../data/materials';
import { REGIONS } from '../data/regions';
import { GeneratedWorld, SpecialPlacement, generateWorld } from './worldgen';

export type RemoveSource = 'player' | 'machine';
export type RemoveListener = (tile: number, before: number, after: number, source: RemoveSource) => void;

let cachedGen: GeneratedWorld | null = null;
function getGen(): GeneratedWorld {
  if (!cachedGen) cachedGen = generateWorld();
  return cachedGen;
}

export class World {
  readonly initial: Uint8Array;
  readonly region: Uint8Array;
  readonly ground: Uint8Array;
  readonly deco: Uint8Array;
  readonly specials: SpecialPlacement[];
  garbage: Uint8Array;
  /** building id occupying a tile, -1 if free */
  occupant: Int32Array;
  /** discovery placement index at a tile, -1 if none */
  specialAt: Int16Array;
  remaining = 0;
  chunkDirty: Uint8Array;
  /** per chunk remaining garbage, kept in sync for the map and locator */
  chunkRemaining: Int32Array;
  listeners: RemoveListener[] = [];

  constructor() {
    const g = getGen();
    this.initial = g.initial;
    this.region = g.region;
    this.ground = g.ground;
    this.deco = g.deco;
    this.specials = g.specials;
    this.garbage = new Uint8Array(g.initial);
    const N = WORLD_TILES * WORLD_TILES;
    this.occupant = new Int32Array(N).fill(-1);
    this.specialAt = new Int16Array(N).fill(-1);
    for (let s = 0; s < this.specials.length; s++) {
      const sp = this.specials[s];
      for (let y = 0; y < sp.size; y++) for (let x = 0; x < sp.size; x++) this.specialAt[tileIndex(sp.tx + x, sp.ty + y)] = s;
    }
    this.chunkDirty = new Uint8Array(CHUNKS * CHUNKS).fill(1);
    this.chunkRemaining = new Int32Array(CHUNKS * CHUNKS);
    this.recount();
  }

  recount() {
    let t = 0;
    this.chunkRemaining.fill(0);
    for (let i = 0; i < this.garbage.length; i++) {
      const g = this.garbage[i];
      if (!g) continue;
      t += g;
      const tx = i % WORLD_TILES, ty = (i / WORLD_TILES) | 0;
      this.chunkRemaining[((ty / CHUNK) | 0) * CHUNKS + ((tx / CHUNK) | 0)] += g;
    }
    this.remaining = t;
    this.chunkDirty.fill(1);
  }

  get removed() { return TOTAL_GARBAGE - this.remaining; }

  at(tx: number, ty: number): number {
    return inWorld(tx, ty) ? this.garbage[tileIndex(tx, ty)] : 0;
  }

  /** Removes up to n units from a tile. Returns the number really removed (never more than present). */
  remove(tile: number, n: number, source: RemoveSource): number {
    const before = this.garbage[tile];
    if (before <= 0 || n <= 0) return 0;
    const r = Math.min(before, Math.floor(n));
    if (r <= 0) return 0;
    const after = before - r;
    this.garbage[tile] = after;
    this.remaining -= r;
    const tx = tile % WORLD_TILES, ty = (tile / WORLD_TILES) | 0;
    this.chunkRemaining[((ty / CHUNK) | 0) * CHUNKS + ((tx / CHUNK) | 0)] -= r;
    this.markDirty(tx, ty);
    for (const l of this.listeners) l(tile, before, after, source);
    return r;
  }

  markDirty(tx: number, ty: number) {
    const c0x = Math.max(0, Math.floor((tx - CHUNK_MARGIN) / CHUNK)), c1x = Math.min(CHUNKS - 1, Math.floor((tx + CHUNK_MARGIN) / CHUNK));
    const c0y = Math.max(0, Math.floor((ty - CHUNK_MARGIN) / CHUNK)), c1y = Math.min(CHUNKS - 1, Math.floor((ty + CHUNK_MARGIN) / CHUNK));
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) this.chunkDirty[cy * CHUNKS + cx] = 1;
  }

  /** Assigns materials to n removed units of a tile. */
  rollMaterials(tile: number, n: number, rareChance: number, out: number[], rnd: () => number = Math.random): number[] {
    const reg = REGIONS[this.region[tile]];
    const w = reg.mats;
    const tot = w[0] + w[1] + w[2] + w[3] + w[4];
    const rc = rareChance * reg.rareMult;
    for (let k = 0; k < n; k++) {
      if (rnd() < rc) { out[M_RARE]++; continue; }
      let v = rnd() * tot;
      let m = 0;
      for (; m < MAT_COUNT - 2; m++) { v -= w[m]; if (v <= 0) break; }
      out[m]++;
    }
    return out;
  }

  isClean(tx: number, ty: number) {
    return inWorld(tx, ty) && this.garbage[tileIndex(tx, ty)] === 0;
  }

  /** Tile indices within a radius (tiles) of a point, sorted by distance. */
  tilesInRadius(cx: number, cy: number, r: number): Int32Array {
    const list: [number, number][] = [];
    const r2 = r * r;
    for (let ty = Math.floor(cy - r); ty <= Math.ceil(cy + r); ty++) for (let tx = Math.floor(cx - r); tx <= Math.ceil(cx + r); tx++) {
      if (!inWorld(tx, ty)) continue;
      const d = (tx + 0.5 - cx) ** 2 + (ty + 0.5 - cy) ** 2;
      if (d <= r2) list.push([tileIndex(tx, ty), d]);
    }
    list.sort((a, b) => a[1] - b[1]);
    return Int32Array.from(list.map((l) => l[0]));
  }

  serializeGarbage(): string {
    let s = '';
    const g = this.garbage;
    for (let i = 0; i < g.length; i += 8192) s += String.fromCharCode.apply(null, Array.from(g.subarray(i, i + 8192)));
    return btoa(s);
  }

  loadGarbage(b64: string): boolean {
    const s = atob(b64);
    if (s.length !== this.garbage.length) return false;
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const v = s.charCodeAt(i);
      if (v > this.initial[i]) return false;
      arr[i] = v;
    }
    this.garbage = arr;
    this.recount();
    return true;
  }
}

export const TOTAL = TOTAL_GARBAGE;
