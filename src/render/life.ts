import { CENTER, TILE, WORLD_PX, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { hash2, valueNoise } from '../core/rng';
import { Game } from '../game/Game';
import { Effects } from './Effects';
import { ellipse, groundShadow, lin, makeCanvas, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;
type View = { x0: number; y0: number; x1: number; y1: number };

interface Dog { x: number; y: number; tx: number; ty: number; vx: number; state: 'follow' | 'wander' | 'sit' | 'sniff'; t: number; face: number; walk: number; bark: number }
interface Bird { a: number; r: number; speed: number; h: number; phase: number }
interface Cloud { x: number; y: number; s: number }

export const VALDEMAR = { x: (CENTER - 3.4) * TILE, y: (CENTER + 2.7) * TILE };

/** Ambient life: NPCs, animals, clouds and small decorative animation. Purely visual. */
export class Life {
  dog: Dog;
  birds: Bird[] = [];
  birdCenter = { x: 0, y: 0 };
  private birdT = 0;
  clouds: Cloud[] = [];
  private cloudSprite: HTMLCanvasElement;
  private stepPhase = 0;
  speech: { text: string; t: number } | null = null;

  constructor(private game: Game, private fx: Effects) {
    const p = game.player;
    this.dog = { x: p.x - 30, y: p.y + 10, tx: p.x, ty: p.y, vx: 0, state: 'wander', t: 2, face: 1, walk: 0, bark: 0 };
    for (let i = 0; i < 5; i++) this.birds.push({ a: Math.random() * 6.28, r: 60 + Math.random() * 90, speed: 0.25 + Math.random() * 0.2, h: 60 + Math.random() * 50, phase: Math.random() * 6 });
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
      c.fillStyle = rad(c, x, y, 0, r, [[0, 'rgba(15,20,40,0.5)'], [1, 'rgba(15,20,40,0)']]);
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
    if (this.speech) { this.speech.t -= dt; if (this.speech.t <= 0) this.speech = null; }
    void time;
  }

  /** y-sortable objects */
  objects(view: View, time: number): { y: number; d: (c: C) => void }[] {
    const out: { y: number; d: (c: C) => void }[] = [];
    const inV = (x: number, y: number) => x > view.x0 - 60 && x < view.x1 + 60 && y > view.y0 - 60 && y < view.y1 + 80;
    const d = this.dog;
    if (inV(d.x, d.y)) out.push({ y: d.y, d: (c) => drawDog(c, d, time) });
    if (inV(VALDEMAR.x, VALDEMAR.y)) out.push({ y: VALDEMAR.y, d: (c) => drawValdemar(c, VALDEMAR.x, VALDEMAR.y, time, this.speech) });
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
        // fly swarm
        const cx = (tx + 0.5) * TILE, cy = (ty + 0.3) * TILE;
        if (cx < view.x0 || cx > view.x1 || cy < view.y0 || cy > view.y1) continue;
        for (let k = 0; k < 5; k++) {
          const t = time * (2.2 + k * 0.4) + k * 1.7 + h * 50;
          const fx = cx + Math.sin(t) * (5 + k * 1.4) + Math.sin(t * 2.7) * 2;
          const fy = cy + Math.cos(t * 1.3) * (3 + k) - 6 + Math.sin(t * 3.1) * 1.5;
          c.fillStyle = 'rgba(15,15,15,0.85)'; c.fillRect(fx - 0.6, fy - 0.5, 1.2, 1);
          c.fillStyle = 'rgba(220,230,255,0.45)'; c.fillRect(fx - 1, fy - 1.2 + (Math.sin(time * 60 + k) > 0 ? 0 : 0.4), 0.8, 0.6); c.fillRect(fx + 0.3, fy - 1.2, 0.8, 0.6);
        }
      } else if (gv === 0 && h > 0.965 && w.ground[i] !== 3) {
        // butterfly over clean ground
        const t = time * 0.6 + h * 40;
        const bx = (tx + 0.5) * TILE + Math.sin(t) * 26 + Math.sin(t * 2.3) * 8;
        const by = (ty + 0.5) * TILE + Math.cos(t * 0.8) * 18 - 10;
        if (bx < view.x0 || bx > view.x1 || by < view.y0 || by > view.y1) continue;
        const flap = Math.abs(Math.sin(time * 14 + h * 9));
        const col = ['#fbbf24', '#f472b6', '#60a5fa', '#ffffff'][Math.floor(h * 1000) % 4];
        c.fillStyle = 'rgba(0,0,0,0.18)'; ellipse(c, bx + 3, by + 14, 2.5, 1); c.fill();
        c.fillStyle = col;
        ellipse(c, bx - 1.6 * flap, by, 1.8 * flap + 0.3, 2.2); c.fill();
        ellipse(c, bx + 1.6 * flap, by, 1.8 * flap + 0.3, 2.2); c.fill();
        c.fillStyle = '#222'; c.fillRect(bx - 0.3, by - 1.6, 0.6, 3.2);
      }
    }
  }

  /** Clouds and birds, above everything in the world. */
  drawSky(c: C, view: View, time: number) {
    // birds + shadows
    const bc = this.birdCenter;
    for (const b of this.birds) {
      const x = bc.x + Math.cos(b.a) * b.r, y = bc.y + Math.sin(b.a) * b.r * 0.6;
      if (x < view.x0 - 200 || x > view.x1 + 200 || y < view.y0 - 200 || y > view.y1 + 200) continue;
      const flap = Math.sin(time * 7 + b.phase);
      const ang = b.a + Math.PI / 2;
      // shadow on the ground
      c.save(); c.translate(x + 30, y + b.h * 0.6); c.rotate(ang); c.fillStyle = 'rgba(0,0,0,0.18)';
      c.beginPath(); c.moveTo(-9, flap * 1.5); c.quadraticCurveTo(-4, -2, 0, 0); c.quadraticCurveTo(4, -2, 9, flap * 1.5); c.lineTo(0, 2); c.closePath(); c.fill();
      c.restore();
      c.save(); c.translate(x, y - b.h); c.rotate(ang);
      c.fillStyle = '#1b1612';
      c.beginPath(); c.moveTo(-10, flap * 3); c.quadraticCurveTo(-5, -3 + flap, 0, -0.5); c.quadraticCurveTo(5, -3 + flap, 10, flap * 3); c.quadraticCurveTo(4, 0.8, 0, 2.2); c.quadraticCurveTo(-4, 0.8, -10, flap * 3); c.fill();
      c.fillStyle = '#b94a3a'; c.beginPath(); c.arc(0, -1.8, 1, 0, 6.28); c.fill();
      c.restore();
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

// ------------------------------------------------------------------------------------ dog
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
  const FUR = '#a8713f', FUR_D = '#6e4524', WHITE = '#f3ead8';
  if (d.state === 'sit') {
    // sitting pose
    const wag = Math.sin(time * 14) * 0.6;
    c.save(); c.translate(-5, -4); c.rotate(-1 + wag); c.strokeStyle = FUR; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-4, -2, -6, -6); c.stroke(); c.restore();
    ellipse(c, -1, -5, 6, 5); c.fillStyle = lin(c, 0, -10, 0, 0, [[0, shade(FUR, 0.2)], [1, FUR_D]]); c.fill();
    ellipse(c, 2.5, -6, 3, 4.2); c.fillStyle = WHITE; c.fill();
    c.fillStyle = FUR_D; c.fillRect(1, -2, 2, 2.2); c.fillRect(3.6, -2, 2, 2.2);
    drawDogHead(c, 3.5, -12, time, false, d.bark > 0);
  } else {
    const legSwing = moving ? Math.sin(ph) * (run ? 3.2 : 2) : 0;
    c.strokeStyle = FUR_D; c.lineWidth = 1.8; c.lineCap = 'round';
    for (const [lx, s] of [[-4.5, 1], [-3, -1], [3.5, -1], [5, 1]] as [number, number][]) { c.beginPath(); c.moveTo(lx, -5); c.lineTo(lx + legSwing * s, -0.6); c.stroke(); }
    // tail
    const wag = Math.sin(time * (run ? 10 : 16)) * 0.5;
    c.save(); c.translate(-7, -7); c.rotate(-0.5 + wag); c.strokeStyle = FUR; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-3, -1, -5, -5); c.stroke(); c.restore();
    // body
    ellipse(c, 0, -7, 8, 4.2); c.fillStyle = lin(c, 0, -11, 0, -3, [[0, shade(FUR, 0.25)], [1, FUR_D]]); c.fill();
    c.strokeStyle = shade(FUR_D, -0.4); c.lineWidth = 0.5; c.stroke();
    ellipse(c, -2, -8.5, 3, 1.8); c.fillStyle = WHITE; c.fill();
    ellipse(c, 4.5, -6, 3.2, 2.6); c.fillStyle = WHITE; c.fill();
    const sniff = d.state === 'sniff' ? 3 + Math.sin(time * 12) * 0.5 : 0;
    drawDogHead(c, 7.5, -10 + sniff, time, moving && run, d.bark > 0);
  }
  c.restore();
}

function drawDogHead(c: C, x: number, y: number, time: number, panting: boolean, bark: boolean) {
  const FUR = '#a8713f', FUR_D = '#6e4524';
  // collar
  c.fillStyle = '#d32f2f'; rrect(c, x - 3, y + 2.6, 4, 1.6, 0.6); c.fill();
  c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(x - 0.6, y + 4.6, 0.8, 0, 6.28); c.fill();
  // head
  ellipse(c, x, y, 3.8, 3.4); c.fillStyle = rad(c, x - 1, y - 1, 0, 4.5, [[0, shade(FUR, 0.3)], [1, FUR]]); c.fill();
  // snout
  ellipse(c, x + 3.2, y + 1, 2.4, 1.6); c.fillStyle = '#f3ead8'; c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x + 5.2, y + 0.4, 0.8, 0, 6.28); c.fill();
  if (panting || bark) { c.fillStyle = bark ? '#3a0d0d' : '#e57373'; ellipse(c, x + 3.6, y + 2.6, 1.2, bark ? 1.2 : 0.8); c.fill(); }
  // eye
  const blink = (time % 4.3) < 0.12;
  if (blink) { c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 0.4, y - 0.8); c.lineTo(x + 1.8, y - 0.8); c.stroke(); }
  else { c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x + 1.2, y - 0.8, 0.75, 0, 6.28); c.fill(); c.fillStyle = '#fff'; c.fillRect(x + 1.3, y - 1.3, 0.3, 0.3); }
  // floppy ear
  const flop = Math.sin(time * 6) * 0.2;
  c.save(); c.translate(x - 1.5, y - 2.4); c.rotate(0.5 + flop);
  ellipse(c, 0, 2, 1.6, 3); c.fillStyle = FUR_D; c.fill();
  c.restore();
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
  // legs + slippers
  c.fillStyle = '#5b5f6b'; rrect(c, -5, -11, 4, 8, 1.5); c.fill(); rrect(c, 1, -11, 4, 8, 1.5); c.fill();
  c.fillStyle = '#7b2d2d'; ellipse(c, -3, -2.4, 2.8, 1.4); c.fill(); ellipse(c, 3, -2.4, 2.8, 1.4); c.fill();
  // body (cardigan)
  rrect(c, -7, -24, 14, 13, 4);
  c.fillStyle = lin(c, -7, -24, 7, -11, [[0, '#9fb37a'], [1, '#5f7344']]); c.fill(); c.strokeStyle = '#3b4728'; c.lineWidth = 0.6; c.stroke();
  c.fillStyle = '#e8e2d0'; c.beginPath(); c.moveTo(-2, -24); c.lineTo(0, -18); c.lineTo(2, -24); c.fill();
  c.fillStyle = '#d4c49a'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -17 + i * 2.6, 0.5, 0, 6.28); c.fill(); }
  // arms holding a newspaper
  c.fillStyle = '#7f935d'; rrect(c, -9, -21, 3.4, 7, 1.5); c.fill(); rrect(c, 5.6, -21, 3.4, 7, 1.5); c.fill();
  c.save(); c.translate(0, -15); c.rotate(-0.05);
  c.fillStyle = '#f2ecdc'; c.fillRect(-7, -3, 14, 7); c.strokeStyle = '#9d9480'; c.lineWidth = 0.4; c.strokeRect(-7, -3, 14, 7);
  c.fillStyle = '#333'; c.fillRect(-6, -2.2, 6, 1); c.fillStyle = 'rgba(40,40,40,0.5)'; for (let i = 0; i < 3; i++) c.fillRect(-6, -0.4 + i * 1.2, 12, 0.4);
  c.restore();
  c.fillStyle = '#e0a878'; c.beginPath(); c.arc(-7, -14, 1.6, 0, 6.28); c.arc(7, -14, 1.6, 0, 6.28); c.fill();
  // head
  const hy = -30;
  c.beginPath(); c.arc(0, hy, 5.6, 0, 6.28);
  c.fillStyle = rad(c, -1.5, hy - 2, 0, 6.5, [[0, '#f2c49c'], [1, '#c98d62']]); c.fill();
  c.strokeStyle = '#8a5a3a'; c.lineWidth = 0.5; c.stroke();
  // white hair sides + bald shine
  c.fillStyle = '#f2f2f2'; ellipse(c, -5.2, hy + 0.5, 1.8, 3); c.fill(); ellipse(c, 5.2, hy + 0.5, 1.8, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(c, -1.6, hy - 3.4, 1.8, 0.9); c.fill();
  // glasses
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.6;
  c.beginPath(); c.arc(-2.1, hy + 0.4, 1.6, 0, 6.28); c.stroke(); c.beginPath(); c.arc(2.1, hy + 0.4, 1.6, 0, 6.28); c.stroke();
  c.beginPath(); c.moveTo(-0.5, hy + 0.4); c.lineTo(0.5, hy + 0.4); c.stroke();
  c.fillStyle = '#2b1d14'; c.beginPath(); c.arc(-2.1, hy + 0.6, 0.55, 0, 6.28); c.arc(2.1, hy + 0.6, 0.55, 0, 6.28); c.fill();
  // big mustache
  c.fillStyle = '#efefef'; c.beginPath(); c.moveTo(-4.4, hy + 3.8); c.quadraticCurveTo(-2, hy + 2, 0, hy + 3); c.quadraticCurveTo(2, hy + 2, 4.4, hy + 3.8); c.quadraticCurveTo(2, hy + 4.6, 0, hy + 3.9); c.quadraticCurveTo(-2, hy + 4.6, -4.4, hy + 3.8); c.fill();
  // cane leaning on chair
  c.restore();
  c.strokeStyle = '#4a2c16'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x + 11, y - 1); c.lineTo(x + 13, y - 20); c.quadraticCurveTo(x + 13.5, y - 23, x + 16, y - 21.5); c.stroke();
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
