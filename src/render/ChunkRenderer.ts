import { CHUNK, CHUNKS, CHUNK_MARGIN, TILE, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { hash2, valueNoise } from '../core/rng';
import { G_ASPHALT, G_DIRT, G_EARTH, G_GRAVEL } from '../data/regions';
import { World } from '../world/World';
import { DECO_ROAD_H, DECO_ROAD_V, DECO_RUINWALL } from '../world/worldgen';
import { buildDebris, buildGrime, buildGroundTextures } from './ground';
import { ctx2d, ellipse, lin, makeCanvas } from './paint';
import { ItemSprites } from './sprites';
import { drawProp, propAt } from './props';
import { TileItem, genTileItems, visibleK } from './tileItems';
import { drawMatIcon } from './matIcons';
import { MATERIALS } from '../data/materials';
import { REGIONS } from '../data/regions';

const CPX = CHUNK * TILE;

export class ChunkRenderer {
  private cache = new Map<number, HTMLCanvasElement>();
  private pool: HTMLCanvasElement[] = [];
  private ground: HTMLCanvasElement[];
  private grime: HTMLCanvasElement;
  /** soft teal glow painted where junk used to be */
  private bloom: HTMLCanvasElement;
  private debris: HTMLCanvasElement[];
  private items: TileItem[] = [];
  maxCached: number;
  rendersThisFrame = 0;
  private renderedAt = new Map<number, number>();
  lastRender(key: number) { return this.renderedAt.get(key) ?? -1e9; }

  /** output resolution of chunk canvases (≤ the art resolution); lower on weak devices */
  RS: number;
  private bytesBudget = 0;

  constructor(private world: World, private spr: ItemSprites, public assetRS: number) {
    const RS = assetRS;
    this.RS = RS;
    this.ground = buildGroundTextures(RS);
    this.grime = buildGrime(RS);
    this.bloom = makeCanvas(32, 32);
    { const bc = ctx2d(this.bloom); const gr = bc.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(94,234,212,0.16)'); gr.addColorStop(1, 'rgba(94,234,212,0)'); bc.fillStyle = gr; bc.fillRect(0, 0, 32, 32); }
    this.debris = buildDebris(RS);
    const bytes = CPX * CPX * RS * RS * 4;
    // memory: phones and low-RAM machines keep a much smaller chunk cache
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const budget = (touch ? 56e6 : 110e6) * Math.min(1, mem / 4);
    this.bytesBudget = budget;
    this.maxCached = Math.max(36, Math.min(200, Math.floor(budget / bytes)));
  }

  has(cx: number, cy: number) { return this.cache.has(cy * CHUNKS + cx); }

  private patterns = new Map<number, CanvasPattern>();
  private groundPattern(c: CanvasRenderingContext2D, g: number): CanvasPattern {
    let p = this.patterns.get(g);
    if (!p) {
      p = c.createPattern(this.ground[g], 'repeat')!;
      // the textures are RS-times larger than world units
      p.setTransform(new DOMMatrix().scale(1 / this.assetRS));
      this.patterns.set(g, p);
    }
    return p;
  }

  private noiseCv: HTMLCanvasElement | null = null;
  private noiseImg: ImageData | null = null;
  /** 10x10 px tint map for a chunk (1 px per tile + 1 margin), smoothed when scaled up. */
  private macroNoise(cx: number, cy: number): HTMLCanvasElement {
    if (!this.noiseCv) { this.noiseCv = makeCanvas(CHUNK, CHUNK); this.noiseImg = ctx2d(this.noiseCv).createImageData(CHUNK, CHUNK); }
    const d = this.noiseImg!.data;
    for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
      const v = valueNoise((cx * CHUNK + x) / 5, (cy * CHUNK + y) / 5, 3) - 0.5;
      const k = (y * CHUNK + x) * 4;
      if (v > 0) { d[k] = 255; d[k + 1] = 220; d[k + 2] = 255; d[k + 3] = Math.round(v * 0.09 * 255); }
      else { d[k] = 16; d[k + 1] = 8; d[k + 2] = 40; d[k + 3] = Math.round(-v * 0.16 * 255); }
    }
    ctx2d(this.noiseCv).putImageData(this.noiseImg!, 0, 0);
    return this.noiseCv;
  }

  /** Grime + debris pre-combined per density step and variant: one draw per dirty tile. */
  private soil = new Map<number, HTMLCanvasElement>();
  private soilTile(dens: number, variant: number): HTMLCanvasElement {
    const step = Math.min(3, Math.floor(dens * 4));
    const key = step * 16 + variant;
    let cv = this.soil.get(key);
    if (!cv) {
      const d = (step + 0.5) / 4, RS = this.RS;
      cv = makeCanvas(Math.ceil(60 * RS), Math.ceil(60 * RS));
      const c = ctx2d(cv);
      c.globalAlpha = 0.22 + 0.4 * d;
      c.drawImage(this.grime, 0, 0, 60 * RS, 60 * RS);
      c.globalAlpha = 0.45 + 0.55 * d;
      c.drawImage(this.debris[variant], 8 * RS, 8 * RS, 44 * RS, 44 * RS);
      this.soil.set(key, cv);
    }
    return cv;
  }

  /** Changes the chunk canvas resolution; cached chunks are dropped and repainted progressively. */
  setOutputScale(rs: number) {
    rs = Math.min(this.assetRS, Math.max(1, rs));
    if (Math.abs(rs - this.RS) < 0.01) return;
    this.RS = rs;
    for (const key of this.cache.keys()) this.world.chunkDirty[key] = 1;
    this.cache.clear();
    this.pool.length = 0;
    this.soil.clear();
    this.maxCached = Math.max(36, Math.min(220, Math.floor(this.bytesBudget / (CPX * CPX * rs * rs * 4))));
  }

  /** lighter chunks on weak devices (set by the renderer) */
  lite = false;

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
    this.renderedAt.set(key, performance.now());
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
    // ground: one pattern fill per ground type (instead of one draw per tile)
    const groups = new Map<number, number[]>();
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const i = tileIndex(tx, ty);
      let g = w.ground[i];
      // natural soil all heals into the same lush ground once clean
      if ((g === G_DIRT || g === G_GRAVEL) && w.garbage[i] === 0) g = G_EARTH;
      let list = groups.get(g);
      if (!list) groups.set(g, (list = []));
      list.push(tx, ty);
    }
    for (const [g, list] of groups) {
      c.fillStyle = this.groundPattern(c, g);
      c.beginPath();
      for (let k = 0; k < list.length; k += 2) c.rect(list[k] * TILE, list[k + 1] * TILE, TILE, TILE);
      c.fill();
    }
    // macro light/dark variation as one smooth upscaled overlay
    c.drawImage(this.macroNoise(cx, cy), ox, oy, CPX, CPX);
    // road markings & ruins on the ground
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const i = tileIndex(tx, ty);
      const d = w.deco[i];
      // landing-strip guide lights
      if (d & DECO_ROAD_H && tx % 2 === 0) this.stripLight(c, tx * TILE + 16, (ty + 1) * TILE, tx);
      if (d & DECO_ROAD_V && ty % 2 === 0) this.stripLight(c, (tx + 1) * TILE, ty * TILE + 16, ty);
      if (w.ground[i] === G_ASPHALT && !(d & (DECO_ROAD_H | DECO_ROAD_V))) {
        // curb when next to non-asphalt
        const edge = (x: number, y: number) => inWorld(x, y) && w.ground[tileIndex(x, y)] !== G_ASPHALT;
        c.fillStyle = 'rgba(150,140,200,0.85)';
        if (edge(tx, ty - 1)) c.fillRect(tx * TILE, ty * TILE, TILE, 2.5);
        if (edge(tx, ty + 1)) c.fillRect(tx * TILE, (ty + 1) * TILE - 2.5, TILE, 2.5);
        c.fillStyle = 'rgba(103,232,249,0.35)';
        if (edge(tx, ty - 1)) c.fillRect(tx * TILE, ty * TILE + 2.5, TILE, 0.8);
        if (edge(tx, ty + 1)) c.fillRect(tx * TILE, (ty + 1) * TILE - 3.3, TILE, 0.8);
      }
    }
    // soft teal glow where junk used to be (margin tiles too, so chunk edges blend)
    c.globalAlpha = 0.5;
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (!inWorld(tx, ty)) continue;
      const i = tileIndex(tx, ty);
      if (w.garbage[i] === 0 && w.initial[i] > 0 && w.ground[i] !== G_ASPHALT) c.drawImage(this.bloom, (tx + 0.5) * TILE - 28, (ty + 0.5) * TILE - 28, 56, 56);
    }
    c.globalAlpha = 1;
    // clean ground details: grass, flowers, stones
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const i = tileIndex(tx, ty);
      if (w.garbage[i] > 0 || w.ground[i] === G_ASPHALT) continue;
      const h = hash2(tx, ty, 41);
      // cleaned land blooms: the more junk was here, the more it glows back to life
      const was = w.initial[i] > 0;
      if (h < (was ? 0.42 : 0.3)) this.grass(c, tx, ty, h);
      else if (h < (was ? 0.5 : 0.33)) this.mushrooms(c, tx, ty, h);
      else if (h > 0.94) this.pebble(c, tx, ty, h);
    }
    // grime and debris under garbage (including margin tiles so edges blend)
    const m = CHUNK_MARGIN;
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (!inWorld(tx, ty)) continue;
      const i = tileIndex(tx, ty);
      const g = w.garbage[i];
      if (!g) {
        // faint memory of the garbage that was here
        if (w.initial[i] > 0) { c.globalAlpha = 0.07; c.drawImage(this.grime, (tx + 0.5) * TILE - 24, (ty + 0.5) * TILE - 24, 48, 48); }
        continue;
      }
      c.globalAlpha = 1;
      c.drawImage(this.soilTile(Math.min(1, g / 40), Math.floor(hash2(tx, ty, 8) * this.debris.length)), (tx + 0.5) * TILE - 30, (ty + 0.5) * TILE - 30, 60, 60);
    }
    c.globalAlpha = 1;
    // ruin walls (low, 3/4)
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      if (!inWorld(tx, ty) || !(w.deco[tileIndex(tx, ty)] & DECO_RUINWALL)) continue;
      const x = tx * TILE, y = ty * TILE;
      const hh = 6 + hash2(tx, ty, 6) * 8;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 2, y + 20, TILE, 10);
      c.fillStyle = lin(c, 0, y + 18 - hh, 0, y + 26, [[0, '#4f8a86'], [1, '#2f5a5c']]);
      c.fillRect(x, y + 26 - hh, TILE, hh);
      c.fillStyle = '#86c2b8'; c.fillRect(x, y + 18 - hh, TILE, 8);
      if (hash2(tx, ty, 7) < 0.4) { c.fillStyle = 'rgba(160,255,240,0.55)'; c.fillRect(x + 12, y + 28 - hh, 1.2, hh - 4); c.fillRect(x + 9, y + 26 - hh * 0.5, 7, 1.2); }
      c.strokeStyle = 'rgba(20,40,50,0.6)'; c.lineWidth = 0.6;
      c.strokeRect(x, y + 18 - hh, TILE, 8 + hh);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 11 + 4, y + 26 - hh); c.lineTo(x + k * 11 + 4, y + 26); c.stroke(); }
    }
    // revealed props (only on clean tiles), drawn top to bottom
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 2; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (!inWorld(tx, ty) || w.garbage[tileIndex(tx, ty)] > 0) continue;
      const pr = propAt(w, tx, ty);
      if (pr) drawProp(c, pr.kind, pr.v, tx, ty);
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
      if (this.lite && k > 4) {
        // lite: skip the buried middle layers (mostly hidden anyway), keep the mound and the visible top
        const skip = Math.floor(k * 0.25);
        if (w.initial[i] >= 34) genTileItems(w.region[i], tx, ty, w.initial[i], items, 0, 1);
        genTileItems(w.region[i], tx, ty, w.initial[i], items, Math.max(1, skip), k);
      } else genTileItems(w.region[i], tx, ty, w.initial[i], items, 0, k);
    }
    items.sort((a, b) => a.layer - b.layer || a.y - b.y || a.order - b.order);
    c.save();
    c.beginPath(); c.rect(ox, oy, CPX, CPX); c.clip();
    const sprites = this.spr.sprites, pages = this.spr.atlas.pages;
    // depth: lower layers sink into a soft shade so the top of each pile reads clearly
    let shadeLayer = -9;
    const sinkShade = (alpha: number) => {
      c.globalAlpha = alpha;
      for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
        if (!inWorld(tx, ty)) continue;
        const g = w.garbage[tileIndex(tx, ty)];
        if (g > 4) c.drawImage(this.grime, (tx + 0.5) * TILE - 26, (ty + 0.5) * TILE - 26, 52, 52);
      }
      c.globalAlpha = 1;
    };
    for (const it of items) {
      if (!this.lite && it.layer > 0 && shadeLayer < it.layer) {
        sinkShade(it.layer === 1 ? 0.28 : 0.16);
        shadeLayer = it.layer;
      }
      const s = sprites[it.spr];
      if (it.x + s.w < ox || it.x - s.w > ox + CPX || it.y + s.h < oy || it.y - s.h > oy + CPX) continue;
      const k = it.scale;
      c.drawImage(pages[s.page], s.sx, s.sy, s.sw, s.sh, it.x - s.ax * k, it.y - s.ay * k, s.w * k, s.h * k);
    }
    // what the junk is made of: a few material pieces poke out of the piles
    for (let ty = ty0 - 1; ty < ty0 + CHUNK + 1; ty++) for (let tx = tx0 - 1; tx < tx0 + CHUNK + 1; tx++) {
      if (!inWorld(tx, ty)) continue;
      const i = tileIndex(tx, ty);
      const g = w.garbage[i];
      if (g < 6 || g < w.initial[i] * 0.3) continue;
      const h = hash2(tx, ty, 77);
      if (h > 0.16) continue;
      const reg = REGIONS[w.region[i]];
      let mat: number;
      if (hash2(tx, ty, 78) < 0.025 * reg.rareMult) mat = 5;
      else {
        const mw = reg.mats, tot = mw[0] + mw[1] + mw[2] + mw[3] + mw[4];
        let v = hash2(tx, ty, 79) * tot;
        mat = 0;
        for (; mat < 4; mat++) { v -= mw[mat]; if (v <= 0) break; }
      }
      const x = (tx + 0.2 + hash2(tx, ty, 80) * 0.6) * TILE, y = (ty + 0.15 + hash2(tx, ty, 81) * 0.5) * TILE;
      const size = 17 + (h / 0.16) * 5;
      c.fillStyle = 'rgba(20,12,30,0.35)';
      c.beginPath(); c.ellipse(x, y + size * 0.42, size * 0.42, size * 0.16, 0, 0, Math.PI * 2); c.fill();
      // a soft glow in the material's color so it pops out of the pile
      c.globalAlpha = 0.22; c.fillStyle = MATERIALS[mat].color;
      c.beginPath(); c.arc(x, y, size * 0.62, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      drawMatIcon(c, mat, x, y, size);
    }
    c.restore();
  }

  private stripLight(c: CanvasRenderingContext2D, x: number, y: number, k: number) {
    const on = k % 4 === 0;
    c.fillStyle = on ? 'rgba(103,232,249,0.22)' : 'rgba(244,114,182,0.16)';
    ellipse(c, x, y, 6, 4); c.fill();
    c.fillStyle = '#1e1b3a'; ellipse(c, x, y, 2.6, 1.8); c.fill();
    c.fillStyle = on ? '#a5f3fc' : '#f9a8d4'; ellipse(c, x, y - 0.3, 1.5, 1); c.fill();
  }

  /** Bioluminescent alien grass tufts. */
  private grass(c: CanvasRenderingContext2D, tx: number, ty: number, h: number) {
    const n = 2 + Math.floor(h * 10);
    for (let k = 0; k < n; k++) {
      const x = tx * TILE + hash2(tx * 7 + k, ty, 1) * 28 + 2, y = ty * TILE + hash2(tx, ty * 7 + k, 2) * 26 + 4;
      const v = hash2(tx + k, ty, 4);
      const blade = v < 0.6 ? `rgb(${40 + v * 60},${170 + v * 60},${170 + v * 50})` : `rgb(${150 + v * 60},${110 + v * 40},${210 + v * 30})`;
      c.strokeStyle = 'rgba(30,20,60,0.45)'; c.lineWidth = 1.5;
      c.beginPath();
      for (let b = -1; b <= 1; b++) { c.moveTo(x + b, y + 0.5); c.quadraticCurveTo(x + b * 1.5, y - 3, x + b * 2.6, y - 4.5 - Math.abs(b)); }
      c.stroke();
      c.strokeStyle = blade; c.lineWidth = 0.9;
      c.stroke();
      // glowing tip
      c.fillStyle = v < 0.6 ? 'rgba(190,255,250,0.9)' : 'rgba(255,220,255,0.9)';
      c.fillRect(x - 0.4, y - 5.2, 0.9, 0.9);
    }
    if (h < 0.04) {
      // alien flower
      const col = ['#f472b6', '#fde047', '#67e8f9'][Math.floor(h * 1000) % 3];
      const fx = tx * TILE + 14, fy = ty * TILE + 12;
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(fx, fy, 4.5, 0, 6.28); c.fill();
      c.fillStyle = col;
      for (let p = 0; p < 5; p++) { const a = (p / 5) * 6.28; ellipse(c, fx + Math.cos(a) * 1.7, fy + Math.sin(a) * 1.4, 1.3, 0.9, a); c.fill(); }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(fx, fy, 0.8, 0, 6.28); c.fill();
    }
  }

  /** Glowing mushroom cluster. */
  private mushrooms(c: CanvasRenderingContext2D, tx: number, ty: number, h: number) {
    const cols = ['#67e8f9', '#f0abfc', '#a3e635', '#fdba74'];
    const col = cols[Math.floor(h * 977) % cols.length];
    const bx = tx * TILE + 8 + hash2(tx, ty, 71) * 16, by = ty * TILE + 12 + hash2(tx, ty, 72) * 12;
    c.fillStyle = 'rgba(255,255,255,0.08)'; ellipse(c, bx, by - 2, 8, 5); c.fill();
    const n = 2 + Math.floor(hash2(tx, ty, 73) * 3);
    for (let k = 0; k < n; k++) {
      const x = bx + (k - n / 2) * 3.2 + hash2(tx + k, ty, 74) * 1.5, y = by + (k % 2) * 1.5;
      const s = 1.4 + hash2(tx, ty + k, 75) * 1.6;
      c.fillStyle = 'rgba(20,10,40,0.35)'; ellipse(c, x + 0.6, y + 0.5, s * 1.2, s * 0.5); c.fill();
      c.fillStyle = '#e9e3f5'; c.fillRect(x - 0.45, y - s * 1.6, 0.9, s * 1.6);
      c.fillStyle = col; ellipse(c, x, y - s * 1.6, s * 1.3, s * 0.8); c.fill();
      c.strokeStyle = 'rgba(42,26,16,0.7)'; c.lineWidth = 0.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(x - s * 0.4, y - s * 1.8, s * 0.25, 0, 6.28); c.fill();
    }
  }

  /** Small crystal pebble. */
  private pebble(c: CanvasRenderingContext2D, tx: number, ty: number, h: number) {
    const col = ['#f9a8d4', '#a5f3fc', '#c4b5fd'][Math.floor(h * 3001) % 3];
    const x = tx * TILE + 16, y = ty * TILE + 17;
    c.fillStyle = 'rgba(20,10,40,0.3)'; ellipse(c, x + 0.6, y + 1.2, 3.6, 1.6); c.fill();
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x - 2.4, y + 1); c.lineTo(x - 1.4, y - 3); c.lineTo(x + 0.4, y - 4.6); c.lineTo(x + 2.2, y - 2.2); c.lineTo(x + 2.4, y + 1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(42,26,16,0.75)'; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x - 1.2, y - 2.6, 0.8, 2.4);
  }
}
