import { CHUNK, CHUNKS, CHUNK_MARGIN, TILE, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { hash2, valueNoise } from '../core/rng';
import { G_ASPHALT, G_DIRT, G_EARTH } from '../data/regions';
import { World } from '../world/World';
import { DECO_ROAD_H, DECO_ROAD_V, DECO_RUINWALL } from '../world/worldgen';
import { GROUND_PERIOD, buildDebris, buildGrime, buildGroundTextures } from './ground';
import { ctx2d, ellipse, lin, makeCanvas } from './paint';
import { ItemSprites } from './sprites';
import { TileItem, genTileItems, visibleK } from './tileItems';

const CPX = CHUNK * TILE;

export class ChunkRenderer {
  private cache = new Map<number, HTMLCanvasElement>();
  private pool: HTMLCanvasElement[] = [];
  private ground: HTMLCanvasElement[];
  private grime: HTMLCanvasElement;
  private debris: HTMLCanvasElement[];
  private items: TileItem[] = [];
  maxCached: number;
  rendersThisFrame = 0;

  constructor(private world: World, private spr: ItemSprites, public RS: number) {
    this.ground = buildGroundTextures(RS);
    this.grime = buildGrime(RS);
    this.debris = buildDebris(RS);
    const bytes = CPX * CPX * RS * RS * 4;
    this.maxCached = Math.max(48, Math.min(260, Math.floor(160e6 / bytes)));
  }

  has(cx: number, cy: number) { return this.cache.has(cy * CHUNKS + cx); }

  /** Returns the chunk canvas, rendering it if needed and allowed. */
  get(cx: number, cy: number, allowRender: boolean): HTMLCanvasElement | null {
    const key = cy * CHUNKS + cx;
    let cv = this.cache.get(key);
    const dirty = this.world.chunkDirty[key] === 1;
    if (cv && (!dirty || !allowRender)) {
      this.cache.delete(key); this.cache.set(key, cv); // LRU touch
      return cv;
    }
    if (!allowRender) return null;
    if (!cv) {
      cv = this.pool.pop() ?? makeCanvas(CPX * this.RS, CPX * this.RS);
      while (this.cache.size >= this.maxCached) {
        const oldest = this.cache.keys().next().value as number;
        const old = this.cache.get(oldest)!;
        this.cache.delete(oldest);
        this.world.chunkDirty[oldest] = 1;
        this.pool.push(old);
      }
    } else this.cache.delete(key);
    this.cache.set(key, cv);
    this.render(cx, cy, cv);
    this.world.chunkDirty[key] = 0;
    this.rendersThisFrame++;
    return cv;
  }

  private render(cx: number, cy: number, cv: HTMLCanvasElement) {
    const c = ctx2d(cv);
    const RS = this.RS;
    const w = this.world;
    const ox = cx * CPX, oy = cy * CPX;
    c.setTransform(RS, 0, 0, RS, -ox * RS, -oy * RS);
    c.imageSmoothingEnabled = true;
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
    // ground
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const i = tileIndex(tx, ty);
      let g = w.ground[i];
      if (g === G_DIRT && w.garbage[i] === 0) g = G_EARTH;
      const tex = this.ground[g];
      const sx = ((tx * TILE) % GROUND_PERIOD) * RS, sy = ((ty * TILE) % GROUND_PERIOD) * RS;
      c.drawImage(tex, sx, sy, TILE * RS, TILE * RS, tx * TILE, ty * TILE, TILE, TILE);
      // macro variation
      const v = valueNoise(tx / 5, ty / 5, 3) - 0.5;
      c.fillStyle = v > 0 ? `rgba(255,240,210,${v * 0.08})` : `rgba(20,10,0,${-v * 0.14})`;
      c.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
    // road markings & ruins on the ground
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const i = tileIndex(tx, ty);
      const d = w.deco[i];
      if (d & DECO_ROAD_H && tx % 2 === 0) { c.fillStyle = 'rgba(232,196,64,0.75)'; c.fillRect(tx * TILE + 6, (ty + 1) * TILE - 1.5, 20, 3); }
      if (d & DECO_ROAD_V && ty % 2 === 0) { c.fillStyle = 'rgba(232,196,64,0.75)'; c.fillRect((tx + 1) * TILE - 1.5, ty * TILE + 6, 3, 20); }
      if (w.ground[i] === G_ASPHALT && !(d & (DECO_ROAD_H | DECO_ROAD_V))) {
        // curb when next to non-asphalt
        const edge = (x: number, y: number) => inWorld(x, y) && w.ground[tileIndex(x, y)] !== G_ASPHALT;
        c.fillStyle = 'rgba(190,186,176,0.8)';
        if (edge(tx, ty - 1)) c.fillRect(tx * TILE, ty * TILE, TILE, 2.5);
        if (edge(tx, ty + 1)) c.fillRect(tx * TILE, (ty + 1) * TILE - 2.5, TILE, 2.5);
      }
    }
    // clean ground details: grass, flowers, stones
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const i = tileIndex(tx, ty);
      if (w.garbage[i] > 0 || w.ground[i] === G_ASPHALT) continue;
      const h = hash2(tx, ty, 41);
      if (h < 0.3) this.grass(c, tx, ty, h);
      else if (h > 0.93) {
        c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, tx * TILE + 16.5, ty * TILE + 18, 4, 2.4); c.fill();
        c.fillStyle = lin(c, 0, ty * TILE + 13, 0, ty * TILE + 19, [[0, '#a8a296'], [1, '#6e685d']]);
        ellipse(c, tx * TILE + 16, ty * TILE + 16.5, 3.6, 2.6); c.fill();
      }
    }
    // grime and debris under garbage (including margin tiles so edges blend)
    const m = CHUNK_MARGIN;
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (!inWorld(tx, ty)) continue;
      const i = tileIndex(tx, ty);
      const g = w.garbage[i];
      if (!g) continue;
      const dens = Math.min(1, g / 40);
      c.globalAlpha = 0.22 + 0.4 * dens;
      c.drawImage(this.grime, (tx + 0.5) * TILE - 30, (ty + 0.5) * TILE - 30, 60, 60);
      c.globalAlpha = 0.45 + 0.55 * dens;
      const dk = this.debris[Math.floor(hash2(tx, ty, 8) * this.debris.length)];
      c.drawImage(dk, (tx + 0.5) * TILE - 22, (ty + 0.5) * TILE - 22, 44, 44);
    }
    c.globalAlpha = 1;
    // ruin walls (low, 3/4)
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      if (!inWorld(tx, ty) || !(w.deco[tileIndex(tx, ty)] & DECO_RUINWALL)) continue;
      const x = tx * TILE, y = ty * TILE;
      const hh = 6 + hash2(tx, ty, 6) * 8;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 2, y + 20, TILE, 10);
      c.fillStyle = lin(c, 0, y + 18 - hh, 0, y + 26, [[0, '#8f8577'], [1, '#5f574c']]);
      c.fillRect(x, y + 26 - hh, TILE, hh);
      c.fillStyle = '#aaa192'; c.fillRect(x, y + 18 - hh, TILE, 8);
      c.strokeStyle = 'rgba(40,30,20,0.5)'; c.lineWidth = 0.6;
      c.strokeRect(x, y + 18 - hh, TILE, 8 + hh);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 11 + 4, y + 26 - hh); c.lineTo(x + k * 11 + 4, y + 26); c.stroke(); }
    }
    // garbage items
    const items = this.items;
    items.length = 0;
    for (let ty = ty0 - m; ty < ty0 + CHUNK + m; ty++) for (let tx = tx0 - m; tx < tx0 + CHUNK + m; tx++) {
      if (tx < 0 || ty < 0 || tx >= WORLD_TILES || ty >= WORLD_TILES) continue;
      const i = tileIndex(tx, ty);
      const g = w.garbage[i];
      if (!g) continue;
      const k = visibleK(g, w.initial[i]);
      genTileItems(w.region[i], tx, ty, w.initial[i], items, 0, k);
    }
    items.sort((a, b) => a.layer - b.layer || a.y - b.y || a.order - b.order);
    c.save();
    c.beginPath(); c.rect(ox, oy, CPX, CPX); c.clip();
    const sprites = this.spr.sprites, pages = this.spr.atlas.pages;
    for (const it of items) {
      const s = sprites[it.spr];
      if (it.x + s.w < ox || it.x - s.w > ox + CPX || it.y + s.h < oy || it.y - s.h > oy + CPX) continue;
      const k = it.scale;
      c.drawImage(pages[s.page], s.sx, s.sy, s.sw, s.sh, it.x - s.ax * k, it.y - s.ay * k, s.w * k, s.h * k);
    }
    c.restore();
  }

  private grass(c: CanvasRenderingContext2D, tx: number, ty: number, h: number) {
    const n = 2 + Math.floor(h * 10);
    for (let k = 0; k < n; k++) {
      const x = tx * TILE + hash2(tx * 7 + k, ty, 1) * 28 + 2, y = ty * TILE + hash2(tx, ty * 7 + k, 2) * 26 + 4;
      const g = 90 + Math.floor(hash2(tx + k, ty, 4) * 60);
      c.strokeStyle = `rgb(${g - 40},${g + 30},${g - 50})`;
      c.lineWidth = 0.9;
      c.beginPath();
      for (let b = -1; b <= 1; b++) { c.moveTo(x + b, y); c.quadraticCurveTo(x + b * 1.5, y - 3, x + b * 2.6, y - 4.5 - Math.abs(b)); }
      c.stroke();
    }
    if (h < 0.035) {
      c.fillStyle = ['#ffd54f', '#f48fb1', '#fff'][Math.floor(h * 1000) % 3];
      c.beginPath(); c.arc(tx * TILE + 14, ty * TILE + 12, 1.5, 0, 6.28); c.fill();
    }
  }
}
