import { DX, DY, TILE } from './core/constants';
import { clamp } from './core/rng';
import { AudioEngine } from './audio/Audio';
import { MACHINES, MachineType } from './data/machines';
import { Game, InputState } from './game/Game';
import { SaveManager } from './game/Save';
import { isBelt } from './game/Machines';
import { ChunkRenderer } from './render/ChunkRenderer';
import { Effects } from './render/Effects';
import { BuildPreview, Renderer } from './render/Renderer';
import { buildItemSprites } from './render/sprites';
import { Input, PointerSink } from './ui/Input';
import { drawWorker } from './render/character';
import { UI } from './ui/UI';
import './ui/style.css';

interface Settings { music: number; sfx: number; quality: number; ranges: boolean }
const SETTINGS_KEY = 'garbage-kingdom-settings';

interface BuildState extends BuildPreview { painting: boolean; lastTx: number; lastTy: number; placedId: number; /** touch gesture in progress: dragging the ghost itself, or panning the camera */
  grab: { mode: 'ghost' | 'pan'; sx: number; sy: number; x: number; y: number; ox: number; oy: number; cx: number; cy: number; moved: boolean } | null;
  /** build camera (touch): free to pan independently from the player */
  cam: { x: number; y: number };
  /** suggested places, best first */
  spots: { tx: number; ty: number; garbage: number; service: boolean }[];
  /** garbage within reach of the ghost */
  reach: number; moving: { level: number; fromTx: number; fromTy: number; fromDir: number } | null }

export class App implements PointerSink {
  game: Game;
  audio = new AudioEngine();
  fx: Effects;
  renderer: Renderer;
  ui: UI;
  input: Input;
  saver = new SaveManager(window.localStorage);
  build: BuildState | null = null;
  settings: Settings = { music: 0.45, sfx: 0.8, quality: 1, ranges: false };
  private started = false;
  private time = 0;
  private last = performance.now();
  private saveT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private debugEl: HTMLElement | null = null;
  private debugT = 0;

  constructor() {
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* ignore */ }
    this.game = new Game();
    const load = this.saver.load(this.game);
    const dpr = window.devicePixelRatio || 1;
    const RS = dpr <= 1 ? 1.25 : dpr <= 1.5 ? 1.5 : 2;
    const sprites = buildItemSprites(RS);
    this.fx = new Effects(this.game.world, sprites, this.audio);
    this.game.fx = this.fx;
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const chunks = new ChunkRenderer(this.game.world, sprites, RS);
    this.renderer = new Renderer(canvas, this.game, chunks, this.fx);
    this.ui = new UI(this);
    this.input = new Input(canvas, this, document.querySelector('.joy') as HTMLElement);
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch'), (this.input.touch = true);
    this.input.bindHold(this.ui['el'].btnCollect, (v) => (this.input.touchCollect = v));
    this.input.bindHold(this.ui['el'].btnInteract, (v) => (this.input.touchInteract = v));
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('beforeunload', () => this.save());
    this.renderer.cam.targetZoom = this.renderer.cam.zoom = this.defaultZoom();
    window.addEventListener('orientationchange', () => setTimeout(() => { this.renderer.resize(); this.renderer.cam.targetZoom = this.defaultZoom(); }, 300));
    this.applySettings();

    if (load.error) console.warn('Save inválido, começando um novo jogo:', load.error);
    if (load.ok && load.elapsed > 30) {
      const secs = Math.min(3600, load.elapsed);
      const removed = this.game.simulateMachines(secs, 1);
      if (removed > 0) this.game.events.push({ type: 'offline', seconds: secs, removed });
    }
    this.ui.introPopup(!load.ok, () => this.start(!load.ok));
    document.getElementById('boot')!.classList.add('hide');
    requestAnimationFrame((t) => this.frame(t));
  }

  private start(isNew: boolean) {
    const first = !this.started;
    // the game must start even if this browser refuses audio
    this.started = true;
    // phones play in landscape (honored by Android when installed / fullscreen)
    try { (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch(() => undefined); } catch { /* unsupported */ }
    try {
      this.audio.init();
      this.audio.setMusic(this.settings.music);
      this.audio.setSfx(this.settings.sfx);
    } catch (e) { this.reportError(e); }
    if (!first) return;
    if (isNew) this.game.intro();
    if (this.game.ended) this.renderer.endingT = -1;
  }

  private errorShown = false;
  /** Shows the first runtime error on screen (so a player can send a screenshot) and keeps going. */
  reportError(e: unknown) {
    console.error(e);
    if (this.errorShown) return;
    this.errorShown = true;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#7f1d1d;color:#fff;font:12px monospace;padding:8px;border-radius:8px;pointer-events:auto;white-space:pre-wrap;max-height:30vh;overflow:auto';
    box.textContent = 'Erro (o jogo continua): ' + (e instanceof Error ? e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n') : String(e));
    box.onclick = () => box.remove();
    document.body.appendChild(box);
  }

  safeAudio() { try { this.audio.init(); } catch { /* audio unavailable */ } }

  /** Zoom so roughly the same amount of world is visible on any screen. */
  defaultZoom() {
    const short = Math.min(window.innerWidth, window.innerHeight);
    const touch = document.body.classList.contains('touch');
    return touch ? clamp(short / 400, 0.85, 1.3) : clamp(short / 760, 0.6, 1.1);
  }

  applySettings() {
    this.audio.setMusic(this.settings.music);
    this.audio.setSfx(this.settings.sfx);
    this.fx.quality = this.settings.quality;
    this.renderer.showRanges = this.settings.ranges;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  save() { if (this.started || this.game.stats.playTime > 0) this.saver.save(this.game); }

  resetProgress() {
    this.saver.reset();
    window.removeEventListener('beforeunload', () => this.save());
    this.started = false;
    this.game.stats.playTime = 0;
    location.reload();
  }

  zoomBy(f: number) {
    const cam = this.renderer.cam;
    cam.targetZoom = clamp(cam.targetZoom * f, this.renderer.minZoom, 1.8);
  }

  // --------------------------------------------------------------- build mode
  startBuild(type: MachineType) {
    const p = this.game.player;
    const s = MACHINES[type].size;
    let tx = Math.floor(p.tx + p.fx * 2 - s / 2 + 0.5), ty = Math.floor(p.ty + p.fy * 2 - s / 2 + 0.5);
    const spots = isBelt(type) ? [] : this.game.findSpots(type, p.tx, p.ty, 4);
    // touch: start on the best spot so the player may only have to confirm
    if (spots.length && this.input.touch) { tx = spots[0].tx; ty = spots[0].ty; }
    this.build = { type, tx, ty, dir: this.build?.dir ?? 0, problem: null, painting: false, lastTx: -1, lastTy: -1, placedId: -1, grab: null, moving: null, spots, reach: 0, cam: { x: (tx + s / 2) * TILE, y: (ty + s / 2) * TILE } };
    this.ui.select(null);
    this.updateGhostProblem();
    this.ui.showBuildBar();
  }

  /** Pick a machine up and enter build mode to put it somewhere else (free). */
  startMove(m: import('./game/Machines').Machine) {
    const info = this.game.pickUp(m);
    if (!info) return;
    this.ui.select(null);
    const s = MACHINES[info.type].size;
    // the ghost starts where the machine was; suggestions are around it
    const spots = isBelt(info.type) ? [] : this.game.findSpots(info.type, info.tx + s / 2, info.ty + s / 2, 4);
    this.build = { type: info.type, tx: info.tx, ty: info.ty, dir: info.dir, problem: null, painting: false, lastTx: -1, lastTy: -1, placedId: -1, grab: null, moving: { level: info.level, fromTx: info.tx, fromTy: info.ty, fromDir: info.dir }, spots, reach: 0, cam: { x: (info.tx + s / 2) * TILE, y: (info.ty + s / 2) * TILE } };
    this.updateGhostProblem();
    this.ui.showBuildBar();
  }

  cancelBuild() {
    if (!this.build) return;
    const mv = this.build.moving;
    // a machine being moved goes back to where it was
    if (mv) this.game.placeMoved(this.build.type, mv.fromTx, mv.fromTy, mv.level, mv.fromDir, true);
    this.build = null;
    this.ui.showBuildBar();
  }

  rotateBuild() {
    if (!this.build) return;
    this.build.dir = (this.build.dir + 1) % 4;
    this.audio.play('click');
  }

  private updateGhostProblem() {
    const b = this.build;
    if (!b) return;
    b.problem = this.game.placeProblem(b.type, b.tx, b.ty) ?? (b.moving ? null : this.game.missingFor(this.game.machineCost(b.type)));
    b.reach = this.game.reachGarbage(b.type, b.tx, b.ty, MACHINES[b.type].radius > 8 ? 2 : 1);
  }

  /** Move the ghost to a suggested spot (and the camera with it). */
  jumpToSpot(i: number) {
    const b = this.build;
    const sp = b?.spots[i];
    if (!b || !sp) return;
    const s = MACHINES[b.type].size;
    b.tx = sp.tx; b.ty = sp.ty;
    b.cam = { x: (sp.tx + s / 2) * TILE, y: (sp.ty + s / 2) * TILE };
    this.updateGhostProblem();
    this.ui.refreshBuildBar();
    this.audio.play('click', 0.5);
  }

  /** Belt painting: the ghost follows the pointer and lays a belt on every new tile. */
  private paintTo(sx: number, sy: number) {
    const b = this.build!;
    const pt = b.tx, pty = b.ty;
    this.ghostAt(sx, sy);
    if (!b.painting || (b.tx === pt && b.ty === pty) || (b.tx === b.lastTx && b.ty === b.lastTy)) return;
    // point the previous belt toward the new tile
    if (b.lastTx >= 0) {
      const dx = b.tx - b.lastTx, dy = b.ty - b.lastTy;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        b.dir = dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
        const prev = this.game.machines.at(b.lastTx, b.lastTy);
        if (prev && isBelt(prev.type) && prev.id === b.placedId) { prev.dir = b.dir; this.game.machines.linksDirty = true; }
      } else if (Math.abs(dx) + Math.abs(dy) > 1) {
        // fill gaps along the drag with an L path
        const stepX = Math.sign(dx), stepY = Math.sign(dy);
        let cx = b.lastTx, cy = b.lastTy;
        const tx = b.tx, ty = b.ty;
        while (cx !== tx || cy !== ty) {
          const prev = this.game.machines.at(cx, cy);
          const ndir = cx !== tx ? (stepX > 0 ? 0 : 2) : (stepY > 0 ? 1 : 3);
          if (prev && isBelt(prev.type) && prev.id === b.placedId) { prev.dir = ndir; this.game.machines.linksDirty = true; }
          if (cx !== tx) cx += stepX; else cy += stepY;
          b.tx = cx; b.ty = cy; b.dir = ndir;
          this.updateGhostProblem();
          if (!b.problem) this.place(); else { b.lastTx = cx; b.lastTy = cy; b.placedId = -1; }
        }
        return;
      }
    }
    this.updateGhostProblem();
    if (!b.problem) this.place();
    else { b.lastTx = b.tx; b.lastTy = b.ty; b.placedId = -1; }
  }

  private ghostAt(sx: number, sy: number) {
    const b = this.build!;
    const w = this.renderer.screenToWorld(sx, sy);
    const s = MACHINES[b.type].size;
    b.tx = Math.floor(w.x / TILE - s / 2 + 0.5);
    b.ty = Math.floor(w.y / TILE - s / 2 + 0.5);
    this.updateGhostProblem();
  }

  private place(): boolean {
    const b = this.build!;
    if (b.moving) {
      const e = this.game.placeMoved(b.type, b.tx, b.ty, b.moving.level, b.dir);
      if (e) { this.audio.play('error'); this.fx.text((b.tx + 0.5) * TILE, b.ty * TILE - 14, e, '#fca5a5'); return false; }
      const placed = this.game.machines.at(b.tx, b.ty);
      this.build = null;
      this.ui.showBuildBar();
      if (placed) this.ui.select(placed);
      return true;
    }
    const err = this.game.build(b.type, b.tx, b.ty, b.dir);
    if (err) {
      this.audio.play('error');
      this.fx.text((b.tx + 0.5) * TILE, b.ty * TILE - 14, err, '#fca5a5');
      return false;
    }
    const m = this.game.machines.at(b.tx, b.ty);
    b.placedId = m ? m.id : -1;
    b.lastTx = b.tx; b.lastTy = b.ty;
    if (this.input.touch && this.build && !b.painting) {
      // ready for the next one: belts advance along their direction, machines jump to the next free spot
      if (isBelt(b.type)) { b.tx += DX[b.dir]; b.ty += DY[b.dir]; }
      else {
        const s = MACHINES[b.type].size;
        b.spots = this.game.findSpots(b.type, b.tx + s / 2, b.ty + s / 2, 4);
        if (b.spots.length) { b.tx = b.spots[0].tx; b.ty = b.spots[0].ty; b.cam = { x: (b.tx + s / 2) * TILE, y: (b.ty + s / 2) * TILE }; }
      }
      this.updateGhostProblem();
    }
    this.ui.showBuildBar();
    if (!isBelt(b.type) && this.game.missingFor(this.game.machineCost(b.type))) this.cancelBuild();
    return true;
  }

  // --------------------------------------------------------------- pointer sink
  buildMode() { return !!this.build; }

  worldDown(sx: number, sy: number, touch: boolean): boolean {
    this.safeAudio();
    if (this.ui.popupOpen || this.ui.modalTab) return false;
    const b = this.build;
    if (b) {
      if (touch) {
        // touch: grab the ghost to drag it (belts: draw a line), anything else pans the map
        const w = this.renderer.screenToWorld(sx, sy);
        const s = MACHINES[b.type].size;
        const gx = (b.tx + s / 2) * TILE, gy = (b.ty + s / 2) * TILE;
        const pad = (s / 2 + 0.8) * TILE;
        const hit = Math.abs(w.x - gx) <= pad && Math.abs(w.y - gy) <= pad;
        b.grab = { mode: hit ? 'ghost' : 'pan', sx, sy, x: sx, y: sy, ox: gx - w.x, oy: gy - w.y, cx: b.cam.x, cy: b.cam.y, moved: false };
        if (hit && isBelt(b.type)) {
          b.painting = true;
          b.lastTx = -1;
          this.updateGhostProblem();
          if (!b.problem) this.place();
        }
        return false;
      }
      this.ghostAt(sx, sy);
      if (isBelt(b.type)) {
        b.painting = true;
        b.lastTx = -1;
        if (!b.problem) this.place();
      } else this.place();
      return false;
    }
    const t = this.renderer.tileAtScreen(sx, sy);
    const m = this.game.machines.at(t.tx, t.ty);
    if (m) { this.ui.select(m); return false; }
    if (!touch) this.ui.select(null);
    return !touch;
  }

  worldMove(sx: number, sy: number, touch?: boolean) {
    const b = this.build;
    if (!b) return;
    if (touch) {
      const gr = b.grab;
      if (!gr) return;
      gr.x = sx; gr.y = sy;
      if (Math.hypot(sx - gr.sx, sy - gr.sy) > 10) gr.moved = true;
      if (gr.mode === 'pan') {
        b.cam.x = gr.cx - (sx - gr.sx) / this.renderer.cam.zoom;
        b.cam.y = gr.cy - (sy - gr.sy) / this.renderer.cam.zoom;
        return;
      }
      if (b.painting) { this.paintTo(sx, sy); this.ui.refreshBuildBar(); return; }
      this.dragGhost();
      return;
    }
    if (b.painting && isBelt(b.type)) this.paintTo(sx, sy);
    else this.ghostAt(sx, sy);
  }

  /** Ghost follows the finger, keeping the grab offset (so it never jumps under the finger). */
  private dragGhost() {
    const b = this.build!, gr = b.grab!;
    const w = this.renderer.screenToWorld(gr.x, gr.y);
    const s = MACHINES[b.type].size;
    const nx = Math.floor((w.x + gr.ox) / TILE - s / 2 + 0.5), ny = Math.floor((w.y + gr.oy) / TILE - s / 2 + 0.5);
    if (nx === b.tx && ny === b.ty) return;
    b.tx = nx; b.ty = ny;
    this.updateGhostProblem();
    this.ui.refreshBuildBar();
    this.audio.play('click', 0.2);
  }

  worldUp(sx: number, sy: number, touch: boolean, tap: boolean) {
    const b = this.build;
    if (!b) return;
    const gr = b.grab;
    b.grab = null;
    if (b.painting) {
      b.painting = false;
      // after drawing, park the ghost on the tile after the last belt, ready to continue
      if (touch && b.lastTx >= 0 && b.placedId >= 0 && b.tx === b.lastTx && b.ty === b.lastTy) { b.tx += DX[b.dir]; b.ty += DY[b.dir]; this.updateGhostProblem(); }
      this.ui.refreshBuildBar();
      return;
    }
    if (touch) {
      // a quick tap on the map jumps the ghost straight to that tile
      if (gr && gr.mode === 'pan' && !gr.moved && tap) { this.ghostAt(sx, sy); this.audio.play('click', 0.4); }
      this.ui.refreshBuildBar();
    }
  }

  confirmBuild() {
    if (!this.build) return;
    this.updateGhostProblem();
    if (this.build.problem) { this.audio.play('error'); this.ui.refreshBuildBar(); return; }
    this.place();
  }

  cancel() {
    if (this.build) this.cancelBuild();
    else this.ui.select(null);
  }

  zoom(f: number) { this.zoomBy(f); }

  key(code: string) {
    this.safeAudio();
    if (code === 'Escape') {
      if (this.ui.modalTab) this.ui.closeModal();
      else if (this.build) this.cancelBuild();
      else this.ui.select(null);
      return;
    }
    if (this.ui.popupOpen) return;
    const tabs: Record<string, Parameters<UI['openModal']>[0]> = { KeyC: 'contracts', KeyB: 'build', KeyU: 'upgrades', KeyO: 'tools', KeyT: 'tools', KeyI: 'inventory', KeyM: 'map', KeyP: 'stats' };
    if (tabs[code]) { if (this.ui.modalTab === tabs[code]) this.ui.closeModal(); else this.ui.openModal(tabs[code]); return; }
    if (code === 'KeyR') this.rotateBuild();
    if (code === 'Equal' || code === 'NumpadAdd') this.zoomBy(1.15);
    if (code === 'Minus' || code === 'NumpadSubtract') this.zoomBy(1 / 1.15);
  }

  // --------------------------------------------------------------- loop
  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    try { this.step(now); } catch (e) { this.reportError(e); }
  }

  toggleDebug() {
    if (this.debugEl) { this.debugEl.remove(); this.debugEl = null; return; }
    const el = document.createElement('pre');
    el.id = 'debug';
    el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9999;margin:0;padding:6px 8px;max-width:calc(100vw - 12px);white-space:pre-wrap;font:11px/1.35 monospace;color:#bef264;background:rgba(0,0,0,.78);border-radius:6px;pointer-events:none';
    document.body.appendChild(el);
    this.debugEl = el;
  }

  private step(_ts: number) {
    // own clock: some browsers hand rAF timestamps in a different time base
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    if (!Number.isFinite(dt) || dt < 0) dt = 0.016;
    dt = Math.min(0.05, dt);
    this.last = now;
    this.time += dt;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 2) {
      const fps = this.fpsN / this.fpsAcc;
      // graceful degradation on slow devices
      if (fps < 40 && this.fx.quality > 0.5) this.fx.quality = 0.5;
      this.fpsAcc = 0; this.fpsN = 0;
    }
    const g = this.game;
    const blocked = !this.started || this.ui.popupOpen || !!this.ui.modalTab;
    const inp = this.input;
    const [mx, my] = blocked ? [0, 0] : inp.moveVector();
    let aim: InputState['aim'] = null;
    if (!inp.touch && inp.mouse.active && !this.build) {
      const w = this.renderer.screenToWorld(inp.mouse.x, inp.mouse.y);
      aim = { x: w.x, y: w.y };
    }
    const state: InputState = {
      moveX: mx, moveY: my,
      collect: !blocked && !this.build && (inp.mouseCollect || inp.keyCollect || inp.touchCollect),
      interact: !blocked && (inp.keyInteract || inp.touchInteract),
      aim,
    };
    try {
      if (this.started) g.update(dt, state);
      else g.update(dt, { moveX: 0, moveY: 0, collect: false, interact: false, aim: null });
    } catch (e) { this.reportError(e); }
    if (this.debugEl && (this.debugT -= dt) <= 0) {
      this.debugT = 0.2;
      const p = g.player, j = inp.joy, d = inp.dbg, f = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : String(n));
      this.debugEl.textContent = [
        `versão ${__BUILD__}`,
        `started ${this.started} · popup ${this.ui.popupOpen} · modal ${this.ui.modalTab || '-'} · build ${!!this.build}`,
        `touch ${inp.touch} · eventos start ${d.start} move ${d.move} end ${d.end} joyMove ${d.joyMove}`,
        `joy on ${j.on} id ${j.id} x ${f(j.x)} y ${f(j.y)} · dedos ${inp.pointers.size}`,
        `entrada ${f(mx)}, ${f(my)} · dt ${f(dt * 1000)}ms`,
        `jogador ${f(p.tx)}, ${f(p.ty)} · vel ${f(p.vx)}, ${f(p.vy)} · speed ${f(g.d.moveSpeed)}`,
        `andando ${p.moving} · fantasma ${f(g.ghostT)} · ${navigator.userAgent.slice(0, 90)}`,
      ].join('\n');
    }
    for (const e of g.events.splice(0)) {
      if (e.type === 'ending') this.renderer.endingT = 0;
      this.ui.handleEvent(e);
    }
    if (this.build) {
      this.updateGhostProblem();
      const s = MACHINES[this.build.type].size;
      const b = this.build;
      if (this.input.touch) {
        // dragging the ghost near a screen edge scrolls the map
        const gr = b.grab;
        if (gr && gr.mode === 'ghost' && !b.painting) {
          const m = 56, sp = 420 * dt / this.renderer.cam.zoom;
          const ex = gr.x < m ? -1 : gr.x > this.renderer.W - m ? 1 : 0;
          const ey = gr.y < m + 40 ? -1 : gr.y > this.renderer.H - m - 150 ? 1 : 0;
          if (ex || ey) { b.cam.x += ex * sp; b.cam.y += ey * sp; this.dragGhost(); }
        }
        const c = this.renderer.clampView(b.cam.x, b.cam.y);
        b.cam.x = c.x; b.cam.y = c.y;
        this.renderer.focus = b.cam;
      } else this.renderer.focus = null;
      void s;
    } else this.renderer.focus = null;
    this.fx.update(dt);
    this.renderer.chunks.rendersThisFrame = 0;
    try { this.renderer.draw(this.time, dt, this.build); } catch (e) { this.reportError(e); }
    if (this.build) this.ui.positionBuildOverlay();
    try { this.ui.update(dt); } catch (e) { this.reportError(e); }
    this.saveT += dt;
    if (this.saveT > 15 && this.started) { this.saveT = 0; this.save(); }
  }
}

function boot() {
  try {
    (window as unknown as { app: App; gkArt: unknown }).app = new App();
    (window as unknown as { gkArt: unknown }).gkArt = { drawWorker };
  } catch (e) {
    console.error(e);
    const t = document.querySelector('.boot-text');
    if (t) t.textContent = 'Erro ao iniciar: ' + (e as Error).message;
  }
}

// let the loading screen paint before heavy procedural generation
requestAnimationFrame(() => setTimeout(boot, 30));
