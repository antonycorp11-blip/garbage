import { TILE, WORLD_TILES } from '../core/constants';
import { hash3, pickWeighted } from '../core/rng';
import { BIG_ITEMS, REGIONS } from '../data/regions';
import { KIND_INDEX, ROTS, VARIANTS } from './sprites';

export interface TileItem { spr: number; x: number; y: number; layer: number; order: number; scale: number }

const HEAP = KIND_INDEX.heap;

const regionKinds = REGIONS.map((r) => ({
  all: r.items.map(([k, w]) => [KIND_INDEX[k], w] as const),
  small: r.items.filter(([k]) => !BIG_ITEMS.has(k)).map(([k, w]) => [KIND_INDEX[k], w] as const),
  bigSet: new Set(r.items.filter(([k]) => BIG_ITEMS.has(k)).map(([k]) => KIND_INDEX[k])),
}));

export function baseK(initial: number): number {
  return initial === 0 ? 0 : Math.min(18, 3 + Math.floor(initial / 2.2));
}

export function visibleK(count: number, initial: number): number {
  if (count <= 0) return 0;
  const b = baseK(initial);
  return Math.max(1, Math.ceil((b * count) / initial));
}

/** Deterministic list of decorative items representing a tile's garbage, bottom layer first. */
export function genTileItems(region: number, tx: number, ty: number, initial: number, out: TileItem[], from = 0, to = 99): void {
  const b = Math.min(baseK(initial), to);
  const rk = regionKinds[region] ?? regionKinds[1];
  for (let i = from; i < b; i++) {
    if (i === 0 && initial >= 34) {
      // dense tiles sit on a mound of compacted junk
      const hv = region === 2 ? 1 : region === 4 || region === 6 || region === 5 ? 2 : 0;
      const hr = hash3(tx, ty, 0, 15);
      out.push({ spr: HEAP * VARIANTS * ROTS + hv * ROTS + Math.floor(hr * ROTS), x: (tx + 0.5 + (hr - 0.5) * 0.3) * TILE, y: (ty + 0.6) * TILE, layer: -2, order: ty * WORLD_TILES + tx, scale: 0.85 + hr * 0.35 });
      continue;
    }
    const h1 = hash3(tx, ty, i, 11), h2 = hash3(tx, ty, i, 12), h3 = hash3(tx, ty, i, 13), h4 = hash3(tx, ty, i, 14);
    let kind = pickWeighted(i < 2 ? rk.all : rk.small, h1);
    const big = i < 2 && rk.bigSet.has(kind);
    if (big && h4 > 0.5) kind = pickWeighted(rk.small, h4);
    const isBig = rk.bigSet.has(kind);
    const spread = isBig ? 0.35 : 1.15;
    const variant = Math.floor(h3 * VARIANTS);
    const rot = Math.floor(((h3 * 97) % 1) * ROTS);
    const layer = i < b * 0.34 ? 0 : i < b * 0.67 ? 1 : 2;
    out.push({
      spr: kind * VARIANTS * ROTS + variant * ROTS + rot,
      x: (tx + 0.5 + (h2 - 0.5) * spread) * TILE,
      y: (ty + 0.5 + (((h2 * 7919) % 1) - 0.5) * spread) * TILE,
      layer: isBig ? -1 : layer,
      order: ty * WORLD_TILES + tx + i * 0.001,
      scale: isBig ? 1 : 0.88 + ((h1 * 7717) % 1) * 0.4,
    });
  }
}
