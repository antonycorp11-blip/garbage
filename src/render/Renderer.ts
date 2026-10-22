import { CHUNK, CHUNKS, DX, DY, TILE, WORLD_PX, WORLD_TILES, tileIndex, inWorld } from '../core/constants';
import { clamp } from '../core/rng';
import { MACHINES, MachineType } from '../data/machines';
import { Game } from '../game/Game';
import { Machine, centerX, centerY, hubRadius, isBelt, isHub, machineRadius } from '../game/Machines';
import { ChunkRenderer } from './ChunkRenderer';
import { Effects } from './Effects';
import { drawAimTile, drawAreaTool, drawPlayer } from './character';
import { drawBelt, drawBots, drawMachine, drawRange } from './machinesDraw';
import { drawSpecialAt } from './specialsDraw';
import { Life } from './life';

export interface BuildPreview { type: MachineType; tx: number; ty: number; dir: number; problem: string | null }

const CPX = CHUNK * TILE;

export class Renderer {
  canvas: HTMLCanvasElement;
  c: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  cam = { x: 0, y: 0, zoom: 1, targetZoom: 1 };
  private ghost: Machine | null = null;
  showRanges = false;
  selected: Machine | null = null;
  endingT = -1;
  /** when set, the camera follows this point instead of the player */
  focus: { x: number; y: number } | null = null;
  life: Life;

  constructor(canvas: HTMLCanvasElement, private game: Game, public chunks: ChunkRenderer, public fx: Effects) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    this.cam.x = game.player.x; this.cam.y = game.player.y;
    this.life = new Life(game, fx);
  }

  /** 0 = best looking … 3 = lightest (set by the adaptive quality governor) */
  tier = 0;
  /** screen-space tint/vignette live in a CSS layer (composited by the GPU, free for the canvas) */
  private overlay: HTMLElement | null = null;

  setTier(t: number) {
    if (t === this.tier) return;
    this.tier = t;
    this.chunks.lite = t >= 2;
    this.resize();

  }

  resize() {
    // big desktop screens: a Retina-sized canvas is ~4.7M pixels per frame; 1.5 looks the same at arm's length
    const desk = !document.body.classList.contains('touch') && window.innerWidth * window.innerHeight > 900000;
    const caps = desk ? [1.5, 1.25, 1, 1] : [2, 1.5, 1.25, 1];
    this.dpr = Math.min(window.devicePixelRatio || 1, caps[this.tier] ?? 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    // chunk canvases close to the real on-screen size: less memory and much cheaper to draw
    this.chunks?.setOutputScale(Math.ceil(this.dpr * 1.15 * 4) / 4);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  get minZoom() { return Math.max(0.45, Math.min(this.W, this.H) / 1100); }

  /** Clamp a camera center the same way the renderer does. */
  clampView(x: number, y: number) {
    const hw = this.W / 2 / this.cam.zoom, hh = this.H / 2 / this.cam.zoom;
    return { x: clamp(x, Math.min(hw, WORLD_PX / 2), Math.max(WORLD_PX - hw, WORLD_PX / 2)), y: clamp(y, Math.min(hh, WORLD_PX / 2), Math.max(WORLD_PX - hh, WORLD_PX / 2)) };
  }

  worldToScreen(x: number, y: number) {
    return { x: (x - this.cam.x) * this.cam.zoom + this.W / 2, y: (y - this.cam.y) * this.cam.zoom + this.H / 2 };
  }

  /** Cargo pod and meteor shower markers in the world. */
  private drawWorldEvent(c: CanvasRenderingContext2D, time: number) {
    const ev = this.game.worldEvent;
    if (!ev) return;
    const INK = '#2a1a10';
    if (ev.kind === 'cargo') {
      const x = ev.x, y = ev.y, bob = Math.sin(time * 3) * 2;
      // beacon light column
      const g = c.createLinearGradient(x, y - 120, x, y);
      g.addColorStop(0, 'rgba(250,204,21,0)'); g.addColorStop(1, 'rgba(250,204,21,0.35)');
      c.fillStyle = g; c.fillRect(x - 6, y - 120, 12, 120);
      c.fillStyle = 'rgba(20,12,30,0.35)'; c.beginPath(); c.ellipse(x, y + 10, 16, 5, 0, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(x, y - 6 + bob);
      c.lineWidth = 2.2; c.strokeStyle = INK; c.lineJoin = 'round';
      // capsule body
      c.fillStyle = '#fff3dc'; c.beginPath(); c.roundRect(-13, -14, 26, 24, 7); c.fill(); c.stroke();
      c.fillStyle = '#fb923c'; c.fillRect(-13, -4, 26, 6); c.strokeRect(-13, -4, 26, 6);
      c.fillStyle = '#2dd4bf'; c.beginPath(); c.arc(0, -9, 3.2, 0, Math.PI * 2); c.fill(); c.stroke();
      // fins
      c.fillStyle = '#94a3b8';
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 13, 4); c.lineTo(sd * 19, 12); c.lineTo(sd * 12, 10); c.closePath(); c.fill(); c.stroke(); }
      // blinking light
      if (Math.sin(time * 8) > 0) { c.fillStyle = '#fde047'; c.beginPath(); c.arc(0, -18, 2.6, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
    } else if (ev.kind === 'meteor') {
      // streaks falling into the sector
      for (let i = 0; i < 6; i++) {
        const t = (time * 0.7 + i * 0.37) % 1;
        const ox = ev.x + Math.sin(i * 12.9) * 7 * TILE, oy = ev.y + Math.cos(i * 7.3) * 7 * TILE;
        const px = ox - 160 * (1 - t), py = oy - 220 * (1 - t);
        if (!this.game.isVisible(px, py)) continue;
        const gr = c.createLinearGradient(px - 40, py - 55, px, py);
        gr.addColorStop(0, 'rgba(253,186,116,0)'); gr.addColorStop(1, 'rgba(253,224,71,0.9)');
        c.strokeStyle = gr; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(px - 40, py - 55); c.lineTo(px, py); c.stroke();
        c.fillStyle = '#fff7ed'; c.beginPath(); c.arc(px, py, 3.2, 0, Math.PI * 2); c.fill();
      }
    }
  }

  private overlayKey = '';
  private updateOverlay(night: number, dusk: number) {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(14,6,34,0.5) 100%), linear-gradient(rgba(255,180,230,0.06), rgba(40,200,220,0.05))';
      const tint = document.createElement('div');
      tint.style.cssText = 'position:absolute;inset:0';
      this.overlay.appendChild(tint);
      this.canvas.after(this.overlay);
    }
    const a = (0.22 * night * night).toFixed(2), d = (0.07 * dusk).toFixed(2);
    const key = a + d;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    (this.overlay.firstChild as HTMLElement).style.background = `linear-gradient(rgba(255,120,160,${d}), rgba(255,120,160,${d})), rgba(28,18,78,${a})`;
  }

  private ground: HTMLCanvasElement | null = null;
  private gstate = { valid: false, z: 0, ox: 0, oy: 0 };
  /** how many times the ground layer was recomposed (diagnostics) */
  groundDraws = 0;
  private groundLayer(): HTMLCanvasElement {
    if (!this.ground || this.ground.width !== this.canvas.width || this.ground.height !== this.canvas.height) {
      this.ground = document.createElement('canvas');
      this.ground.width = this.canvas.width; this.ground.height = this.canvas.height;
      this.gstate.valid = false;
    }
    return this.ground;
  }

  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.W / 2) / this.cam.zoom + this.cam.x, y: (sy - this.H / 2) / this.cam.zoom + this.cam.y };
  }

  /** section timings (ms, smoothed) for the diagnostic overlay and profiling */
  perf: Record<string, number> = {};
  private pt(k: string, t0: number) { const v = performance.now() - t0; this.perf[k] = (this.perf[k] ?? v) * 0.9 + v * 0.1; return performance.now(); }

  draw(time: number, dt: number, build: BuildPreview | null) {
    const g = this.game, c = this.c, cam = this.cam;
    let T = performance.now();
    // camera
    if (this.endingT >= 0) {
      this.endingT += dt;
      cam.targetZoom = Math.max(this.minZoom, 1 - this.endingT * 0.08);
    }
    cam.zoom += (cam.targetZoom - cam.zoom) * Math.min(1, dt * 8);
    const p = g.player;
    const lead = 18;
    const fxp = this.focus ? this.focus.x : p.x + p.vx * lead;
    const fyp = this.focus ? this.focus.y : p.y - 10 + p.vy * lead;
    cam.x += (fxp - cam.x) * Math.min(1, dt * (this.focus ? 7 : 5));
    cam.y += (fyp - cam.y) * Math.min(1, dt * (this.focus ? 7 : 5));
    const hw = this.W / 2 / cam.zoom, hh = this.H / 2 / cam.zoom;
    cam.x = clamp(cam.x, Math.min(hw, WORLD_PX / 2), Math.max(WORLD_PX - hw, WORLD_PX / 2));
    cam.y = clamp(cam.y, Math.min(hh, WORLD_PX / 2), Math.max(WORLD_PX - hh, WORLD_PX / 2));
    const shake = this.fx.shakeAmt;
    const sx = shake > 0.05 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.05 ? (Math.random() - 0.5) * shake : 0;
    const camX = cam.x + sx, camY = cam.y + sy;
    const view = { x0: camX - hw, y0: camY - hh, x1: camX + hw, y1: camY + hh };
    g.view = view;
    this.fx.listener.x = p.x; this.fx.listener.y = p.y;
    this.life.update(dt, time);

    c.setTransform(1, 0, 0, 1, 0, 0);

    // ---- chunks
    const z = cam.zoom * this.dpr;
    // whole device pixels: the ground layer below can then be reused while the view holds still
    const ox = Math.round(this.canvas.width / 2 - camX * z), oy = Math.round(this.canvas.height / 2 - camY * z);
    const cx0 = Math.max(0, Math.floor(view.x0 / CPX)), cx1 = Math.min(CHUNKS - 1, Math.floor(view.x1 / CPX));
    const cy0 = Math.max(0, Math.floor(view.y0 / CPX)), cy1 = Math.min(CHUNKS - 1, Math.floor(view.y1 / CPX));
    const todo: [number, number, number][] = [];
    const w = g.world;
    let missing = 0;
    const nowMs = performance.now();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * CHUNKS + cx;
      const has = this.chunks.has(cx, cy);
      if (!has) missing++;
      // a dirty chunk is repainted at most a few times per second (machines dirty them constantly)
      if (!has || (w.chunkDirty[key] && nowMs - this.chunks.lastRender(key) > (this.tier >= 2 ? 650 : 350))) {
        const d = ((cx + 0.5) * CPX - p.x) ** 2 + ((cy + 0.5) * CPX - p.y) ** 2;
        todo.push([cx, cy, has ? d : d - 1e12]);
      }
    }
    todo.sort((a, b) => a[2] - b[2]);
    const allow = new Set<number>();
    // missing chunks first (they would show holes), then at most 1-2 refreshes per frame
    const budget = missing > 0 ? Math.min(missing + 1, this.tier >= 2 ? 4 : 8) : this.tier >= 2 ? 1 : 2;
    for (let i = 0; i < Math.min(budget, todo.length); i++) allow.add(todo[i][1] * CHUNKS + todo[i][0]);
    // paint the chunks that need it (the only expensive ground work)
    const paintedKeys: number[] = [];
    for (const key of allow) { const cx = key % CHUNKS, cy = (key / CHUNKS) | 0; const had = this.chunks.lastRender(key); if (this.chunks.get(cx, cy, true) && this.chunks.lastRender(key) !== had) paintedKeys.push(key); }
    // The ground lives in a screen-sized layer. Standing still it is reused untouched; walking it is
    // shifted and only the strip entering the screen is drawn; a repainted chunk is copied in alone.
    const bg = this.groundLayer();
    const b = bg.getContext('2d', { alpha: false })!;
    b.imageSmoothingEnabled = true;
    b.imageSmoothingQuality = this.tier >= 1 ? 'low' : 'medium';
    const rectOf = (cx: number, cy: number) => {
      const dx0 = Math.round(ox + cx * CPX * z), dy0 = Math.round(oy + cy * CPX * z);
      return [dx0, dy0, Math.round(ox + (cx + 1) * CPX * z) - dx0, Math.round(oy + (cy + 1) * CPX * z) - dy0];
    };
    const drawChunksIn = (x0: number, y0: number, x1: number, y1: number) => {
      // screen rect -> chunk range
      const wx0 = (x0 - ox) / z, wy0 = (y0 - oy) / z, wx1 = (x1 - ox) / z, wy1 = (y1 - oy) / z;
      const a0 = Math.max(0, Math.floor(wx0 / CPX)), a1 = Math.min(CHUNKS - 1, Math.floor(wx1 / CPX));
      const b0 = Math.max(0, Math.floor(wy0 / CPX)), b1 = Math.min(CHUNKS - 1, Math.floor(wy1 / CPX));
      for (let cy = b0; cy <= b1; cy++) for (let cx = a0; cx <= a1; cx++) {
        const cv = this.chunks.get(cx, cy, false);
        if (!cv) continue;
        const [rx, ry, rw, rh] = rectOf(cx, cy);
        b.drawImage(cv, rx, ry, rw, rh);
      }
    };
    const W = bg.width, H = bg.height;
    const gs = this.gstate;
    const dxs = ox - gs.ox, dys = oy - gs.oy;
    if (!gs.valid || gs.z !== z || Math.abs(dxs) >= W / 2 || Math.abs(dys) >= H / 2) {
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.fillStyle = '#1d1430'; b.fillRect(0, 0, W, H);
      drawChunksIn(0, 0, W, H);
      this.groundDraws++;
    } else {
      if (dxs || dys) {
        b.globalCompositeOperation = 'copy';
        b.drawImage(bg, dxs, dys);
        b.globalCompositeOperation = 'source-over';
        const strips: [number, number, number, number][] = [];
        if (dxs > 0) strips.push([0, 0, dxs, H]); else if (dxs < 0) strips.push([W + dxs, 0, -dxs, H]);
        if (dys > 0) strips.push([0, 0, W, dys]); else if (dys < 0) strips.push([0, H + dys, W, -dys]);
        for (const [x, y, w2, h2] of strips) {
          b.save();
          b.beginPath(); b.rect(x, y, w2, h2); b.clip();
          b.fillStyle = '#1d1430'; b.fillRect(x, y, w2, h2);
          drawChunksIn(x, y, x + w2, y + h2);
          b.restore();
        }
      }
      for (const key of paintedKeys) {
        const cx = key % CHUNKS, cy = (key / CHUNKS) | 0;
        const cv = this.chunks.get(cx, cy, false);
        if (!cv) continue;
        const [rx, ry, rw, rh] = rectOf(cx, cy);
        b.drawImage(cv, rx, ry, rw, rh);
      }
    }
    gs.valid = true; gs.z = z; gs.ox = ox; gs.oy = oy;
    c.drawImage(bg, 0, 0);

    T = this.pt('chunks', T);
    // ---- world space
    c.setTransform(z, 0, 0, z, ox, oy);
    // hidden discoveries hint
    for (let s = 0; s < g.specials.length; s++) {
      if (g.specials[s].revealed) continue;
      const sp = w.specials[s];
      const x = (sp.tx + sp.size / 2) * TILE, y = (sp.ty + sp.size / 2) * TILE;
      if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
      let left = 0, init = 0;
      for (let yy = 0; yy < sp.size; yy++) for (let xx = 0; xx < sp.size; xx++) { const i = tileIndex(sp.tx + xx, sp.ty + yy); left += w.garbage[i]; init += w.initial[i]; }
      if (left < init * 0.6 && Math.random() < dt * 3) this.fx.burst(x + (Math.random() - 0.5) * 16, y, 'magic', 1);
    }

    const showRanges = !!build || this.showRanges;
    if (showRanges) {
      for (const m of g.machines.machines) if (isHub(m.type)) drawRange(c, centerX(m) * TILE, centerY(m) * TILE, hubRadius(m, g.d) * TILE, '#38bdf8', time);
    }
    if (this.selected && g.machines.byId.has(this.selected.id)) {
      const m = this.selected;
      if (MACHINES[m.type].radius > 0 && !isHub(m.type)) drawRange(c, centerX(m) * TILE, centerY(m) * TILE, machineRadius(m, g.d) * TILE, '#facc15', time);
      if (isHub(m.type)) drawRange(c, centerX(m) * TILE, centerY(m) * TILE, hubRadius(m, g.d) * TILE, '#38bdf8', time);
    }

    // belts on the ground
    const pad = 3 * TILE;
    const inView = (x: number, y: number, r = pad) => x > view.x0 - r && x < view.x1 + r && y > view.y0 - r && y < view.y1 + r;
    for (const m of g.machines.machines) if (isBelt(m.type) && inView(m.tx * TILE, m.ty * TILE)) drawBelt(c, m, g, time);

    this.life.drawGround(c, view, time, cam.zoom);

    // y-sorted objects
    type Obj = { y: number; d: () => void };
    const objs: Obj[] = [];
    for (const m of g.machines.machines) {
      if (isBelt(m.type)) continue;
      const s = MACHINES[m.type].size;
      if (inView(centerX(m) * TILE, centerY(m) * TILE, pad + s * TILE)) {
        objs.push({ y: (m.ty + s) * TILE - 2, d: () => drawMachine(c, m, g, time, this.fx, true) });
      }
      if (m.bots.length) {
        for (const b of m.bots) if (inView(b.x * TILE, b.y * TILE)) { objs.push({ y: b.y * TILE + (m.type === 'excavator' ? 6 : 14), d: () => drawBots(c, { ...m, bots: [b] } as Machine, time, this.fx, true) }); }
      }
    }
    for (let s = 0; s < g.specials.length; s++) {
      if (!g.specials[s].revealed) continue;
      const sp = w.specials[s];
      if (inView((sp.tx + 1) * TILE, (sp.ty + 1) * TILE)) objs.push({ y: (sp.ty + sp.size) * TILE - 1, d: () => drawSpecialAt(c, g, s, time) });
    }
    objs.push({ y: p.y, d: () => drawPlayer(c, g, time) });
    for (const o of this.life.objects(view, time)) objs.push({ y: o.y, d: () => o.d(c) });
    objs.sort((a, b) => a.y - b.y);
    // aim visuals go under objects
    if (g.tool.mode === 'single') drawAimTile(c, g.aimTile, WORLD_TILES, time, g.player.collecting ? '#ffd166' : 'rgba(255,255,255,0.7)');
    else drawAreaTool(c, g, time, p.collecting);
    if (g.tool.mode === 'area' && p.collecting && g.areaCenter) {
      const r = g.tool.radius * g.d.reachMult * TILE;
      for (let i = 0; i < 3 * this.fx.quality; i++) {
        const a = Math.random() * 6.28, d = r * (0.6 + Math.random() * 0.5);
        this.fx.suck(g.areaCenter.x * TILE + Math.cos(a) * d, g.areaCenter.y * TILE + Math.sin(a) * d * 0.85, p.x, p.y - 12, g.toolTier >= 6 ? 5 : g.toolTier === 5 ? 8 : g.toolTier === 4 ? 4 : 0, 0.35);
      }
    }
    for (const o of objs) o.d();

    // effects
    this.fx.drawFlyers(c);
    this.fx.drawParticles(c, view);
    this.fx.drawDrones(c, time);
    T = this.pt('world', T);
    this.drawWorldEvent(c, time);
    this.life.drawSky(c, view, time);
    this.fx.drawTexts(c);

    if (build) this.drawBuild(build, time);
    T = this.pt('fx', T);

    // ---- screen space post
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Nébula-7 day cycle (3 min): a gentle violet dusk and night tint
    const day = (g.stats.playTime % 180) / 180;
    const night = Math.max(0, Math.cos((day - 0.75) * Math.PI * 2));
    const dusk = Math.max(0, 1 - Math.abs(day - 0.5) / 0.12);
    this.updateOverlay(night, dusk);
    this.drawLocator(time);
    this.pt('post', T);
  }

  private drawBuild(b: BuildPreview, time: number) {
    const g = this.game, c = this.c;
    const def = MACHINES[b.type];
    const s = def.size;
    // tile validity grid around the ghost
    const R = 7;
    for (let y = b.ty - R; y <= b.ty + R + s; y++) for (let x = b.tx - R; x <= b.tx + R + s; x++) {
      if (!inWorld(x, y)) continue;
      const d = Math.hypot(x - b.tx, y - b.ty);
      if (d > R) continue;
      const i = tileIndex(x, y);
      const free = g.world.garbage[i] === 0 && g.world.occupant[i] < 0 && g.world.specialAt[i] < 0;
      c.fillStyle = free ? `rgba(74,222,128,${0.16 * (1 - d / R)})` : `rgba(248,113,113,${0.1 * (1 - d / R)})`;
      c.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    }
    if (!this.ghost || this.ghost.type !== b.type) {
      this.ghost = { id: -1, type: b.type, tx: b.tx, ty: b.ty, dir: b.dir, level: 1, buffer: [0, 0, 0, 0, 0, 0], bufferTotal: 0, work: 0, cursor: 0, collected: 0, belt: [], bots: [], status: 'working', targets: null, targetsRadius: 0, anim: 0, lastTarget: -1, outConveyor: -1, inService: false, linked: true, deliverT: 0, built: 1, extra: 0, ox: 0, oy: 0, anchorX: 0, anchorY: 0, idleT: 0 };
    }
    const m = this.ghost;
    m.tx = b.tx; m.ty = b.ty; m.dir = b.dir;
    const ok = !b.problem;
    const cx = (b.tx + s / 2) * TILE, cy = (b.ty + s / 2) * TILE;
    if (def.radius > 0 && !isHub(b.type)) drawRange(c, cx, cy, machineRadius(m, g.d) * TILE, ok ? '#facc15' : '#f87171', time);
    if (isHub(b.type)) drawRange(c, cx, cy, (def.radius + g.d.serviceBonus) * TILE, '#38bdf8', time);
    c.save();
    c.globalAlpha = 0.6 + Math.sin(time * 6) * 0.1;
    if (isBelt(b.type)) drawBelt(c, m, g, time);
    else drawMachine(c, m, g, time, this.fx, false);
    c.restore();
    c.save();
    c.strokeStyle = ok ? '#4ade80' : '#f87171';
    c.lineWidth = 2;
    c.setLineDash([5, 3]);
    c.strokeRect(b.tx * TILE + 1, b.ty * TILE + 1, s * TILE - 2, s * TILE - 2);
    c.setLineDash([]);
    if (isBelt(b.type)) {
      // direction arrow
      const ax = cx + DX[b.dir] * 22, ay = cy + DY[b.dir] * 22;
      c.fillStyle = '#fde047';
      c.beginPath(); c.arc(ax, ay, 4, 0, 6.28); c.fill();
    }
    if (!ok) {
      c.font = '800 10px system-ui'; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(b.problem!, cx, b.ty * TILE - 8);
      c.fillStyle = '#fecaca'; c.fillText(b.problem!, cx, b.ty * TILE - 8);
    }
    c.restore();
  }


  private drawLocator(time: number) {
    const g = this.game, c = this.c;
    if (!g.locator) return;
    const tx = (g.locator.tx + 0.5) * TILE, ty = (g.locator.ty + 0.5) * TILE;
    const sx = (tx - this.cam.x) * this.cam.zoom + this.W / 2, sy = (ty - this.cam.y) * this.cam.zoom + this.H / 2;
    const margin = 60;
    const onScreen = sx > margin && sx < this.W - margin && sy > margin && sy < this.H - margin;
    const dist = Math.hypot(tx - g.player.x, ty - g.player.y) / TILE;
    c.save();
    if (onScreen) {
      const bob = Math.sin(time * 5) * 4;
      c.translate(sx, sy - 26 + bob);
      c.fillStyle = '#f472b6';
      c.beginPath(); c.moveTo(-7, -8); c.lineTo(7, -8); c.lineTo(0, 4); c.closePath(); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    } else {
      const ang = Math.atan2(sy - this.H / 2, sx - this.W / 2);
      const ex = this.W / 2 + Math.cos(ang) * (this.W / 2 - margin), ey = this.H / 2 + Math.sin(ang) * (this.H / 2 - margin);
      c.translate(clamp(ex, margin, this.W - margin), clamp(ey, margin + 40, this.H - margin));
      c.rotate(ang);
      c.fillStyle = 'rgba(244,114,182,0.95)';
      c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -10); c.lineTo(-3, 0); c.lineTo(-8, 10); c.closePath(); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.rotate(-ang);
      c.font = '800 11px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff';
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3;
      const label = `${Math.round(dist)}m`;
      c.strokeText(label, 0, 26); c.fillText(label, 0, 26);
    }
    c.restore();
  }

  tileAtScreen(sx: number, sy: number) {
    const w = this.screenToWorld(sx, sy);
    return { tx: Math.floor(w.x / TILE), ty: Math.floor(w.y / TILE), wx: w.x, wy: w.y };
  }
}
