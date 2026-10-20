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

interface BuildState extends BuildPreview { painting: boolean; lastTx: number; lastTy: number; placedId: number; drag: { sx: number; sy: number; tx: number; ty: number } | null; moving: { level: number; fromTx: number; fromTy: number; fromDir: number } | null }

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
    this.audio.init();
    this.audio.setMusic(this.settings.music);
    this.audio.setSfx(this.settings.sfx);
    if (this.started) return;
    this.started = true;
    if (isNew) this.game.intro();
    if (this.game.ended) this.renderer.endingT = -1;
  }

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
    if (this.input.touch) {
      // suggest the best nearby valid spot so the player only has to confirm
      const spot = this.game.findSpot(type, p.tx, p.ty);
      if (spot) { tx = spot.tx; ty = spot.ty; }
    }
    this.build = { type, tx, ty, dir: this.build?.dir ?? 0, problem: null, painting: false, lastTx: -1, lastTy: -1, placedId: -1, drag: null, moving: null };
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
    let tx = info.tx, ty = info.ty;
    const p = this.game.player;
    const spot = this.game.findSpot(info.type, p.tx, p.ty);
    if (spot && this.input.touch) { tx = spot.tx; ty = spot.ty; }
    void s;
    this.build = { type: info.type, tx, ty, dir: info.dir, problem: null, painting: false, lastTx: -1, lastTy: -1, placedId: -1, drag: null, moving: { level: info.level, fromTx: info.tx, fromTy: info.ty, fromDir: info.dir } };
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
    if (this.input.touch && this.build) {
      // ready for the next one: belts advance along their direction, machines jump to the next free spot
      if (isBelt(b.type)) { b.tx += DX[b.dir]; b.ty += DY[b.dir]; }
      else {
        const s = MACHINES[b.type].size;
        const spot = this.game.findSpot(b.type, b.tx + s / 2, b.ty + s / 2);
        if (spot) { b.tx = spot.tx; b.ty = spot.ty; }
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
    this.audio.init();
    if (this.ui.popupOpen || this.ui.modalTab) return false;
    const b = this.build;
    if (b) {
      if (touch) {
        // touch: the screen works like a trackpad, so the finger never hides the ghost
        b.drag = { sx, sy, tx: b.tx, ty: b.ty };
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
      if (!b.drag) return;
      const k = 1 / (this.renderer.cam.zoom * TILE);
      const nx = b.drag.tx + Math.round((sx - b.drag.sx) * k * 1.15), ny = b.drag.ty + Math.round((sy - b.drag.sy) * k * 1.15);
      if (nx !== b.tx || ny !== b.ty) {
        if (isBelt(b.type)) { const dx = nx - b.tx, dy = ny - b.ty; if (Math.abs(dx) + Math.abs(dy) === 1) b.dir = dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3; }
        b.tx = nx; b.ty = ny;
        this.updateGhostProblem();
        this.ui.refreshBuildBar();
        this.audio.play('click', 0.25);
      }
      return;
    }
    const pt = b.tx, pty = b.ty;
    this.ghostAt(sx, sy);
    if (b.painting && isBelt(b.type) && (b.tx !== pt || b.ty !== pty)) {
      // conveyor painting: point the previous belt toward the new tile
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
            let ndir: number;
            if (cx !== tx) { ndir = stepX > 0 ? 0 : 2; } else { ndir = stepY > 0 ? 1 : 3; }
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
  }

  worldUp(sx: number, sy: number, touch: boolean, tap: boolean) {
    const b = this.build;
    if (!b) return;
    if (b.painting) { b.painting = false; return; }
    if (touch) {
      // a quick tap jumps the ghost straight to that tile
      if (tap) { this.ghostAt(sx, sy); this.audio.play('click', 0.4); }
      b.drag = null;
      this.ui.refreshBuildBar();
    }
  }

  /** Nudge the ghost one tile (on-screen arrows). */
  nudgeBuild(dx: number, dy: number) {
    const b = this.build;
    if (!b) return;
    b.tx += dx; b.ty += dy;
    if (isBelt(b.type)) b.dir = dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
    this.updateGhostProblem();
    this.ui.refreshBuildBar();
    this.audio.play('click', 0.4);
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
    this.audio.init();
    if (code === 'Escape') {
      if (this.ui.modalTab) this.ui.closeModal();
      else if (this.build) this.cancelBuild();
      else this.ui.select(null);
      return;
    }
    if (this.ui.popupOpen) return;
    const tabs: Record<string, Parameters<UI['openModal']>[0]> = { KeyB: 'build', KeyU: 'upgrades', KeyT: 'tools', KeyI: 'inventory', KeyM: 'map', KeyP: 'stats' };
    if (tabs[code]) { if (this.ui.modalTab === tabs[code]) this.ui.closeModal(); else this.ui.openModal(tabs[code]); return; }
    if (code === 'KeyR') this.rotateBuild();
    if (code === 'Equal' || code === 'NumpadAdd') this.zoomBy(1.15);
    if (code === 'Minus' || code === 'NumpadSubtract') this.zoomBy(1 / 1.15);
  }

  // --------------------------------------------------------------- loop
  private frame(now: number) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
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
    if (this.started) g.update(dt, state);
    else g.update(dt, { moveX: 0, moveY: 0, collect: false, interact: false, aim: null });
    for (const e of g.events.splice(0)) {
      if (e.type === 'ending') this.renderer.endingT = 0;
      this.ui.handleEvent(e);
    }
    if (this.build) {
      this.updateGhostProblem();
      const s = MACHINES[this.build.type].size;
      this.renderer.focus = this.input.touch ? { x: (this.build.tx + s / 2) * TILE, y: (this.build.ty + s / 2) * TILE } : null;
    } else this.renderer.focus = null;
    this.fx.update(dt);
    this.renderer.chunks.rendersThisFrame = 0;
    this.renderer.draw(this.time, dt, this.build);
    this.ui.update(dt);
    this.saveT += dt;
    if (this.saveT > 15 && this.started) { this.saveT = 0; this.save(); }
    requestAnimationFrame((t) => this.frame(t));
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
