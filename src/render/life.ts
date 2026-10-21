import { CENTER, TILE, WORLD_PX, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { hash2, valueNoise } from '../core/rng';
import { Game } from '../game/Game';
import { Effects } from './Effects';
import { ellipse, groundShadow, lin, makeCanvas, rad, rrect } from './paint';

type C = CanvasRenderingContext2D;
type View = { x0: number; y0: number; x1: number; y1: number };

interface Dog { x: number; y: number; tx: number; ty: number; vx: number; state: 'follow' | 'wander' | 'sit' | 'sniff'; t: number; face: number; walk: number; bark: number }
interface Bird { a: number; r: number; speed: number; h: number; phase: number }
/** Glubs: the planet's jelly natives. They come back to land that has been cleaned. */
interface Glub { x: number; y: number; tx: number; ty: number; t: number; hop: number; col: number; face: number; emote: number; s: number }
interface Cloud { x: number; y: number; s: number }

export const VALDEMAR = { x: (CENTER - 3.4) * TILE, y: (CENTER + 2.7) * TILE };

/** Ambient life: NPCs, animals, clouds and small decorative animation. Purely visual. */
export class Life {
  dog: Dog;
  birds: Bird[] = [];
  glubs: Glub[] = [];
  private glubT = 0;
  birdCenter = { x: 0, y: 0 };
  private birdT = 0;
  clouds: Cloud[] = [];
  private cloudSprite: HTMLCanvasElement;
  private stepPhase = 0;
  speech: { text: string; t: number } | null = null;

  constructor(private game: Game, private fx: Effects) {
    const p = game.player;
    this.dog = { x: p.x - 30, y: p.y + 10, tx: p.x, ty: p.y, vx: 0, state: 'wander', t: 2, face: 1, walk: 0, bark: 0 };
    for (let i = 0; i < 4; i++) this.birds.push({ a: Math.random() * 6.28, r: 70 + Math.random() * 110, speed: 0.08 + Math.random() * 0.08, h: 70 + Math.random() * 50, phase: Math.random() * 6 });
    for (let i = 0; i < 7; i++) this.clouds.push({ x: Math.random() * WORLD_PX, y: Math.random() * WORLD_PX, s: 0.7 + Math.random() * 0.9 });
    this.cloudSprite = this.makeCloud();
  }

  private makeCloud() {
    const S = 256;
    const cv = makeCanvas(S, S);
    const c = cv.getContext('2d')!;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.28, d = 30 + (i % 3) * 22;
      const x = S / 2 + Math.cos(a) * d * 1.3, y = S / 2 + Math.sin(a) * d * 0.7, r = 40 + (i % 4) * 12;
      c.fillStyle = rad(c, x, y, 0, r, [[0, 'rgba(40,16,70,0.45)'], [1, 'rgba(40,16,70,0)']]);
      c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
    }
    return cv;
  }

  say(text: string) { this.speech = { text, t: 6 }; }

  update(dt: number, time: number) {
    const g = this.game, p = g.player;
    // ---- dog
    const d = this.dog;
    const dp = Math.hypot(p.x - d.x, p.y - d.y);
    d.t -= dt;
    d.bark = Math.max(0, d.bark - dt);
    if (dp > 25 * TILE) { d.x = p.x - 20; d.y = p.y + 10; }
    if (dp > 3.6 * TILE) { d.state = 'follow'; d.tx = p.x - p.fx * 20; d.ty = p.y - p.fy * 14 + 6; }
    else if (d.t <= 0) {
      d.t = 2 + Math.random() * 4;
      const r = Math.random();
      if (r < 0.3) d.state = 'sit';
      else if (r < 0.55) {
        d.state = 'sniff';
        const ang = Math.random() * 6.28;
        d.tx = p.x + Math.cos(ang) * 50; d.ty = p.y + Math.sin(ang) * 40;
      } else {
        d.state = 'wander';
        const ang = Math.random() * 6.28;
        d.tx = p.x + Math.cos(ang) * 60; d.ty = p.y + Math.sin(ang) * 45;
      }
    }
    if (d.state !== 'sit') {
      const dx = d.tx - d.x, dy = d.ty - d.y, l = Math.hypot(dx, dy);
      const speed = d.state === 'follow' ? Math.max(5.5, g.d.moveSpeed * 1.25) * TILE : 1.6 * TILE;
      if (l > 4) {
        const step = Math.min(l, speed * dt);
        d.x += (dx / l) * step; d.y += (dy / l) * step;
        d.vx = dx / l;
        if (Math.abs(dx) > 1) d.face = dx > 0 ? 1 : -1;
        d.walk += dt * (d.state === 'follow' ? 18 : 9);
      } else if (d.state === 'follow') d.state = 'wander';
      else d.walk = 0;
    }
    d.x = Math.max(8, Math.min(WORLD_PX - 8, d.x));
    d.y = Math.max(8, Math.min(WORLD_PX - 8, d.y));

    // ---- footsteps dust
    if (p.moving) {
      const ph = Math.floor(p.walk / Math.PI);
      if (ph !== this.stepPhase) {
        this.stepPhase = ph;
        const tx = Math.floor(p.tx), ty = Math.floor(p.ty);
        if (inWorld(tx, ty)) {
          const dirty = g.world.garbage[tileIndex(tx, ty)] > 0;
          this.fx.spawn(0, p.x + (ph % 2 ? 3 : -3), p.y, -p.vx * 4 + (Math.random() - 0.5) * 6, -6, 0.5, dirty ? 3.5 : 2.6, dirty ? 1 : 0);
        }
      }
    }

    // ---- birds circle over the densest nearby chunk
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 25;
      let best = -1, bx = p.x, by = p.y;
      for (let k = 0; k < 30; k++) {
        const x = p.x + (Math.random() - 0.5) * 30 * TILE, y = p.y + (Math.random() - 0.5) * 20 * TILE;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (!inWorld(tx, ty)) continue;
        const v = g.world.garbage[tileIndex(tx, ty)];
        if (v > best) { best = v; bx = x; by = y; }
      }
      this.birdCenter = { x: bx, y: by };
    }
    for (const b of this.birds) b.a += b.speed * dt;
    // ---- clouds drift
    for (const c of this.clouds) {
      c.x += 10 * dt; c.y += 3 * dt;
      if (c.x > WORLD_PX + 300) c.x = -300;
      if (c.y > WORLD_PX + 300) c.y = -300;
    }
    this.updateGlubs(dt);
    if (this.speech) { this.speech.t -= dt; if (this.speech.t <= 0) this.speech = null; }
    void time;
  }

  /** Glubs come back to cleaned land: more of them the cleaner the planet. */
  private updateGlubs(dt: number) {
    const g = this.game, w = g.world, p = g.player;
    const pct = 1 - w.remaining / 1_000_000;
    const want = pct < 0.0015 ? 0 : Math.min(16, 2 + Math.floor(Math.sqrt(pct) * 20));
    this.glubT -= dt;
    const freeSpot = (cx: number, cy: number, R: number) => {
      for (let k = 0; k < 40; k++) {
        const tx = Math.floor(cx / TILE + (Math.random() - 0.5) * 2 * R), ty = Math.floor(cy / TILE + (Math.random() - 0.5) * 2 * R);
        if (!inWorld(tx, ty)) continue;
        const i = tileIndex(tx, ty);
        if (w.garbage[i] === 0 && w.initial[i] > 0 && w.occupant[i] < 0) return { x: (tx + 0.2 + Math.random() * 0.6) * TILE, y: (ty + 0.3 + Math.random() * 0.5) * TILE };
      }
      return null;
    };
    if (this.glubs.length < want && this.glubT <= 0) {
      this.glubT = 1.5;
      const sp = freeSpot(p.x, p.y, 13);
      if (sp) this.glubs.push({ x: sp.x, y: sp.y, tx: sp.x, ty: sp.y, t: 1, hop: 0, col: Math.floor(Math.random() * 5), face: 0, emote: 0, s: 1.25 + Math.random() * 0.45 });
    }
    if (this.glubs.length > want) this.glubs.length = want;
    for (let i = 0; i < this.glubs.length; i++) {
      const gl = this.glubs[i];
      if (Math.hypot(gl.x - p.x, gl.y - p.y) > 26 * TILE) {
        const sp = freeSpot(p.x, p.y, 13);
        if (sp) { gl.x = gl.tx = sp.x; gl.y = gl.ty = sp.y; }
        continue;
      }
      gl.emote = Math.max(0, gl.emote - dt * 0.6);
      gl.t -= dt;
      const dpx = gl.x - p.x, dpy = gl.y - p.y, dp = Math.hypot(dpx, dpy);
      if (dp < 1.6 * TILE && gl.t > 0.3) {
        // shy: hop away from BIP, then send a heart
        const sp = { x: gl.x + (dpx / (dp || 1)) * 2.5 * TILE, y: gl.y + (dpy / (dp || 1)) * 2 * TILE };
        const tx = Math.floor(sp.x / TILE), ty = Math.floor(sp.y / TILE);
        if (inWorld(tx, ty) && w.garbage[tileIndex(tx, ty)] === 0) { gl.tx = sp.x; gl.ty = sp.y; gl.t = 0.2; if (Math.random() < 0.5) gl.emote = 1.6; }
      } else if (gl.t <= 0) {
        gl.t = 1.5 + Math.random() * 3;
        const sp = freeSpot(gl.x, gl.y, 3);
        if (sp) { gl.tx = sp.x; gl.ty = sp.y; }
      }
      const dx = gl.tx - gl.x, dy = gl.ty - gl.y, l = Math.hypot(dx, dy);
      if (l > 1) {
        const step = Math.min(l, 1.8 * TILE * dt);
        gl.x += (dx / l) * step; gl.y += (dy / l) * step;
        gl.hop += dt * 11;
        gl.face = Math.max(-1, Math.min(1, dx / 8));
      } else {
        // settle the hop to the ground
        const ph = gl.hop % Math.PI;
        if (ph > 0.05) gl.hop += Math.min(dt * 11, Math.PI - ph);
        gl.face *= 0.9;
      }
    }
  }

  /** y-sortable objects */
  objects(view: View, time: number): { y: number; d: (c: C) => void }[] {
    const out: { y: number; d: (c: C) => void }[] = [];
    const inV = (x: number, y: number) => x > view.x0 - 60 && x < view.x1 + 60 && y > view.y0 - 60 && y < view.y1 + 80;
    const d = this.dog;
    if (inV(d.x, d.y)) out.push({ y: d.y, d: (c) => drawDog(c, d, time) });
    if (inV(VALDEMAR.x, VALDEMAR.y)) out.push({ y: VALDEMAR.y, d: (c) => drawValdemar(c, VALDEMAR.x, VALDEMAR.y, time, this.speech) });
    for (const gl of this.glubs) if (inV(gl.x, gl.y)) out.push({ y: gl.y, d: (c) => drawGlub(c, gl, time) });
    return out;
  }

  /** Small animated details on the ground (flies, butterflies). */
  drawGround(c: C, view: View, time: number, zoom: number) {
    if (zoom < 0.7) return;
    const g = this.game, w = g.world, p = g.player;
    const R = 10;
    const ptx = Math.floor(p.tx), pty = Math.floor(p.ty);
    for (let ty = pty - R; ty <= pty + R; ty++) for (let tx = ptx - R - 4; tx <= ptx + R + 4; tx++) {
      if (!inWorld(tx, ty)) continue;
      const i = tileIndex(tx, ty);
      const gv = w.garbage[i];
      const h = hash2(tx, ty, 61);
      if (gv > 30 && h < 0.07) {
        // glowing spores drifting up from the junk
        const cx = (tx + 0.5) * TILE, cy = (ty + 0.3) * TILE;
        if (cx < view.x0 || cx > view.x1 || cy < view.y0 || cy > view.y1) continue;
        for (let k = 0; k < 4; k++) {
          const life = (time * (0.25 + k * 0.05) + k * 0.31 + h * 7) % 1;
          const sx = cx + Math.sin(time * 1.3 + k * 2 + h * 30) * (4 + k * 2);
          const sy = cy - life * 26;
          const a = Math.sin(life * Math.PI);
          const col = k % 2 ? '165,243,252' : '249,168,212';
          c.fillStyle = `rgba(${col},${0.25 * a})`; c.beginPath(); c.arc(sx, sy, 2.4, 0, 6.28); c.fill();
          c.fillStyle = `rgba(255,255,255,${0.9 * a})`; c.fillRect(sx - 0.5, sy - 0.5, 1, 1);
        }
      } else if (gv === 0 && h > 0.965 && w.ground[i] !== 3) {
        // glow moth over clean ground
        const t = time * 0.6 + h * 40;
        const bx = (tx + 0.5) * TILE + Math.sin(t) * 26 + Math.sin(t * 2.3) * 8;
        const by = (ty + 0.5) * TILE + Math.cos(t * 0.8) * 18 - 10;
        if (bx < view.x0 || bx > view.x1 || by < view.y0 || by > view.y1) continue;
        const flap = Math.abs(Math.sin(time * 12 + h * 9));
        const col = ['#67e8f9', '#f9a8d4', '#fde68a', '#c4b5fd'][Math.floor(h * 1000) % 4];
        c.fillStyle = 'rgba(20,10,40,0.18)'; ellipse(c, bx + 3, by + 14, 2.5, 1); c.fill();
        c.globalAlpha = 0.35; c.fillStyle = col; c.beginPath(); c.arc(bx, by, 5, 0, 6.28); c.fill(); c.globalAlpha = 1;
        c.fillStyle = col;
        ellipse(c, bx - 1.8 * flap, by, 1.9 * flap + 0.3, 2.4); c.fill();
        ellipse(c, bx + 1.8 * flap, by, 1.9 * flap + 0.3, 2.4); c.fill();
        c.fillStyle = '#fff'; c.fillRect(bx - 0.4, by - 1.6, 0.8, 3.2);
      }
    }
  }

  /** Clouds and birds, above everything in the world. */
  drawSky(c: C, view: View, time: number) {
    // sky jellies drifting high above, with shadows on the ground
    const bc = this.birdCenter;
    for (const b of this.birds) {
      const x = bc.x + Math.cos(b.a) * b.r, y = bc.y + Math.sin(b.a) * b.r * 0.6;
      if (x < view.x0 - 200 || x > view.x1 + 200 || y < view.y0 - 200 || y > view.y1 + 200) continue;
      const pulse = Math.sin(time * 1.8 + b.phase);
      c.fillStyle = 'rgba(30,10,60,0.16)'; ellipse(c, x + 30, y + b.h * 0.6, 12, 5); c.fill();
      drawSkyJelly(c, x, y - b.h, time, b.phase, pulse);
    }
    // cloud shadows
    for (const cl of this.clouds) {
      const s = 560 * cl.s;
      if (cl.x + s < view.x0 || cl.x - s > view.x1 || cl.y + s < view.y0 || cl.y - s > view.y1) continue;
      c.globalAlpha = 0.55;
      c.drawImage(this.cloudSprite, cl.x - s / 2, cl.y - s / 2, s, s * 0.8);
      c.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------------------------------ dog (Pulguento, a little scrap robot dog)
const DOG_OL = '#2a1a10', DOG = '#e98a3c', DOG_D = '#b55e1f', DOG_M = '#9fb0b8', DOG_GLOW = '#6ff6ff';
function drawDog(c: C, d: Dog, time: number) {
  const moving = d.state !== 'sit' && d.walk > 0 && (d.state === 'follow' || d.state === 'wander' || d.state === 'sniff');
  const run = d.state === 'follow';
  const ph = d.walk;
  groundShadow(c, d.x, d.y + 1, 9, 3, 0.4);
  c.save();
  c.translate(d.x, d.y);
  c.scale(d.face, 1);
  const bounce = moving ? Math.abs(Math.sin(ph)) * (run ? 2 : 1) : 0;
  c.translate(0, -bounce);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const tail = (tx: number, ty: number, base: number) => {
    const wag = Math.sin(time * (run ? 12 : 16)) * 0.55;
    c.save(); c.translate(tx, ty); c.rotate(base + wag);
    c.strokeStyle = DOG_OL; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(-1, -6); c.stroke();
    c.strokeStyle = DOG_M; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = Math.sin(time * 5) > -0.3 ? '#7dff8a' : '#2f7a3a';
    c.beginPath(); c.arc(-1, -6.6, 1.3, 0, 6.28); c.fill(); c.strokeStyle = DOG_OL; c.lineWidth = 0.6; c.stroke();
    c.restore();
  };
  const body = (cx: number, cy: number, rx: number, ry: number) => {
    ellipse(c, cx, cy, rx, ry); c.fillStyle = DOG; c.fill();
    c.save(); ellipse(c, cx, cy, rx, ry); c.clip(); c.fillStyle = DOG_D; ellipse(c, cx + 1, cy + ry * 0.8, rx * 1.1, ry * 0.7); c.fill(); c.restore();
    ellipse(c, cx, cy, rx, ry); c.strokeStyle = DOG_OL; c.lineWidth = 0.9; c.stroke();
    // panel seam + rivets
    c.strokeStyle = 'rgba(42,26,16,0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(cx - 1, cy - ry + 0.6); c.lineTo(cx - 1, cy + ry - 0.6); c.stroke();
    c.fillStyle = DOG_OL; c.beginPath(); c.arc(cx - 2.2, cy - 1, 0.45, 0, 6.28); c.arc(cx + 0.2, cy - 1, 0.45, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)'; ellipse(c, cx - rx * 0.4, cy - ry * 0.5, rx * 0.35, ry * 0.22); c.fill();
  };
  const leg = (lx: number, top: number, footX: number, far: boolean) => {
    c.strokeStyle = DOG_OL; c.lineWidth = 1.9; c.beginPath(); c.moveTo(lx, top); c.lineTo(footX, -0.9); c.stroke();
    c.strokeStyle = far ? '#6d7f88' : DOG_M; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = far ? '#1b7f78' : '#2bb5a8'; c.beginPath(); c.arc(footX, -0.9, 1.15, 0, 6.28); c.fill(); c.strokeStyle = DOG_OL; c.lineWidth = 0.5; c.stroke();
  };
  if (d.state === 'sit') {
    tail(-5, -4, -1);
    leg(-3, -4, -4, true); leg(2, -6, 2, false); leg(4, -6, 4.4, false);
    body(-0.6, -6, 5.6, 4.6);
    drawDogHead(c, 3.5, -12, time, false, d.bark > 0);
  } else {
    const sw = moving ? Math.sin(ph) * (run ? 3.2 : 2) : 0;
    leg(-3, -6, -3 - sw, true); leg(4, -6, 4 + sw, true);
    tail(-7, -8, -0.6);
    body(0, -7.2, 8, 4.2);
    leg(-4.5, -5, -4.5 + sw, false); leg(5, -5, 5 - sw, false);
    const sniff = d.state === 'sniff' ? 3 + Math.sin(time * 12) * 0.5 : 0;
    drawDogHead(c, 7.5, -10 + sniff, time, moving && run, d.bark > 0);
  }
  c.restore();
}

function drawDogHead(c: C, x: number, y: number, time: number, panting: boolean, bark: boolean) {
  // floppy metal ear (behind)
  const flop = Math.sin(time * 6) * 0.25;
  c.save(); c.translate(x - 1.8, y - 2.6); c.rotate(0.55 + flop);
  rrect(c, -1.4, 0, 2.8, 5, 1.2); c.fillStyle = DOG_D; c.fill(); c.strokeStyle = DOG_OL; c.lineWidth = 0.7; c.stroke();
  c.restore();
  // head box with a snout
  rrect(c, x - 3.8, y - 3.6, 7.6, 6.8, 2.4); c.fillStyle = DOG; c.fill(); c.strokeStyle = DOG_OL; c.lineWidth = 0.9; c.stroke();
  rrect(c, x + 2, y - 0.4, 4.2, 3.4, 1.4); c.fillStyle = DOG_M; c.fill(); c.strokeStyle = DOG_OL; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x + 5.6, y + 0.4, 0.8, 0, 6.28); c.fill();
  if (panting || bark) {
    c.fillStyle = bark ? '#3a0d0d' : '#ff7a9a'; rrect(c, x + 2.6, y + 2.6, 2.6, bark ? 1.8 : 1.2, 0.5); c.fill();
  }
  // screen eye
  rrect(c, x - 1.6, y - 2.6, 3.8, 3, 1); c.fillStyle = '#16303a'; c.fill(); c.strokeStyle = DOG_OL; c.lineWidth = 0.6; c.stroke();
  const blink = (time % 4.3) < 0.12;
  c.save(); c.shadowColor = DOG_GLOW; c.shadowBlur = 3; c.fillStyle = DOG_GLOW;
  if (blink) c.fillRect(x - 0.4, y - 1.2, 1.8, 0.4);
  else if (bark) { c.strokeStyle = DOG_GLOW; c.lineWidth = 0.6; c.beginPath(); c.arc(x + 0.5, y - 0.6, 0.9, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  else { ellipse(c, x + 0.6, y - 1.1, 0.8, 1.05); c.fill(); }
  c.restore();
  // collar with a tag
  c.fillStyle = '#d32f2f'; rrect(c, x - 3.4, y + 2.6, 4.4, 1.6, 0.6); c.fill();
  c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(x - 0.8, y + 4.7, 0.85, 0, 6.28); c.fill();
  // tiny antenna
  c.strokeStyle = DOG_OL; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - 0.5, y - 3.6); c.lineTo(x - 1.2, y - 6); c.stroke();
  c.fillStyle = '#ff5a4f'; c.beginPath(); c.arc(x - 1.2, y - 6.3, 0.75, 0, 6.28); c.fill();
}

// ------------------------------------------------------------------------------------ Sr. Valdemar
function drawValdemar(c: C, x: number, y: number, time: number, speech: { text: string; t: number } | null) {
  const rock = Math.sin(time * 1.6) * 0.09;
  groundShadow(c, x, y + 1, 12, 4, 0.4);
  c.save();
  c.translate(x, y);
  c.rotate(rock);
  // rocking chair
  c.strokeStyle = '#6d4426'; c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-11, -1); c.quadraticCurveTo(0, 3, 11, -1); c.stroke();
  c.fillStyle = lin(c, 0, -22, 0, -6, [[0, '#9b6a3e'], [1, '#6d4426']]);
  rrect(c, -8, -28, 16, 18, 2); c.fill(); c.strokeStyle = '#3e2512'; c.lineWidth = 0.6; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = -5; i <= 5; i += 3.3) { c.beginPath(); c.moveTo(i, -27); c.lineTo(i, -11); c.stroke(); }
  rrect(c, -9, -12, 18, 4, 1.5); c.fillStyle = '#8a5a32'; c.fill();
  c.strokeStyle = '#6d4426'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-8, -8); c.lineTo(-8, -1); c.moveTo(8, -8); c.lineTo(8, -1); c.stroke();
  // an old retired robot: dented teal-grey tin, rust patches, slippers on his feet (habit)
  const OLD = '#7fa39a', OLD_D = '#587a72', INK = '#2a1a10';
  const rust = (rx: number, ry: number, r: number) => { c.fillStyle = 'rgba(181,101,46,0.75)'; ellipse(c, rx, ry, r, r * 0.7, 0.4); c.fill(); c.fillStyle = 'rgba(120,60,20,0.6)'; c.beginPath(); c.arc(rx + r * 0.3, ry, r * 0.25, 0, 6.28); c.fill(); };
  // legs (pistons) + slippers
  c.fillStyle = '#5b6770'; rrect(c, -5, -11, 3.6, 8, 1.4); c.fill(); rrect(c, 1.4, -11, 3.6, 8, 1.4); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.5; rrect(c, -5, -11, 3.6, 8, 1.4); c.stroke(); rrect(c, 1.4, -11, 3.6, 8, 1.4); c.stroke();
  c.fillStyle = '#7b2d2d'; ellipse(c, -3, -2.4, 2.8, 1.4); c.fill(); ellipse(c, 3, -2.4, 2.8, 1.4); c.fill();
  // boxy torso with a cardigan "knitted" by himself
  rrect(c, -7, -24, 14, 13, 3);
  c.fillStyle = lin(c, -7, -24, 7, -11, [[0, OLD], [1, OLD_D]]); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#9fb37a'; c.beginPath(); c.moveTo(-7, -23); c.lineTo(-2.2, -23); c.lineTo(-1.2, -12); c.lineTo(-7, -12); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(7, -23); c.lineTo(2.2, -23); c.lineTo(1.2, -12); c.lineTo(7, -12); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(42,26,16,0.6)'; c.lineWidth = 0.5; c.stroke();
  rust(-4.5, -20, 1.3);
  // chest dial (his old heart)
  c.fillStyle = '#e8e2d0'; c.beginPath(); c.arc(0, -20.5, 1.7, 0, 6.28); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.5; c.stroke();
  const needle = -2.2 + Math.sin(time * 0.9) * 0.4;
  c.beginPath(); c.moveTo(0, -20.5); c.lineTo(Math.cos(needle) * 1.4, -20.5 + Math.sin(needle) * 1.4); c.stroke();
  // arms holding a newspaper
  c.fillStyle = OLD_D; rrect(c, -9, -21, 3.2, 7, 1.4); c.fill(); rrect(c, 5.8, -21, 3.2, 7, 1.4); c.fill();
  c.save(); c.translate(0, -15); c.rotate(-0.05);
  c.fillStyle = '#f2ecdc'; c.fillRect(-7, -3, 14, 7); c.strokeStyle = '#9d9480'; c.lineWidth = 0.4; c.strokeRect(-7, -3, 14, 7);
  c.fillStyle = '#333'; c.fillRect(-6, -2.2, 6, 1); c.fillStyle = 'rgba(40,40,40,0.5)'; for (let i = 0; i < 3; i++) c.fillRect(-6, -0.4 + i * 1.2, 12, 0.4);
  c.restore();
  // clamp hands
  c.fillStyle = '#9fb0b8'; c.beginPath(); c.arc(-7, -14, 1.7, 0, 6.28); c.arc(7, -14, 1.7, 0, 6.28); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.arc(-7, -14, 1.7, 0, 6.28); c.stroke(); c.beginPath(); c.arc(7, -14, 1.7, 0, 6.28); c.stroke();
  // neck spring
  c.strokeStyle = '#5b6770'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-1.8, -24.2 - i * 0.9); c.lineTo(1.8, -24.6 - i * 0.9); c.stroke(); }
  // dented square head, tilted with age
  const hy = -31;
  c.save(); c.translate(0, hy); c.rotate(-0.08 + Math.sin(time * 0.7) * 0.03);
  rrect(c, -6.4, -5.2, 12.8, 10, 2.6); c.fillStyle = lin(c, 0, -5, 0, 5, [[0, '#9cc0b6'], [1, OLD_D]]); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  rust(4, -3.4, 1.2);
  // bent antenna with a weak bulb
  c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-2, -5.2); c.lineTo(-2.4, -8.4); c.lineTo(0.8, -10); c.stroke();
  c.fillStyle = Math.sin(time * 1.3) > 0.6 ? '#ffd54f' : '#8a7a3a'; c.beginPath(); c.arc(1.1, -10.3, 1, 0, 6.28); c.fill(); c.lineWidth = 0.5; c.stroke();
  // eyes: big amber monocle lens + a tired small one
  c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(-2.4, -0.8, 2.4, 0, 6.28); c.fill();
  c.strokeStyle = '#d4a017'; c.lineWidth = 0.8; c.stroke();
  c.save(); c.shadowColor = '#ffb347'; c.shadowBlur = 3; c.fillStyle = '#ffb347';
  c.beginPath(); c.arc(-2.4, -0.8, 1.1, 0, 6.28); c.fill();
  const doze = Math.sin(time * 0.35) > 0.9;
  if (doze) c.fillRect(1.6, -0.9, 2.6, 0.5); else { c.beginPath(); c.arc(2.9, -0.8, 0.8, 0, 6.28); c.fill(); }
  c.restore();
  c.strokeStyle = '#d4a017'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-4.6, 0.4); c.quadraticCurveTo(-6, 3, -5.2, 5.4); c.stroke();
  // steel-brush mustache
  c.fillStyle = '#efefef'; c.beginPath(); c.moveTo(-4.4, 2.8); c.quadraticCurveTo(-2, 1, 0, 2); c.quadraticCurveTo(2, 1, 4.4, 2.8); c.quadraticCurveTo(2, 3.6, 0, 2.9); c.quadraticCurveTo(-2, 3.6, -4.4, 2.8); c.fill();
  c.strokeStyle = 'rgba(120,120,120,0.7)'; c.lineWidth = 0.3; for (let i = -3; i <= 3; i += 1.2) { c.beginPath(); c.moveTo(i, 2.2); c.lineTo(i * 1.05, 3.2); c.stroke(); }
  // bolts on the sides
  c.fillStyle = '#5b6770'; rrect(c, -7.6, -1.8, 1.4, 3, 0.5); c.fill(); rrect(c, 6.2, -1.8, 1.4, 3, 0.5); c.fill();
  c.restore();
  c.restore();
  // oil cup on the floor next to the chair
  c.fillStyle = '#e8e2d0'; rrect(c, x - 15.5, y - 4.6, 3.6, 4, 0.8); c.fill(); c.strokeStyle = '#2a1a10'; c.lineWidth = 0.5; c.stroke();
  c.fillStyle = '#3b2a12'; c.fillRect(x - 15, y - 4.2, 2.6, 0.9);
  c.beginPath(); c.arc(x - 11.7, y - 2.6, 1, -1.4, 1.4); c.stroke();
  // a giant wrench as a walking cane, leaning on the chair
  c.lineCap = 'round';
  c.strokeStyle = '#2a1a10'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + 11, y - 1); c.lineTo(x + 13.4, y - 19); c.stroke();
  c.strokeStyle = '#9fb0b8'; c.lineWidth = 1.2; c.stroke();
  c.save(); c.translate(x + 13.6, y - 21); c.rotate(0.13);
  c.fillStyle = '#9fb0b8'; c.strokeStyle = '#2a1a10'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(-2.6, 2); c.lineTo(-2.8, -2.6); c.lineTo(-1, -2.6); c.lineTo(-0.9, -0.4); c.lineTo(0.9, -0.4); c.lineTo(1, -2.6); c.lineTo(2.8, -2.6); c.lineTo(2.6, 2); c.closePath(); c.fill(); c.stroke();
  c.restore();
  // speech bubble
  if (speech) {
    const alpha = Math.min(1, speech.t * 2, (6 - speech.t) * 4);
    const txt = speech.text.length > 46 ? speech.text.slice(0, 44).trimEnd() + '…' : speech.text;
    c.save();
    c.globalAlpha = alpha;
    c.font = '800 7px "Nunito", system-ui';
    const w = Math.min(150, c.measureText(txt).width + 12);
    const lines = wrap(c, txt, w - 10);
    const h = lines.length * 8.5 + 7;
    const bx = x - w / 2 + 6, by = y - 52 - h + Math.sin(time * 2) * 1;
    c.fillStyle = 'rgba(0,0,0,0.25)'; rrect(c, bx + 1.5, by + 2, w, h, 5); c.fill();
    c.fillStyle = '#fffaf0'; rrect(c, bx, by, w, h, 5); c.fill();
    c.beginPath(); c.moveTo(x - 2, by + h); c.lineTo(x + 3, by + h); c.lineTo(x - 3, by + h + 6); c.closePath(); c.fill();
    c.strokeStyle = '#3b2306'; c.lineWidth = 0.7; rrect(c, bx, by, w, h, 5); c.stroke();
    c.fillStyle = '#2b1d0e'; c.textAlign = 'left'; c.textBaseline = 'top';
    lines.forEach((ln, i) => c.fillText(ln, bx + 5, by + 4 + i * 8.5));
    c.restore();
  } else if (Math.sin(time * 0.35) > 0.97) {
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = '800 8px system-ui'; c.textAlign = 'center'; c.fillText('Zzz', x + 8, y - 44 - (time % 2) * 3);
  }
}

function wrap(c: C, text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export { valueNoise, WORLD_TILES };

// ------------------------------------------------------------------------------------ Glubs & sky jellies
const GLUB_COLS = ['#5eead4', '#f9a8d4', '#bef264', '#c4b5fd', '#fde68a'];

export function drawGlub(c: C, gl: { x: number; y: number; hop: number; col: number; face: number; emote: number; s: number }, time: number) {
  const col = GLUB_COLS[gl.col % GLUB_COLS.length];
  const z = Math.max(0, Math.sin(gl.hop)) * 5;
  const squash = z > 0.5 ? 0.92 : 1.08 + Math.sin(time * 3 + gl.col) * 0.04;
  const s = gl.s;
  c.save();
  c.translate(gl.x, gl.y);
  c.scale(s, s);
  c.fillStyle = 'rgba(20,10,40,0.28)'; ellipse(c, 0, 0.5, 5.5 - z * 0.25, 2); c.fill();
  c.translate(0, -z);
  c.scale(1 / squash, squash);
  // glow
  c.fillStyle = rad(c, 0, -4, 0, 9, [[0, hexA(col, 0.22)], [1, hexA(col, 0)]]);
  c.beginPath(); c.arc(0, -4, 9, 0, 6.28); c.fill();
  // body: jelly drop with a flat-ish bottom
  const body = () => { c.beginPath(); c.moveTo(-5.2, 0); c.bezierCurveTo(-6, -6, -3, -9.5, 0, -9.5); c.bezierCurveTo(3, -9.5, 6, -6, 5.2, 0); c.quadraticCurveTo(0, 1.4, -5.2, 0); c.closePath(); };
  body();
  c.fillStyle = rad(c, -1.5, -6, 0.5, 9, [[0, '#ffffff'], [0.3, col], [1, shadeHex(col, -0.35)]]);
  c.fill();
  c.strokeStyle = '#2a1a10'; c.lineWidth = 0.8; c.stroke();
  // antenna
  c.strokeStyle = '#2a1a10'; c.lineWidth = 0.7;
  const wob = Math.sin(time * 5 + gl.col) * 0.8;
  c.beginPath(); c.moveTo(0.5, -9.3); c.quadraticCurveTo(1 + wob, -12, 2 + wob, -12.6); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(2 + wob, -12.8, 1.1, 0, 6.28); c.fill(); c.stroke();
  // face
  const ex = gl.face * 0.9;
  const blink = (time * 0.7 + gl.col * 0.37) % 4 < 0.12;
  c.fillStyle = '#2a1a10';
  if (blink) { c.fillRect(ex - 2.6, -5.2, 1.6, 0.5); c.fillRect(ex + 1, -5.2, 1.6, 0.5); }
  else {
    c.beginPath(); c.ellipse(ex - 1.8, -5.2, 0.9, 1.2, 0, 0, 6.28); c.ellipse(ex + 1.8, -5.2, 0.9, 1.2, 0, 0, 6.28); c.fill();
    c.fillStyle = '#fff'; c.fillRect(ex - 2.1, -5.9, 0.5, 0.5); c.fillRect(ex + 1.5, -5.9, 0.5, 0.5);
  }
  c.fillStyle = 'rgba(244,114,182,0.55)'; ellipse(c, ex - 3.2, -3.6, 1, 0.6); c.fill(); ellipse(c, ex + 3.2, -3.6, 1, 0.6); c.fill();
  c.strokeStyle = '#2a1a10'; c.lineWidth = 0.5; c.beginPath(); c.arc(ex, -4, 0.9, 0.2, Math.PI - 0.2); c.stroke();
  // shine
  c.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(c, -2.6, -7, 1.2, 0.7, -0.6); c.fill();
  c.restore();
  if (gl.emote > 0) {
    // little heart above the head
    const a = Math.min(1, gl.emote);
    c.save(); c.globalAlpha = a; c.translate(gl.x, gl.y - 16 * s - z - (1 - a) * 6);
    c.fillStyle = '#fb7185'; c.strokeStyle = '#2a1a10'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(-4, -1, -2, -4.5, 0, -2.2); c.bezierCurveTo(2, -4.5, 4, -1, 0, 2); c.fill(); c.stroke();
    c.restore();
  }
}

function drawSkyJelly(c: C, x: number, y: number, time: number, phase: number, pulse: number) {
  const col = ['#f0abfc', '#a5f3fc', '#fde68a', '#c4b5fd'][Math.floor(phase * 10) % 4];
  c.save(); c.translate(x, y);
  c.globalAlpha = 0.85;
  c.fillStyle = rad(c, 0, -2, 0, 22, [[0, hexA(col, 0.35)], [1, hexA(col, 0)]]);
  c.beginPath(); c.arc(0, -2, 22, 0, 6.28); c.fill();
  // tentacles
  c.strokeStyle = hexA(col, 0.8); c.lineWidth = 1.1; c.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    c.beginPath(); c.moveTo(k * 3, 2);
    for (let j = 1; j <= 4; j++) c.lineTo(k * 3 + Math.sin(time * 2 + j + k + phase) * 2, 2 + j * 4 + pulse);
    c.stroke();
  }
  // bell
  const w = 10 + pulse * 1.2, h = 8 - pulse;
  c.beginPath(); c.moveTo(-w, 2); c.bezierCurveTo(-w, -h * 1.4, w, -h * 1.4, w, 2); c.quadraticCurveTo(0, 4, -w, 2); c.closePath();
  c.fillStyle = rad(c, -3, -5, 1, 14, [[0, '#ffffff'], [0.35, hexA(col, 0.95)], [1, hexA(shadeHex(col, -0.3), 0.9)]]);
  c.fill();
  c.strokeStyle = '#2a1a10'; c.lineWidth = 1; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(c, -4, -4, 2.4, 1.2, -0.4); c.fill();
  c.restore();
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function shadeHex(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
