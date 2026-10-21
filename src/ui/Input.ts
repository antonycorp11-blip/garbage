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

type Role = 'joy' | 'world' | 'pinch';
interface Track { x: number; y: number; sx: number; sy: number; t: number; role: Role }

/**
 * Keyboard, mouse and touch input.
 * Touch uses the native touch events (the most reliable path on phones); pointer events are
 * only used for the mouse and as a fallback on devices without touch events.
 */
export class Input {
  keys = new Set<string>();
  mouse = { x: 0, y: 0, active: false, lastMove: 0 };
  mouseCollect = false;
  keyCollect = false;
  touchCollect = false;
  touchInteract = false;
  keyInteract = false;
  /** `on` marks an active stick: touch ids can be any integer (iOS Safari hands out negative ones) */
  joy = { on: false, id: 0, ox: 0, oy: 0, x: 0, y: 0 };
  pointers = new Map<number, Track>();
  private pinchDist = 0;
  touch = false;
  /** event counters for the hidden diagnostic overlay */
  dbg = { start: 0, move: 0, end: 0, joyMove: 0 };
  private readonly nativeTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  constructor(canvas: HTMLCanvasElement, private sink: PointerSink, private joyEl: HTMLElement) {
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

    // ---- native touch events (phones/tablets)
    if (this.nativeTouch) {
      const opts = { passive: false } as AddEventListenerOptions;
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.dbg.start++;
        this.setTouch(true);
        // every finger is new => anything still tracked is stale (lost gesture)
        if (e.touches.length === e.changedTouches.length) this.resetTouches();
        for (const t of Array.from(e.changedTouches)) this.touchDown(t.identifier, t.clientX, t.clientY);
      }, opts);
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        this.dbg.move++;
        for (const t of Array.from(e.changedTouches)) this.touchMove(t.identifier, t.clientX, t.clientY);
      }, opts);
      const end = (e: TouchEvent) => {
        e.preventDefault();
        this.dbg.end++;
        for (const t of Array.from(e.changedTouches)) this.touchUp(t.identifier, t.clientX, t.clientY, e.type === 'touchcancel');
        if (e.touches.length === 0 && this.joy.on) this.releaseJoy();
      };
      canvas.addEventListener('touchend', end, opts);
      canvas.addEventListener('touchcancel', end, opts);
    }

    // ---- pointer events: mouse (and touch only when native touch events are missing)
    canvas.addEventListener('pointerdown', (e) => {
      if (this.isTouchPointer(e)) {
        if (this.nativeTouch) return;
        this.setTouch(true);
        if (e.isPrimary) this.resetTouches();
        try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
        this.touchDown(e.pointerId, e.clientX, e.clientY);
        return;
      }
      this.setTouch(false);
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true; this.mouse.lastMove = performance.now();
      if (e.button === 2) { this.sink.cancel(); return; }
      if (e.button !== 0) return;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.mouseCollect = this.sink.worldDown(e.clientX, e.clientY, false);
    });
    window.addEventListener('pointermove', (e) => {
      if (this.isTouchPointer(e)) { if (!this.nativeTouch) this.touchMove(e.pointerId, e.clientX, e.clientY); return; }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true; this.mouse.lastMove = performance.now();
      this.sink.worldMove(e.clientX, e.clientY, false);
    });
    const pup = (e: PointerEvent) => {
      if (this.isTouchPointer(e)) { if (!this.nativeTouch) this.touchUp(e.pointerId, e.clientX, e.clientY, e.type === 'pointercancel'); return; }
      if (e.button === 0 || e.type === 'pointercancel') {
        this.mouseCollect = false;
        this.sink.worldUp(e.clientX, e.clientY, false, false);
      }
    };
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
  }

  private isTouchPointer(e: PointerEvent) { return e.pointerType === 'touch' || e.pointerType === 'pen'; }

  private setTouch(on: boolean) {
    if (this.touch === on) return;
    this.touch = on;
    document.body.classList.toggle('touch', on);
  }

  // ------------------------------------------------------------------ touch logic (shared)
  private touchDown(id: number, x: number, y: number) {
    const worldTracks = [...this.pointers.values()].filter((p) => p.role !== 'joy');
    if (worldTracks.length === 1 && !this.sink.buildMode()) {
      // a second finger outside the joystick => pinch zoom
      const other = worldTracks[0];
      other.role = 'pinch';
      this.pointers.set(id, { x, y, sx: x, sy: y, t: performance.now(), role: 'pinch' });
      this.pinchDist = Math.hypot(other.x - x, other.y - y);
      return;
    }
    const leftSide = x < window.innerWidth * 0.5;
    if (leftSide && !this.joy.on && !this.sink.buildMode()) {
      this.joy = { on: true, id, ox: x, oy: y, x: 0, y: 0 };
      this.pointers.set(id, { x, y, sx: x, sy: y, t: performance.now(), role: 'joy' });
      this.joyEl.classList.add('on');
      document.body.classList.add('joy-used');
      this.joyEl.style.left = x + 'px';
      this.joyEl.style.top = y + 'px';
      (this.joyEl.firstElementChild as HTMLElement).style.transform = '';
      return;
    }
    this.pointers.set(id, { x, y, sx: x, sy: y, t: performance.now(), role: 'world' });
    this.sink.worldDown(x, y, true);
  }

  private touchMove(id: number, x: number, y: number) {
    const p = this.pointers.get(id);
    if (!p) return;
    p.x = x; p.y = y;
    if (p.role === 'joy') {
      this.dbg.joyMove++;
      const R = 50;
      const dx = x - this.joy.ox, dy = y - this.joy.oy;
      const l = Math.hypot(dx, dy);
      // dynamic joystick: the base follows the finger when it goes too far
      if (l > R * 1.4) {
        this.joy.ox += (dx / l) * (l - R * 1.4); this.joy.oy += (dy / l) * (l - R * 1.4);
        this.joyEl.style.left = this.joy.ox + 'px'; this.joyEl.style.top = this.joy.oy + 'px';
      }
      const ddx = x - this.joy.ox, ddy = y - this.joy.oy;
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
      this.sink.worldMove(x, y, true);
    }
  }

  private touchUp(id: number, x: number, y: number, cancelled: boolean) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    if (p.role === 'joy') this.releaseJoy();
    else if (p.role === 'world') {
      const tap = !cancelled && Math.hypot(p.x - p.sx, p.y - p.sy) < 12 && performance.now() - p.t < 400;
      this.sink.worldUp(x, y, true, tap);
    } else if (p.role === 'pinch') {
      for (const q of this.pointers.values()) if (q.role === 'pinch') q.role = 'world';
      this.pinchDist = 0;
    }
  }

  private releaseJoy() {
    this.joy = { on: false, id: 0, ox: 0, oy: 0, x: 0, y: 0 };
    this.joyEl.classList.remove('on');
  }

  /** Forget every tracked touch and release the joystick. */
  resetTouches() {
    this.pointers.clear();
    this.pinchDist = 0;
    if (this.joy.on) this.releaseJoy();
  }

  bindHold(el: HTMLElement, set: (v: boolean) => void) {
    const on = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.setTouch(e.type === 'touchstart' || (e as PointerEvent).pointerType !== 'mouse'); set(true); el.classList.add('held'); };
    const off = (e?: Event) => { if (e) e.preventDefault(); set(false); el.classList.remove('held'); };
    if (this.nativeTouch) {
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
    }
    el.addEventListener('pointerdown', (e) => { if (this.nativeTouch && e.pointerType !== 'mouse') return; on(e); try { el.setPointerCapture(e.pointerId); } catch { /* noop */ } });
    el.addEventListener('pointerup', (e) => { if (this.nativeTouch && e.pointerType !== 'mouse') return; off(); });
    el.addEventListener('pointercancel', (e) => { if (this.nativeTouch && e.pointerType !== 'mouse') return; off(); });
    el.addEventListener('lostpointercapture', (e) => { if (this.nativeTouch && e.pointerType !== 'mouse') return; off(); });
  }

  moveVector(): [number, number] {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    if (this.joy.on) { x += this.joy.x; y += this.joy.y; }
    return [x, y];
  }
}
