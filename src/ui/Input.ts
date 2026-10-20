export interface PointerSink {
  /** returns true if the press should become "collect while held" */
  worldDown(sx: number, sy: number, touch: boolean): boolean;
  worldMove(sx: number, sy: number, touch?: boolean): void;
  worldUp(sx: number, sy: number, touch: boolean, tap: boolean): void;
  cancel(): void;
  zoom(factor: number): void;
  key(code: string): void;
  buildMode(): boolean;
}

/** Keyboard, mouse and touch (dynamic joystick + pinch) input. */
export class Input {
  keys = new Set<string>();
  mouse = { x: 0, y: 0, active: false, lastMove: 0 };
  mouseCollect = false;
  keyCollect = false;
  touchCollect = false;
  touchInteract = false;
  keyInteract = false;
  joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; role: 'joy' | 'world' | 'pinch' }>();
  private pinchDist = 0;
  touch = false;

  constructor(private canvas: HTMLCanvasElement, private sink: PointerSink, private joyEl: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'Space') this.keyCollect = true;
      if (k === 'KeyE') this.keyInteract = true;
      this.sink.key(k);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.keyCollect = false;
      if (e.code === 'KeyE') this.keyInteract = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.keyCollect = false; this.mouseCollect = false; this.keyInteract = false; this.touchCollect = false; this.resetTouches(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.resetTouches(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.sink.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
  }

  private setTouch(on: boolean) {
    if (this.touch === on) return;
    this.touch = on;
    document.body.classList.toggle('touch', on);
  }

  private down(e: PointerEvent) {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    this.setTouch(isTouch);
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
    if (!isTouch) {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true; this.mouse.lastMove = performance.now();
      if (e.button === 2) { this.sink.cancel(); return; }
      if (e.button !== 0) return;
      this.mouseCollect = this.sink.worldDown(e.clientX, e.clientY, false);
      return;
    }
    // touch: the first finger on the screen means every older touch is gone, even if the
    // browser never told us (system gestures, notifications, app switches)
    if (e.isPrimary) this.resetTouches();
    const worldPointers = [...this.pointers.values()].filter((p) => p.role !== 'joy');
    if (worldPointers.length === 1 && !this.sink.buildMode()) {
      // second finger outside the joystick => pinch
      const other = worldPointers[0];
      other.role = 'pinch';
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), role: 'pinch' });
      this.pinchDist = Math.hypot(other.x - e.clientX, other.y - e.clientY);
      return;
    }
    const leftSide = e.clientX < window.innerWidth * 0.5;
    if (leftSide && this.joy.id < 0 && !this.sink.buildMode()) {
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), role: 'joy' });
      this.joyEl.classList.add('on');
      document.body.classList.add('joy-used');
      this.joyEl.style.left = e.clientX + 'px';
      this.joyEl.style.top = e.clientY + 'px';
      (this.joyEl.firstElementChild as HTMLElement).style.transform = '';
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), role: 'world' });
    this.sink.worldDown(e.clientX, e.clientY, true);
  }

  private move(e: PointerEvent) {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (!isTouch) {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true; this.mouse.lastMove = performance.now();
      this.sink.worldMove(e.clientX, e.clientY, false);
      return;
    }
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (p.role === 'joy') {
      const dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const R = 50;
      const l = Math.hypot(dx, dy);
      // dynamic joystick: drag the origin when exceeding the radius
      if (l > R * 1.4) { this.joy.ox += (dx / l) * (l - R * 1.4); this.joy.oy += (dy / l) * (l - R * 1.4); this.joyEl.style.left = this.joy.ox + 'px'; this.joyEl.style.top = this.joy.oy + 'px'; }
      const ddx = e.clientX - this.joy.ox, ddy = e.clientY - this.joy.oy;
      const ll = Math.hypot(ddx, ddy);
      const k = Math.min(1, ll / R);
      this.joy.x = ll > 6 ? (ddx / ll) * k : 0;
      this.joy.y = ll > 6 ? (ddy / ll) * k : 0;
      (this.joyEl.firstElementChild as HTMLElement).style.transform = `translate(${this.joy.x * R}px, ${this.joy.y * R}px)`;
    } else if (p.role === 'pinch') {
      const ps = [...this.pointers.values()].filter((q) => q.role === 'pinch');
      if (ps.length === 2) {
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        if (this.pinchDist > 0 && d > 0) this.sink.zoom(d / this.pinchDist);
        this.pinchDist = d;
      }
    } else {
      this.sink.worldMove(e.clientX, e.clientY, true);
    }
  }

  private up(e: PointerEvent) {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (!isTouch) {
      if (e.button === 0 || e.type === 'pointercancel') {
        this.mouseCollect = false;
        this.sink.worldUp(e.clientX, e.clientY, false, false);
      }
      return;
    }
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.role === 'joy') {
      this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
      this.joyEl.classList.remove('on');
    } else if (p.role === 'world') {
      const tap = Math.hypot(p.x - p.sx, p.y - p.sy) < 12 && performance.now() - p.t < 400;
      this.sink.worldUp(e.clientX, e.clientY, true, tap);
    } else if (p.role === 'pinch') {
      for (const q of this.pointers.values()) if (q.role === 'pinch') q.role = 'world';
      this.pinchDist = 0;
    }
  }

  /** Forget every tracked touch and release the joystick. */
  resetTouches() {
    this.pointers.clear();
    this.pinchDist = 0;
    if (this.joy.id >= 0) {
      this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
      this.joyEl.classList.remove('on');
    }
  }

  bindHold(el: HTMLElement, set: (v: boolean) => void) {
    const on = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); this.setTouch(e.pointerType !== 'mouse'); set(true); el.classList.add('held'); try { el.setPointerCapture(e.pointerId); } catch { /* noop */ } };
    const off = () => { set(false); el.classList.remove('held'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
  }

  moveVector(): [number, number] {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    if (this.joy.id >= 0) { x += this.joy.x; y += this.joy.y; }
    return [x, y];
  }
}
