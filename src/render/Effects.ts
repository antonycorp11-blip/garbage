import { TILE, WORLD_TILES } from '../core/constants';
import { MATERIALS } from '../data/materials';
import { FX, SoundName } from '../game/fx';
import { World } from '../world/World';
import { ctx2d, lin, makeCanvas, rad, rrect, shade } from './paint';
import { ItemSprites } from './sprites';
import { TileItem, genTileItems, visibleK } from './tileItems';

const PAL = ['#b8a6da', '#6f5a99', '#ffd27a', '#ffffff', '#f0abfc', '#7dd3fc', '#ffe082', '#a3a3a3', '#86efac', '#fb923c', '#facc15', '#e879f9'];
const P_DUST = 0, P_SPARK = 1, P_MAGIC = 2, P_COIN = 3, P_BIT = 4, P_SMOKE = 5, P_SUCK = 6;

interface Flyer { spr: number; mat: number; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; arc: number; rot: number; spin: number; active: boolean }
interface FText { x: number; y: number; str: string; color: string; t: number }
interface Drone { x0: number; y0: number; x1: number; y1: number; t: number }

export interface SoundSink { play(name: SoundName, vol?: number, pan?: number): void }

export class Effects implements FX {
  readonly N = 1400;
  px = new Float32Array(this.N); py = new Float32Array(this.N); pvx = new Float32Array(this.N); pvy = new Float32Array(this.N);
  plife = new Float32Array(this.N); pmax = new Float32Array(this.N); psize = new Float32Array(this.N);
  pcol = new Uint8Array(this.N); ptype = new Uint8Array(this.N); ptx = new Float32Array(this.N); pty = new Float32Array(this.N);
  private pnext = 0;
  flyers: Flyer[] = [];
  texts: FText[] = [];
  drones: Drone[] = [];
  shakeAmt = 0;
  quality = 1;
  private dots: HTMLCanvasElement[];
  private star: HTMLCanvasElement;
  private bales: HTMLCanvasElement[];
  private tmp: TileItem[] = [];
  listener = { x: 0, y: 0, zoom: 1 };

  constructor(private world: World, private spr: ItemSprites, private sink: SoundSink) {
    this.dots = PAL.map((col) => {
      const cv = makeCanvas(32, 32); const c = ctx2d(cv);
      c.fillStyle = rad(c, 16, 16, 0, 16, [[0, col], [0.4, shade(col, 0, 0.8)], [1, shade(col, 0, 0)]]);
      c.fillRect(0, 0, 32, 32);
      return cv;
    });
    this.star = makeCanvas(32, 32);
    {
      const c = ctx2d(this.star);
      c.translate(16, 16);
      c.fillStyle = rad(c, 0, 0, 0, 16, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,220,255,0.6)'], [1, 'rgba(255,200,255,0)']]);
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28, r = i % 2 ? 4 : 16; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.fill();
    }
    this.bales = MATERIALS.map((m) => {
      const S = 18 * 2; const cv = makeCanvas(S, S); const c = ctx2d(cv);
      c.scale(2, 2); c.translate(9, 9);
      c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 3; c.shadowOffsetY = 2;
      rrect(c, -5.5, -4.5, 11, 9, 2.2); c.fillStyle = m.color; c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = lin(c, 0, -4.5, 0, 4.5, [[0, shade(m.color, 0.35)], [1, shade(m.color, -0.35)]]); c.fill();
      c.strokeStyle = shade(m.color, -0.6); c.lineWidth = 0.7; c.stroke();
      c.fillStyle = 'rgba(60,40,20,0.75)'; c.fillRect(-1.6, -4.5, 1.2, 9); c.fillRect(-5.5, -0.5, 11, 1.1);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-4.5, -3.6, 6, 1);
      return cv;
    });
  }

  // ----- FX interface
  removed(tile: number, before: number, after: number, toX: number, toY: number) {
    const w = this.world;
    const init = w.initial[tile];
    const kb = visibleK(before, init), ka = visibleK(after, init);
    const tx = tile % WORLD_TILES, ty = (tile / WORLD_TILES) | 0;
    this.tmp.length = 0;
    if (kb > ka) genTileItems(w.region[tile], tx, ty, init, this.tmp, ka, kb);
    const n = Math.min(this.tmp.length, this.quality > 0.5 ? 4 : 2);
    for (let i = 0; i < n; i++) {
      const it = this.tmp[this.tmp.length - 1 - i];
      this.addFlyer(it.spr, -1, it.x, it.y, toX, toY, 0.32 + Math.random() * 0.18);
    }
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    if (!n) for (let i = 0; i < Math.min(3, before - after); i++) this.spawn(P_BIT, cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20, (toX - cx) * 2.5, (toY - cy) * 2.5 - 40, 0.35, 2.4, Math.floor(Math.random() * PAL.length));
    this.burst(cx, cy, 'dust', after === 0 ? 6 : 2);
  }

  fly(fromX: number, fromY: number, toX: number, toY: number, mat: number) {
    this.addFlyer(-1, mat, fromX, fromY, toX, toY, 0.45 + Math.random() * 0.2);
  }

  text(x: number, y: number, str: string, color: string) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, str, color, t: 0 });
  }

  burst(x: number, y: number, kind: 'dust' | 'spark' | 'build' | 'unlock' | 'coin' | 'magic', n: number) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = Math.random();
      switch (kind) {
        case 'dust': this.spawn(P_DUST, x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 12, Math.cos(a) * 25 * s, Math.sin(a) * 15 * s - 12, 0.5 + Math.random() * 0.5, 4 + Math.random() * 6, Math.random() < 0.6 ? 0 : 1); break;
        case 'spark': this.spawn(P_SPARK, x, y, Math.cos(a) * 140 * s, Math.sin(a) * 140 * s - 40, 0.3 + Math.random() * 0.3, 2 + Math.random() * 2, 2); break;
        case 'build': if (i % 2) this.spawn(P_DUST, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, Math.cos(a) * 40, Math.sin(a) * 25 - 10, 0.7, 7 + Math.random() * 6, 0); else this.spawn(P_SPARK, x, y, Math.cos(a) * 110 * s, Math.sin(a) * 110 * s - 50, 0.5, 2.5, 6); break;
        case 'unlock': this.spawn(P_MAGIC, x + (Math.random() - 0.5) * 10, y, Math.cos(a) * 80 * s, Math.sin(a) * 80 * s - 60, 0.8 + Math.random() * 0.5, 5 + Math.random() * 5, 5 + (i % 2) * 5); break;
        case 'magic': this.spawn(P_MAGIC, x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14, Math.cos(a) * 60 * s, Math.sin(a) * 60 * s - 30, 0.9 + Math.random() * 0.6, 5 + Math.random() * 6, 4 + (i % 3 === 0 ? 7 : 0)); break;
        case 'coin': this.spawn(P_COIN, x, y, Math.cos(a) * 90 * s, -80 - Math.random() * 120, 1.1, 4, 6); break;
      }
    }
  }

  sound(name: SoundName, x?: number, y?: number) {
    let vol = 1, pan = 0;
    if (x !== undefined && y !== undefined) {
      const dx = x - this.listener.x, dy = y - this.listener.y;
      const d = Math.hypot(dx, dy) / TILE;
      vol = Math.max(0, 1 - d / 22);
      pan = Math.max(-1, Math.min(1, dx / (TILE * 12)));
      if (vol <= 0.02) return;
    }
    this.sink.play(name, vol, pan);
  }

  shake(amount: number) { this.shakeAmt = Math.min(10, this.shakeAmt + amount); }

  drone(fromX: number, fromY: number, toX: number, toY: number) { this.drones.push({ x0: fromX, y0: fromY, x1: toX, y1: toY, t: 0 }); }

  // ----- particles
  spawn(type: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    const i = this.pnext;
    this.pnext = (this.pnext + 1) % this.N;
    this.px[i] = x; this.py[i] = y; this.pvx[i] = vx; this.pvy[i] = vy; this.plife[i] = life; this.pmax[i] = life; this.psize[i] = size; this.pcol[i] = col; this.ptype[i] = type;
  }

  /** a particle sucked from (x,y) to (tx,ty) */
  suck(x: number, y: number, tx: number, ty: number, col: number, life = 0.45) {
    const i = this.pnext;
    this.spawn(P_SUCK, x, y, 0, 0, life, 2 + Math.random() * 2.5, col);
    this.ptx[i] = tx; this.pty[i] = ty;
  }

  smoke(x: number, y: number) {
    this.spawn(P_SMOKE, x, y, (Math.random() - 0.5) * 8, -18 - Math.random() * 10, 1.6, 5 + Math.random() * 4, 7);
  }

  private addFlyer(spr: number, mat: number, x0: number, y0: number, x1: number, y1: number, dur: number) {
    let f = this.flyers.find((q) => !q.active);
    if (!f) {
      if (this.flyers.length >= 280) return;
      f = { spr, mat, x0, y0, x1, y1, t: 0, dur, arc: 0, rot: 0, spin: 0, active: true };
      this.flyers.push(f);
    }
    f.spr = spr; f.mat = mat; f.x0 = x0; f.y0 = y0; f.x1 = x1; f.y1 = y1; f.t = 0; f.dur = dur; f.active = true;
    f.arc = 14 + Math.random() * 18 + Math.hypot(x1 - x0, y1 - y0) * 0.25;
    f.rot = (Math.random() - 0.5) * 1; f.spin = (Math.random() - 0.5) * 14;
  }

  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      if (this.plife[i] <= 0) continue;
      this.plife[i] -= dt;
      const t = this.ptype[i];
      if (t === P_SUCK) {
        const k = 1 - this.plife[i] / this.pmax[i];
        const e = k * k;
        this.px[i] += (this.ptx[i] - this.px[i]) * Math.min(1, e * 0.5 + dt * 6);
        this.py[i] += (this.pty[i] - this.py[i]) * Math.min(1, e * 0.5 + dt * 6);
        continue;
      }
      this.px[i] += this.pvx[i] * dt; this.py[i] += this.pvy[i] * dt;
      if (t === P_COIN || t === P_BIT) this.pvy[i] += 380 * dt;
      else if (t === P_SPARK) { this.pvy[i] += 160 * dt; this.pvx[i] *= 0.97; }
      else { this.pvx[i] *= 1 - dt * 2.5; this.pvy[i] *= 1 - dt * 2.5; }
    }
    for (const f of this.flyers) if (f.active) { f.t += dt / f.dur; f.rot += f.spin * dt; if (f.t >= 1) f.active = false; }
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 1.4);
    for (const d of this.drones) d.t += dt / 1.8;
    this.drones = this.drones.filter((d) => d.t < 1);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 14);
  }

  drawParticles(c: CanvasRenderingContext2D, view: { x0: number; y0: number; x1: number; y1: number }) {
    c.save();
    for (let pass = 0; pass < 2; pass++) {
      c.globalCompositeOperation = pass === 0 ? 'source-over' : 'lighter';
      for (let i = 0; i < this.N; i++) {
        if (this.plife[i] <= 0) continue;
        const t = this.ptype[i];
        const additive = t === P_SPARK || t === P_MAGIC || t === P_SUCK;
        if ((pass === 1) !== additive) continue;
        const x = this.px[i], y = this.py[i];
        if (x < view.x0 - 20 || x > view.x1 + 20 || y < view.y0 - 20 || y > view.y1 + 20) continue;
        const k = this.plife[i] / this.pmax[i];
        let s = this.psize[i];
        if (t === P_DUST || t === P_SMOKE) { s *= 1 + (1 - k) * 1.4; c.globalAlpha = k * (t === P_SMOKE ? 0.35 : 0.5); }
        else c.globalAlpha = Math.min(1, k * 1.6);
        if (t === P_MAGIC) {
          c.drawImage(this.star, x - s, y - s, s * 2, s * 2);
        } else if (t === P_COIN) {
          const w = Math.abs(Math.sin(this.plife[i] * 14)) * 3.5 + 0.6;
          c.fillStyle = '#c99a1c'; c.beginPath(); c.ellipse(x, y, w, 3.5, 0, 0, 6.28); c.fill();
          c.fillStyle = '#ffe27a'; c.beginPath(); c.ellipse(x - 0.3, y - 0.3, Math.max(0.2, w - 0.9), 2.6, 0, 0, 6.28); c.fill();
        } else if (t === P_BIT) {
          c.fillStyle = PAL[this.pcol[i]]; c.fillRect(x - s / 2, y - s / 2, s, s * 0.7);
        } else {
          c.drawImage(this.dots[this.pcol[i]], x - s, y - s, s * 2, s * 2);
        }
      }
    }
    c.restore();
  }

  drawFlyers(c: CanvasRenderingContext2D) {
    const sprites = this.spr.sprites, pages = this.spr.atlas.pages;
    for (const f of this.flyers) {
      if (!f.active) continue;
      const t = f.t;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = f.x0 + (f.x1 - f.x0) * e;
      const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(t * Math.PI) * f.arc;
      const sc = 1 - t * 0.65;
      c.save();
      c.translate(x, y);
      c.rotate(f.rot);
      c.scale(sc, sc);
      c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      if (f.spr >= 0) {
        const s = sprites[f.spr];
        c.drawImage(pages[s.page], s.sx, s.sy, s.sw, s.sh, -s.ax, -s.ay, s.w, s.h);
      } else {
        c.drawImage(this.bales[f.mat], -9, -9, 18, 18);
      }
      c.restore();
    }
  }

  drawTexts(c: CanvasRenderingContext2D) {
    c.save();
    c.textAlign = 'center';
    c.font = '800 11px "Trebuchet MS", system-ui, sans-serif';
    c.lineJoin = 'round';
    for (const t of this.texts) {
      const k = t.t / 1.4;
      const y = t.y - 26 * (1 - Math.pow(1 - k, 2));
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const s = k < 0.12 ? 0.6 + k * 4 : 1;
      c.save(); c.translate(t.x, y); c.scale(s, s);
      c.strokeStyle = 'rgba(20,12,4,0.85)'; c.lineWidth = 3; c.strokeText(t.str, 0, 0);
      c.fillStyle = t.color; c.fillText(t.str, 0, 0);
      c.restore();
    }
    c.restore();
  }

  drawDrones(c: CanvasRenderingContext2D, time: number) {
    for (const d of this.drones) {
      const t = d.t;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = d.x0 + (d.x1 - d.x0) * e, y = d.y0 + (d.y1 - d.y0) * e - 30 * Math.sin(t * Math.PI) - 16;
      c.save();
      c.globalAlpha = t > 0.9 ? (1 - t) * 10 : Math.min(1, t * 8);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y + 26 + 30 * Math.sin(t * Math.PI), 9, 3.5, 0, 0, 6.28); c.fill();
      c.translate(x, y);
      c.strokeStyle = '#37474f'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-9, -6); c.lineTo(9, 6); c.moveTo(9, -6); c.lineTo(-9, 6); c.stroke();
      for (const [px, py] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) {
        c.fillStyle = 'rgba(200,220,230,0.35)'; c.beginPath(); c.ellipse(px, py, 6, 2 + Math.abs(Math.sin(time * 40 + px)) * 1.5, 0, 0, 6.28); c.fill();
      }
      rrect(c, -5, -4, 10, 7, 2); c.fillStyle = lin(c, 0, -4, 0, 3, [[0, '#ffb74d'], [1, '#e65100']]); c.fill();
      c.fillStyle = '#e53935'; c.beginPath(); c.arc(0, -1, 1.1, 0, 6.28); c.fill();
      c.drawImage(this.bales[1], -7, 3, 14, 14);
      c.restore();
    }
  }
}
