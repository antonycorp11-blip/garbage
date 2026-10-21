import { TILE } from '../core/constants';
import { Game } from '../game/Game';
import { ellipse, groundShadow, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const OL = '#2a1a10';
// BIP, the modular salvage robot: cream shell, orange accents, teal glows
const SHELL = '#f6ecd9', SHELL_SH = '#d6c09c', SHELL_HI = '#fffaf0';
const ORANGE = '#ff8a3d', ORANGE_SH = '#cf5d26';
const TEAL = '#2bb5a8', TEAL_SH = '#1b7f78';
const METAL = '#aab7c1', METAL_SH = '#6f808d';
const DARK = '#3b4651', DARK_SH = '#232b32';
const SCREEN = '#11232c', GLOW = '#6ff6ff';
const MAT_COLS = ['#f472b6', '#93c5fd', '#86efac', '#fb923c', '#22d3ee', '#c084fc'];

type PathFn = () => void;
/** Cartoon cel-shaded part: base fill, shadow clipped inside, dark outline. */
function cel(c: C, path: PathFn, base: string, shadow: string | null, shadowShape: PathFn | null, lw = 1.1) {
  path(); c.fillStyle = base; c.fill();
  if (shadow && shadowShape) { c.save(); path(); c.clip(); shadowShape(); c.fillStyle = shadow; c.fill(); c.restore(); }
  path(); c.strokeStyle = OL; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke();
}
const rr = (c: C, x: number, y: number, w: number, h: number, r: number) => () => rrect(c, x, y, w, h, r);
const circ = (c: C, x: number, y: number, r: number) => () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const ell = (c: C, x: number, y: number, rx: number, ry: number) => () => ellipse(c, x, y, rx, ry);
/** Thick outlined stroke (pipes, legs, hoses). */
function tube(c: C, pts: number[], w: number, col: string) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = OL; c.lineWidth = w + 1.5; c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}
function glow(c: C, x: number, y: number, r: number, col: string, a: number) {
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = rad(c, x, y, 0, r, [[0, shade(col, 0, a)], [1, shade(col, 0, 0)]]);
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  c.restore();
}

let lastActive = 0;
/** Draws BIP at its ground contact point. Fully procedural, animated, assembled from its modules. */
export function drawPlayer(c: C, g: Game, time: number) {
  const p = g.player;
  if (p.moving || p.collecting || p.action > 0 || lastActive > time) lastActive = time;
  drawWorker(c, p.x, p.y, time, {
    facing: p.facing, moving: p.moving, walk: p.walk, action: p.action, tier: g.toolTier,
    bagLvl: g.upgrades.c_bag || 0, fill: g.d.capacity ? p.carried / g.d.capacity : 0, crown: !!g.flags.crown,
    happy: p.collecting, loadout: g.loadout, idle: time - lastActive,
  });
}

export interface WorkerPose {
  facing: string; moving: boolean; walk: number; action: number; tier: number; bagLvl: number; fill: number; crown: boolean;
  happy?: boolean; loadout?: { move: string; tank: string; sensor: string };
  /** seconds without doing anything (BIP dozes off) */
  idle?: number;
}

type Mood = 'idle' | 'happy' | 'focus' | 'worried' | 'sleepy';

export function drawWorker(c: C, x: number, y: number, time: number, o: WorkerPose) {
  const lo = o.loadout ?? { move: 'wheel', tank: 'tank', sensor: 'eye' };
  const dir = o.facing;
  const side = dir === 'left' || dir === 'right';
  const back = dir === 'up';
  const walk = o.moving ? o.walk : 0;
  const k = o.action > 0 ? Math.sin(o.action * Math.PI) : 0;
  const fill = Math.max(0, Math.min(1, o.fill));
  const full = o.fill >= 1;
  const mood: Mood = full ? 'worried' : k > 0.3 ? 'happy' : o.happy ? 'focus' : (o.idle ?? 0) > 9 && !o.moving ? 'sleepy' : 'idle';
  const move = lo.move;
  const hover = move === 'hover';
  const tS = 1 + Math.min(0.45, o.bagLvl * 0.035);

  // ride height: where the bottom of the pod sits
  const H = move === 'treads' ? 7 : move === 'legs' ? 9.5 : hover ? 11 + Math.sin(time * 3) * 1.1 : 8.6;
  const bob = hover ? 0 : o.moving ? Math.abs(Math.sin(walk)) * (move === 'legs' ? 0.9 : 0.6) : Math.sin(time * 2.4) * 0.35;
  const sq = hover ? Math.sin(time * 3 + 1) * 0.015 : o.moving ? Math.cos(walk * 2) * 0.035 : Math.sin(time * 2.4) * 0.02;
  const PW = side ? 20 : 22, PH = 16.5;
  const podY = -H - bob;
  const top = podY - PH;

  // ------------------------------------------------------------------ ground: shadow, dust, glows
  const S = 1.45;
  const shR = (move === 'legs' ? 15 : move === 'treads' ? 13.5 : hover ? 9 : 11) * S / 1.22;
  groundShadow(c, x, y + 0.5, shR, shR * 0.38, hover ? 0.24 + Math.sin(time * 3) * 0.04 : 0.42);
  if (o.tier >= 6) glow(c, x, y - 22, 36, '#00e5ff', 0.2);
  if (hover) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(80,240,255,0.18)'; ellipse(c, x, y, 12, 4); c.fill();
    c.restore();
  }
  if (o.moving && (move === 'wheel' || move === 'treads')) {
    const bk = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    for (let i = 0; i < 3; i++) {
      const t = (walk * 0.35 + i / 3) % 1;
      const px = x + bk * (7 + t * 10) + (bk === 0 ? (i - 1) * 5 * t : 0);
      const py = y - 1 - t * 4 + (dir === 'up' ? -2 : dir === 'down' ? 2 * t : 0);
      c.fillStyle = `rgba(214,190,170,${0.4 * (1 - t)})`;
      c.beginPath(); c.arc(px, py, 1.4 + t * 2.6, 0, 6.28); c.fill();
    }
  }

  c.save();
  c.translate(x, y);
  c.scale(S * (dir === 'left' ? -1 : 1), S);

  // ================================================================== locomotion
  const wheel = () => {
    if (side) {
      const cy = -4.4, r = 4.4;
      // fork strut to the pod
      tube(c, [0, cy, -2.5, podY + 1.5], 2.2, TEAL);
      cel(c, circ(c, 0, cy, r), DARK, DARK_SH, circ(c, 1.3, cy + 1.3, r - 0.6), 1.2);
      c.strokeStyle = '#59646e'; c.lineWidth = 0.9;
      for (let i = 0; i < 8; i++) { const a = walk * 1.3 + i * 0.785; c.beginPath(); c.moveTo(Math.cos(a) * (r - 1.1), cy + Math.sin(a) * (r - 1.1)); c.lineTo(Math.cos(a) * (r - 0.2), cy + Math.sin(a) * (r - 0.2)); c.stroke(); }
      cel(c, circ(c, 0, cy, 2.1), METAL, null, null, 0.9);
      c.strokeStyle = OL; c.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) { const a = walk * 1.3 + i * 2.094; c.beginPath(); c.moveTo(0, cy); c.lineTo(Math.cos(a) * 2, cy + Math.sin(a) * 2); c.stroke(); }
      cel(c, circ(c, 0, cy, 0.9), ORANGE, null, null, 0.6);
      // fender
      c.strokeStyle = OL; c.lineWidth = 2.6; c.beginPath(); c.arc(0, cy, r + 1.3, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      c.strokeStyle = SHELL; c.lineWidth = 1.4; c.stroke();
    } else {
      tube(c, [-3.8, -4.4, -4.6, podY + 1.5], 2, TEAL);
      tube(c, [3.8, -4.4, 4.6, podY + 1.5], 2, TEAL);
      cel(c, rr(c, -3, -8.8, 6, 8.8, 2.8), DARK, DARK_SH, rr(c, 0.8, -8.8, 3, 8.8, 1.2), 1.2);
      c.fillStyle = '#5c6873';
      for (let i = 0; i < 3; i++) { const ty = -8 + ((walk * 1.8 + i * 2.6) % 7.6); c.fillRect(-2.2, ty, 4.4, 0.8); }
      for (const sx of [-1, 1]) cel(c, circ(c, sx * 3.9, -4.4, 1.5), METAL, null, null, 0.8);
    }
  };

  const treads = (layer: 'back' | 'front') => {
    if (side) {
      if (layer === 'back') return;
      const off = (walk * 2.2) % 2.6;
      cel(c, rr(c, -11, -7, 22, 7, 3.4), DARK, DARK_SH, rr(c, -11, -3, 22, 4, 2), 1.2);
      // lugs running along the belt
      c.fillStyle = '#5c6873';
      for (let i = -1; i < 9; i++) { const lx = -10 + i * 2.6 + off; if (lx > -10.5 && lx < 9.8) { c.fillRect(lx, -7, 1.1, 1.1); c.fillRect(-lx - 1.1, -1.2, 1.1, 1.1); } }
      for (const wx of [-6.6, 0, 6.6]) {
        cel(c, circ(c, wx, -3.5, 2), METAL, null, null, 0.8);
        c.strokeStyle = OL; c.lineWidth = 0.6; const a = walk * 1.6;
        c.beginPath(); c.moveTo(wx + Math.cos(a) * 1.8, -3.5 + Math.sin(a) * 1.8); c.lineTo(wx - Math.cos(a) * 1.8, -3.5 - Math.sin(a) * 1.8); c.stroke();
      }
      cel(c, rr(c, -8.5, -8.3, 17, 2.4, 1), ORANGE, ORANGE_SH, rr(c, -8.5, -7.2, 17, 1.3, 0.6), 1);
    } else {
      if (layer === 'back') {
        cel(c, rr(c, -5.2, -5.6, 10.4, 3, 1), METAL_SH, null, null, 1);
        return;
      }
      for (const cx of [-7, 7]) {
        cel(c, rr(c, cx - 2.8, -7, 5.6, 7, 2), DARK, DARK_SH, rr(c, cx + 0.6, -7, 2.2, 7, 1), 1.15);
        c.fillStyle = '#5c6873';
        for (let i = 0; i < 3; i++) { const ty = -6.4 + ((walk * 1.8 + i * 2.2) % 6.4); c.fillRect(cx - 2, ty, 4, 0.8); }
        cel(c, rr(c, cx - 3.2, -8, 6.4, 2, 0.8), ORANGE, null, null, 0.9);
      }
    }
  };

  const legs = (layer: 'back' | 'front') => {
    const lift = (ph: number) => (o.moving ? Math.max(0, Math.sin(walk * 1.1 + ph)) * 2.6 : 0);
    const leg = (hx: number, hy: number, fx: number, fy: number, ph: number, far: boolean) => {
      const l = lift(ph);
      const kx = hx + (fx - hx) * 0.62, ky = Math.min(hy, fy) - 4.2 - l * 0.6;
      tube(c, [hx, hy, kx, ky, fx, fy - l], far ? 1.5 : 1.8, far ? METAL_SH : METAL);
      cel(c, circ(c, kx, ky, far ? 1 : 1.2), far ? TEAL_SH : TEAL, null, null, 0.7);
      cel(c, circ(c, fx, fy - l - 0.2, far ? 0.9 : 1.1), far ? DARK_SH : DARK, null, null, 0.7);
    };
    const hy = podY + 1.5;
    if (side) {
      if (layer === 'back') { leg(-2, hy - 1, -8, -1.2, 0, true); leg(1, hy - 1, 2, -1.2, Math.PI, true); leg(3.5, hy - 1, 10, -1.2, 0, true); }
      else { leg(-3, hy, -10, 0, Math.PI, false); leg(0, hy, -1, 0.4, 0, false); leg(3, hy, 8.5, 0, Math.PI, false); }
    } else {
      if (layer === 'back') { leg(-4, hy - 1, -12, -2, Math.PI, true); leg(4, hy - 1, 12, -2, 0, true); }
      else {
        leg(-4.5, hy, -14.5, -0.3, 0, false); leg(4.5, hy, 14.5, -0.3, Math.PI, false);
        leg(-3.5, hy + 0.5, -9.5, 1.6, Math.PI, false); leg(3.5, hy + 0.5, 9.5, 1.6, 0, false);
      }
    }
  };

  const hoverUnit = () => {
    const jets = side ? [-5, 5] : [-6.5, 6.5];
    // thrust cones
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const jx of jets) {
      const fl = 0.75 + Math.sin(time * 23 + jx) * 0.12 + (o.moving ? 0.2 : 0);
      c.fillStyle = `rgba(90,240,255,${0.32 * fl})`;
      c.beginPath(); c.moveTo(jx - 1.6, podY + 3.2); c.lineTo(jx + 1.6, podY + 3.2); c.lineTo(jx + 3.2, -0.6); c.lineTo(jx - 3.2, -0.6); c.closePath(); c.fill();
      c.fillStyle = `rgba(220,255,255,${0.7 * fl})`; ellipse(c, jx, podY + 4.2, 1.2, 1.9 * fl); c.fill();
    }
    c.restore();
    for (const jx of jets) cel(c, rr(c, jx - 2, podY + 0.4, 4, 3.4, 1.2), METAL, METAL_SH, rr(c, jx + 0.4, podY + 0.4, 2, 3.4, 0.8), 1);
    cel(c, ell(c, 0, podY + 0.6, side ? 9 : 10, 2.6), DARK, null, null, 1.1);
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * (side ? 4.5 : 5.5);
      c.fillStyle = Math.sin(time * 6 - i) > 0 ? GLOW : '#1f8f99'; c.beginPath(); c.arc(lx, podY + 1.1, 0.75, 0, 6.28); c.fill();
    }
  };

  const loco = (layer: 'back' | 'front') => {
    if (move === 'treads') treads(layer);
    else if (move === 'legs') legs(layer);
    else if (hover) { if (layer === 'front') hoverUnit(); }
    else if (layer === 'front') wheel();
  };

  // ================================================================== upper body helpers
  const squash = (fn: () => void) => {
    c.save();
    c.translate(0, podY); c.scale(1 + sq, 1 - sq); c.translate(0, -podY);
    fn();
    c.restore();
  };

  // gumdrop pod: generous dome, slightly tucked base
  const podPath = () => {
    const w = PW / 2, b = w - 1.2;
    c.beginPath();
    c.moveTo(-b + 4, podY);
    c.lineTo(b - 4, podY);
    c.quadraticCurveTo(b, podY, b + 0.4, podY - 4);
    c.lineTo(w, top + 8);
    c.bezierCurveTo(w, top - 0.6, -w, top - 0.6, -w, top + 8);
    c.lineTo(-b - 0.4, podY - 4);
    c.quadraticCurveTo(-b, podY, -b + 4, podY);
    c.closePath();
  };
  const pod = () => {
    const path = podPath;
    cel(c, path, SHELL, SHELL_SH, () => ellipse(c, PW * 0.42, podY - 3, PW * 0.42, PH * 0.75), 1.3);
    // orange belly band + seam
    c.save(); path(); c.clip();
    c.fillStyle = ORANGE; c.fillRect(-PW / 2, podY - 5, PW, 5);
    c.fillStyle = ORANGE_SH; c.fillRect(PW * 0.14, podY - 5, PW, 5);
    c.restore();
    c.strokeStyle = OL; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-PW / 2 + 0.6, podY - 5); c.lineTo(PW / 2 - 0.6, podY - 5); c.stroke();
    path(); c.lineWidth = 1.3; c.stroke();
    // rivets on the band
    c.fillStyle = OL;
    for (let i = 0; i < 5; i++) { const rx = -PW / 2 + 3.2 + i * (PW - 6.4) / 4; c.beginPath(); c.arc(rx, podY - 2.5, 0.45, 0, 6.28); c.fill(); }
    // dome hatch seam + B1P decal
    c.strokeStyle = 'rgba(42,26,16,0.35)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-PW / 2 + 2.2, top + 4.2); c.quadraticCurveTo(0, top + 1.6, PW / 2 - 2.2, top + 4.2); c.stroke();
    if (!side && dir !== 'up') { c.fillStyle = SHELL; c.font = 'bold 2.6px sans-serif'; c.textAlign = 'center'; c.fillText('B1P', PW / 2 - 4.6, podY - 1.6); c.textAlign = 'start'; }
    // glossy highlight
    c.fillStyle = SHELL_HI; ellipse(c, -PW * 0.24, top + 2.6, PW * 0.2, 1.5, -0.12); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(-PW * 0.4, top + 4.6, 0.7, 0, 6.28); c.fill();
  };

  const face = () => {
    const sw = side ? 10.5 : 17, sh = 10.6;
    const sx = side ? PW / 2 - sw + 0.2 : -sw / 2, sy = top + 2.4;
    cel(c, rr(c, sx, sy, sw, sh, 4.2), SCREEN, null, null, 1.15);
    c.save(); rrect(c, sx, sy, sw, sh, 4.2); c.clip();
    c.fillStyle = full ? 'rgba(255,120,80,0.12)' : 'rgba(111,246,255,0.08)'; c.fillRect(sx, sy, sw, sh);
    c.fillStyle = 'rgba(111,246,255,0.06)';
    const sl = sy + ((time * 8) % (sh + 4)) - 2; c.fillRect(sx, sl, sw, 1.3);
    c.restore();
    const glance = side ? 0.8 : mood === 'idle' ? Math.sin(time * 0.6) * 1.1 : 0;
    const ex = sx + sw / 2 + glance + (side ? 0.6 : 0), ey = sy + sh / 2 + 0.2;
    const blink = mood === 'idle' && ((time % 3.6) < 0.13 || ((time + 1.7) % 8.3) < 0.1);
    c.save();
    c.shadowColor = GLOW; c.shadowBlur = 4;
    const col = GLOW;
    c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
    if (mood === 'happy') {
      c.lineWidth = 1.9; c.beginPath(); c.arc(ex, ey + 1.6, 2.6, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
    } else if (blink) {
      c.lineWidth = 1.5; c.beginPath(); c.moveTo(ex - 2.4, ey + 0.4); c.lineTo(ex + 2.4, ey + 0.4); c.stroke();
    } else if (mood === 'focus') {
      ellipse(c, ex, ey + 0.2, 2.8, 1.5); c.fill();
      c.lineWidth = 0.8; const b = 4.1 + Math.sin(time * 9) * 0.3;
      c.beginPath(); c.moveTo(ex - b + 1, ey - 2.4); c.lineTo(ex - b, ey - 2.4); c.lineTo(ex - b, ey + 2.6); c.lineTo(ex - b + 1, ey + 2.6);
      c.moveTo(ex + b - 1, ey - 2.4); c.lineTo(ex + b, ey - 2.4); c.lineTo(ex + b, ey + 2.6); c.lineTo(ex + b - 1, ey + 2.6); c.stroke();
    } else if (mood === 'sleepy') {
      c.lineWidth = 1.3; c.beginPath(); c.moveTo(ex - 2.8, ey + 0.2); c.lineTo(ex + 2.8, ey + 0.2); c.stroke();
      c.globalAlpha = 0.6; c.beginPath(); c.ellipse(ex, ey + 0.4, 2.2, 1.3, 0, 0, Math.PI); c.closePath(); c.fill(); c.globalAlpha = 1;
    } else if (mood === 'worried') {
      // wobbly round eye under a slanted brow
      const wob = Math.sin(time * 14) * 0.25;
      ellipse(c, ex + wob, ey + 1.1, 2.3, 2.6); c.fill();
      c.lineWidth = 1.1; c.beginPath(); c.moveTo(ex - 3, ey - 3.2); c.lineTo(ex + 2.6, ey - 1.9); c.stroke();
    } else {
      ellipse(c, ex, ey, 3.1, 3.8); c.fill();
    }
    c.restore();
    if (mood === 'idle' && !blink) {
      // iris ring + bright core + catchlight
      c.strokeStyle = 'rgba(17,35,44,0.55)'; c.lineWidth = 0.7; ellipse(c, ex, ey + 0.2, 2.1, 2.6); c.stroke();
      c.fillStyle = '#e6feff'; ellipse(c, ex + 0.2, ey + 0.4, 1.2, 1.5); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 1.2, ey - 1.6, 0.85, 0, 6.28); c.fill();
      c.beginPath(); c.arc(ex - 1.1, ey + 1.7, 0.4, 0, 6.28); c.fill();
    }
    if (mood === 'happy' || mood === 'focus') {
      c.fillStyle = 'rgba(255,120,170,0.6)';
      if (!side) { ellipse(c, sx + 2.6, sy + sh - 2.6, 1.4, 0.75); c.fill(); }
      ellipse(c, sx + sw - 2.4, sy + sh - 2.6, 1.4, 0.75); c.fill();
    }
    // glass glare
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.beginPath(); c.moveTo(sx + 1.6, sy + 1); c.lineTo(sx + 4, sy + 1); c.lineTo(sx + 2.2, sy + sh - 1.6); c.lineTo(sx + 0.9, sy + sh - 2.6); c.closePath(); c.fill();
    // side status lights (front view)
    if (!side) for (const lx of [-PW / 2 + 1.9, PW / 2 - 1.9]) { c.fillStyle = mood === 'worried' ? (Math.sin(time * 9) > 0 ? '#ff5a4f' : '#7a1f1a') : TEAL; c.beginPath(); c.arc(lx, top + PH * 0.48, 0.9, 0, 6.28); c.fill(); }
    if (full) {
      const t = (time * 1.3) % 1;
      c.fillStyle = `rgba(140,205,255,${1 - t})`; ellipse(c, side ? -PW / 2 + 2 : PW / 2 + 1, top + 3 + t * 6, 1, 1.5); c.fill();
    }
  };

  const backPanel = () => {
    cel(c, rr(c, -6.5, top + 4, 13, 6.4, 2), SHELL_SH, null, null, 1);
    c.fillStyle = OL;
    for (let i = 0; i < 4; i++) c.fillRect(-4.9 + i * 2.8, top + 5.3, 1.1, 3.8);
  };

  // ------------------------------------------------------------------ sensor (top)
  const sensor = () => {
    const mx = side ? -2 : 0, my = top + 0.6;
    const bulbCol = mood === 'worried' ? '#ff5a4f' : mood === 'happy' || mood === 'focus' ? '#ffe45c' : mood === 'sleepy' ? '#b69cff' : '#7dff8a';
    if (lo.sensor === 'radar') {
      tube(c, [mx, my, mx, my - 4.2], 1.4, METAL);
      const a = time * 2.4, cs = Math.cos(a), sn = Math.sin(a);
      c.save(); c.translate(mx, my - 5.4);
      const w = 5.4 * Math.max(0.18, Math.abs(cs));
      const front = sn > 0;
      // dish (an ellipse seen edge-on as it spins)
      cel(c, () => { c.beginPath(); c.ellipse(0, 0, w, 3.4, 0, 0, 6.28); }, front ? SHELL : SHELL_SH, front ? SHELL_SH : null, front ? () => { c.beginPath(); c.ellipse(w * 0.4, 0.6, w * 0.8, 3, 0, 0, 6.28); } : null, 1);
      c.strokeStyle = ORANGE; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, Math.max(0.2, w - 0.8), 2.6, 0, 0, 6.28); c.stroke();
      tube(c, [0, 0, cs * 2.6, -2.2], 0.8, METAL_SH);
      c.fillStyle = Math.sin(time * 7) > 0 ? '#ff5a4f' : '#ffe45c'; c.beginPath(); c.arc(cs * 2.6, -2.4, 0.7, 0, 6.28); c.fill();
      c.restore();
    } else if (lo.sensor === 'scanner') {
      tube(c, [mx, my, mx, my - 3.4], 1.6, METAL);
      const py = my - 6;
      // sweeping scan beam
      const sweep = Math.sin(time * 1.8);
      if (!back) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const bx = mx + (side ? 2 : sweep * 3), ang = side ? 0.35 + sweep * 0.35 : Math.PI / 2 + sweep * 0.6;
        c.translate(bx, py); c.rotate(side ? ang : ang - Math.PI / 2);
        c.fillStyle = 'rgba(120,255,240,0.16)';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(22, -5); c.lineTo(22, 5); c.closePath(); c.fill();
        c.restore();
      }
      c.save(); c.translate(mx, py); c.rotate(Math.sin(time * 1.2) * 0.15);
      cel(c, () => { c.beginPath(); c.moveTo(0, -4.2); c.lineTo(3.8, 1.8); c.lineTo(-3.8, 1.8); c.closePath(); }, '#7ef0e6', '#2bb5a8', () => { c.beginPath(); c.moveTo(0, -4.2); c.lineTo(3.8, 1.8); c.lineTo(0.4, 1.8); c.closePath(); }, 1);
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.moveTo(-0.6, -2.6); c.lineTo(-2, 0.6); c.lineTo(-1.2, 0.6); c.closePath(); c.fill();
      glow(c, 0, -0.2, 4.5, '#6ff6ff', 0.35);
      c.restore();
    } else {
      // springy antenna with a mood bulb
      const sway = Math.sin(time * 3.1) * 0.9 + (o.moving ? (side ? -1.6 : -Math.cos(walk) * 1.2) : 0);
      c.strokeStyle = OL; c.lineWidth = 1.9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(mx, my - 3.5, mx + sway, my - 6.4); c.stroke();
      c.strokeStyle = METAL; c.lineWidth = 0.9; c.stroke();
      glow(c, mx + sway, my - 7.4, 4.8, bulbCol, 0.55);
      cel(c, circ(c, mx + sway, my - 7.4, 1.9), bulbCol, shade(bulbCol, -0.25), circ(c, mx + sway + 0.8, my - 6.6, 1.5), 0.9);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(mx + sway - 0.6, my - 8, 0.55, 0, 6.28); c.fill();
    }
    // base collar
    cel(c, rr(c, mx - 2.6, my - 1.3, 5.2, 2.2, 1), TEAL, TEAL_SH, rr(c, mx + 0.6, my - 1.3, 2, 2.2, 0.8), 0.9);
  };

  // ------------------------------------------------------------------ tank (back-mounted)
  /** view: 'peek' = behind the pod seen from the front, 'side' = behind in profile, 'full' = back view */
  const tank = (view: 'peek' | 'side' | 'full') => {
    const t = lo.tank;
    let cx: number, cy: number;
    if (view === 'peek') { cx = 4.2; cy = top + 1; }
    else if (view === 'side') { cx = -PW / 2 - 2.2; cy = top + PH * 0.5; }
    else { cx = 0; cy = top + PH * 0.42; }
    c.save(); c.translate(cx, cy); c.scale(tS, tS);
    if (t === 'quantum') {
      const R = 6.4;
      cel(c, rr(c, -4.6, R - 1.6, 9.2, 2.8, 1.2), TEAL, TEAL_SH, null, 1);
      const pulse = (time % 3) < 0.4 ? 1 - (time % 3) / 0.4 : 0;
      c.fillStyle = rad(c, -1.6, -1.8, 0.5, R, [[0, '#7b5cff'], [0.55, '#3b1f8f'], [1, '#160a3a']]);
      c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.clip();
      c.globalCompositeOperation = 'lighter';
      const sp = 0.3 + fill * 0.7;
      c.strokeStyle = `rgba(120,255,240,${0.5 * sp})`; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = time * (1.4 + i * 0.5) + i * 2; c.beginPath(); c.ellipse(0, 0, 1.6 + i * 1.5, 0.9 + i * 0.9, a, 0, 4); c.stroke(); }
      c.fillStyle = `rgba(255,255,255,${0.8 * sp})`;
      for (let i = 0; i < 6; i++) { const a = time * 1.7 + i * 1.05, d = 1.2 + (i % 3) * 1.5; c.fillRect(Math.cos(a) * d - 0.35, Math.sin(a) * d * 0.7 - 0.35, 0.7, 0.7); }
      if (pulse > 0) { c.fillStyle = `rgba(160,255,250,${pulse * 0.6})`; c.fillRect(-R, -R, R * 2, R * 2); }
      c.restore();
      c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(c, -2.4, -3, 1.8, 1, -0.6); c.fill();
      glow(c, 0, 0, R + 3, '#8a7bff', 0.18 + pulse * 0.3);
    } else if (t === 'compactor') {
      const w = 12, h = 11;
      const pump = (Math.sin(time * (2.5 + fill * 7)) * 0.5 + 0.5);
      // piston on top
      tube(c, [-2.5, -h / 2, -2.5, -h / 2 - 2.6 - pump * 2.2], 1.4, '#e6edf2');
      cel(c, rr(c, -4.4, -h / 2 - 4.2 - pump * 2.2, 3.8, 1.8, 0.6), DARK, null, null, 0.8);
      cel(c, rr(c, -w / 2, -h / 2, w, h, 2), DARK, DARK_SH, rr(c, w * 0.15, -h / 2, w, h, 1), 1.15);
      // hazard stripe
      c.save(); rrect(c, -w / 2 + 1, -h / 2 + 1.2, w - 2, 2.4, 0.6); c.clip();
      c.fillStyle = '#ffcc33'; c.fillRect(-w / 2, -h / 2, w, 4);
      c.fillStyle = OL; for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(-w / 2 + i * 2.6, -h / 2 + 4); c.lineTo(-w / 2 + i * 2.6 + 1.3, -h / 2 + 4); c.lineTo(-w / 2 + i * 2.6 + 2.8, -h / 2); c.lineTo(-w / 2 + i * 2.6 + 1.5, -h / 2); c.closePath(); c.fill(); }
      c.restore();
      // gauge
      cel(c, circ(c, 1.8, 1.5, 2.6), '#f6ecd9', null, null, 0.9);
      c.strokeStyle = full ? '#e53935' : OL; c.lineWidth = 0.8;
      const ga = Math.PI * (0.8 + fill * 1.4);
      c.beginPath(); c.moveTo(1.8, 1.5); c.lineTo(1.8 + Math.cos(ga) * 2, 1.5 + Math.sin(ga) * 2); c.stroke();
      c.fillStyle = full ? (Math.sin(time * 10) > 0 ? '#ff5a4f' : '#7a1f1a') : '#7dff8a'; c.beginPath(); c.arc(-3.4, 2.2, 0.9, 0, 6.28); c.fill();
    } else {
      const w = 10, h = 13;
      cel(c, rr(c, -w / 2, -h / 2, w, h, 3.2), METAL, METAL_SH, rr(c, w * 0.18, -h / 2, w, h, 1.4), 1.15);
      cel(c, rr(c, -w / 2 - 0.6, -h / 2 - 1.2, w + 1.2, 2.8, 1.2), TEAL, TEAL_SH, rr(c, w * 0.15, -h / 2 - 1.2, w, 2.8, 1), 1);
      c.fillStyle = METAL_SH; c.fillRect(-w / 2 + 0.6, h / 2 - 3.4, w - 1.2, 0.9);
      // window with the load
      const wx = -2.2, wy = -h / 2 + 2.6, ww = 4.4, wh = h - 6;
      cel(c, rr(c, wx, wy, ww, wh, 1.4), '#1d2a30', null, null, 0.9);
      if (fill > 0.02) {
        c.save(); rrect(c, wx, wy, ww, wh, 1.4); c.clip();
        const tp = wy + wh * (1 - fill);
        c.fillStyle = '#5b4a7a'; c.fillRect(wx, tp, ww, wh);
        for (let i = 0; i < 7; i++) { c.fillStyle = MAT_COLS[i % 6]; c.fillRect(wx + ((i * 37) % 10) / 10 * ww - 0.6, tp + ((i * 53) % 10) / 10 * (wy + wh - tp), 1.5, 1.2); }
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(wx + 0.5, wy + 0.6, 0.7, wh - 1.2);
      if (full) { c.fillStyle = Math.sin(time * 10) > 0 ? '#ff5a4f' : '#7a1f1a'; c.beginPath(); c.arc(w / 2 - 1.6, -h / 2 - 2.4, 1.1, 0, 6.28); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.6; c.stroke(); }
    }
    c.restore();
  };

  // ------------------------------------------------------------------ arm boom + tool
  const arm = () => {
    const sway = o.moving ? Math.sin(walk) * 0.12 : Math.sin(time * 1.6) * 0.05;
    let sx: number, sy: number, a1: number, a2: number, a3: number;
    if (side) { sx = 2; sy = top + PH * 0.6; a1 = -0.85 - k * 0.5 + sway; a2 = -1.35 + k * 0.25; a3 = -0.95 + k * 0.35; }
    else if (back) { sx = PW / 2 - 0.5; sy = top + PH * 0.52; a1 = -1.45 + k * 0.4 - sway; a2 = -0.55 + k * 0.4; a3 = -0.5 + k * 0.35; }
    else { sx = -PW / 2 + 0.5; sy = top + PH * 0.52; a1 = 1.45 - k * 0.45 + sway; a2 = 0.55 - k * 0.45; a3 = 0.5 - k * 0.45; }
    const L1 = 5.2, L2 = 4.4 + k * 1.8;
    const ex = sx - Math.sin(a1) * L1, ey = sy + Math.cos(a1) * L1;
    const wx = ex - Math.sin(a2) * L2, wy = ey + Math.cos(a2) * L2;
    tube(c, [sx, sy, ex, ey], 3, ORANGE);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(sx - 0.5, sy); c.lineTo(ex - 0.5, ey); c.stroke();
    tube(c, [ex, ey, wx, wy], 2, METAL);
    cel(c, circ(c, ex, ey, 1.6), METAL_SH, null, null, 0.8);
    cel(c, circ(c, sx, sy, 2.5), TEAL, TEAL_SH, circ(c, sx + 0.9, sy + 0.9, 2), 1);
    c.fillStyle = METAL; c.beginPath(); c.arc(sx, sy, 0.9, 0, 6.28); c.fill();
    c.save(); c.translate(wx, wy); c.rotate(a3); c.scale(0.76, 0.76);
    drawTool(c, o.tier, o.action, time, true);
    c.restore();
  };

  const crown = () => {
    if (!o.crown) return;
    c.save(); c.translate(side ? 3.5 : -5.5, top + 1.2); c.rotate(-0.2);
    cel(c, () => { c.beginPath(); c.moveTo(-4.2, 0); c.lineTo(-4.6, -5); c.lineTo(-2.2, -2.6); c.lineTo(0, -6.2); c.lineTo(2.2, -2.6); c.lineTo(4.6, -5); c.lineTo(4.2, 0); c.closePath(); }, '#ffd54f', '#d4a017', () => { c.fillRect(-6, -1.6, 12, 2); }, 1);
    c.fillStyle = '#e53935'; c.beginPath(); c.arc(0, -2.3, 0.85, 0, 6.28); c.fill();
    c.restore();
  };

  const zzz = () => {
    if (mood !== 'sleepy') return;
    c.save(); c.fillStyle = '#d9d0ff'; c.strokeStyle = OL; c.lineWidth = 0.8; c.font = 'bold 5px sans-serif';
    for (let i = 0; i < 2; i++) {
      const t = (time * 0.5 + i * 0.5) % 1;
      c.globalAlpha = 1 - t;
      const zx = (side ? -1 : 1) * (PW / 2 + 1 + t * 4), zy = top - 1 - t * 7;
      c.strokeText('z', zx, zy); c.fillText('z', zx, zy);
    }
    c.restore();
  };

  // ================================================================== assemble per view
  if (side) {
    squash(() => tank('side'));
    loco('back');
    loco('front');
    squash(() => { pod(); face(); sensor(); crown(); arm(); zzz(); });
  } else if (back) {
    loco('back');
    loco('front');
    squash(() => { arm(); pod(); backPanel(); sensor(); crown(); tank('full'); });
  } else {
    loco('back');
    squash(() => tank('peek'));
    loco('front');
    squash(() => { pod(); face(); sensor(); crown(); arm(); zzz(); });
  }
  c.restore();
}

/**
 * Arm attachments, drawn from the mount point (origin) pointing along +y (about 20 units long).
 * `act` is the action animation (1 = just triggered).
 */
export function drawTool(c: C, tier: number, act: number, time: number, side: boolean) {
  void side;
  const k = act > 0 ? Math.sin(act * Math.PI) : 0;
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  const collar = () => cel(c, rr(c, -2.6, -1.2, 5.2, 3, 1.1), DARK, null, null, 0.9);
  switch (tier) {
    case 0: { // factory pincer
      cel(c, rr(c, -1.1, 1, 2.2, 4, 0.8), METAL, null, null, 0.8);
      collar();
      const open = 0.15 + (1 - k) * 0.55;
      for (const s of [-1, 1]) {
        c.save(); c.translate(0, 5); c.rotate(s * -open);
        cel(c, () => { c.beginPath(); c.moveTo(s * 0.6, 0); c.quadraticCurveTo(s * 4.2, 3, s * 1.6, 8.4); c.lineTo(s * 0.4, 7.6); c.quadraticCurveTo(s * 2, 3.6, s * -0.6, 0.6); c.closePath(); }, TEAL, TEAL_SH, () => { c.fillRect(s > 0 ? 1.2 : -4, 0, 3, 9); }, 0.9);
        c.restore();
      }
      cel(c, circ(c, 0, 5, 1.4), ORANGE, null, null, 0.8);
      break;
    }
    case 1: { // telescopic scoop
      const ext = k * 5;
      cel(c, rr(c, -1.7, 0, 3.4, 5.4, 1), METAL, METAL_SH, rr(c, 0.4, 0, 1.3, 5.4, 0.6), 0.9);
      cel(c, rr(c, -1.3, 4.6, 2.6, 3.6 + ext * 0.5, 0.9), METAL, METAL_SH, rr(c, 0.3, 4.6, 1, 4 + ext, 0.5), 0.9);
      const e = 8 + ext;
      cel(c, rr(c, -0.95, e - 0.6, 1.9, 2.6 + ext * 0.5, 0.7), '#e6edf2', null, null, 0.8);
      const b = e + 2 + ext * 0.5;
      collar();
      cel(c, () => { c.beginPath(); c.moveTo(-3.8, b); c.lineTo(3.8, b); c.lineTo(3.2, b + 4.4); c.quadraticCurveTo(0, b + 6.6, -3.2, b + 4.4); c.closePath(); }, ORANGE, ORANGE_SH, () => { c.fillRect(0.6, b, 4, 7); }, 1);
      c.fillStyle = DARK; c.fillRect(-3, b + 0.6, 6, 1);
      break;
    }
    case 2: { // hydraulic claw
      cel(c, rr(c, -2.1, 0, 4.2, 7, 1.3), ORANGE, ORANGE_SH, rr(c, 0.6, 0, 1.6, 7, 0.6), 1);
      collar();
      const rod = 1.6 + k * 4;
      cel(c, rr(c, -0.8, 6.6, 1.6, rod + 0.6, 0.6), '#eef3f6', null, null, 0.7);
      const e = 7 + rod;
      cel(c, circ(c, 0, e + 0.8, 2.2), DARK, DARK_SH, circ(c, 0.8, e + 1.6, 1.8), 0.9);
      const open = (1 - k) * 0.7 + 0.15;
      for (const s of [-1, 1]) tube(c, [s * 1, e + 2, s * (2.2 + open * 3), e + 5, s * (0.9 + open * 1.4), e + 8.4], 1.3, METAL);
      tube(c, [0, e + 2.6, 0, e + 7.6], 1.1, METAL_SH);
      for (const s of [-1, 1]) cel(c, circ(c, s * (0.9 + open * 1.4), e + 8.4, 0.85), ORANGE, null, null, 0.6);
      break;
    }
    case 3: { // ionic vacuum nozzle
      for (let i = 0; i < 4; i++) cel(c, ell(c, 0, 1.5 + i * 1.6, 2.2, 1), i % 2 ? DARK : '#56636f', null, null, 0.8);
      collar();
      cel(c, () => { c.beginPath(); c.moveTo(-1.9, 7); c.lineTo(1.9, 7); c.lineTo(4.8, 13); c.lineTo(-4.8, 13); c.closePath(); }, SHELL, SHELL_SH, () => { c.fillRect(1, 6, 5, 8); }, 1);
      cel(c, rr(c, -2.2, 7.4, 4.4, 1.6, 0.6), ORANGE, null, null, 0.7);
      cel(c, ell(c, 0, 13, 4.8, 1.5), SCREEN, null, null, 1);
      const p = 0.6 + Math.sin(time * 12) * 0.25 + k * 0.4;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(110,250,255,${0.8 * p})`; c.lineWidth = 0.9; ellipse(c, 0, 13, 4, 1.05); c.stroke();
      c.fillStyle = `rgba(110,250,255,${0.25 * p})`; c.beginPath(); c.moveTo(-4.2, 13); c.lineTo(4.2, 13); c.lineTo(6.5, 19); c.lineTo(-6.5, 19); c.closePath(); c.fill();
      c.restore();
      break;
    }
    case 4: { // magnetic ring
      cel(c, rr(c, -1, 0, 2, 6.5, 0.7), METAL, METAL_SH, rr(c, 0.2, 0, 0.8, 6.5, 0.4), 0.8);
      collar();
      const cy = 10.4, rx = 6, ry = 2.8;
      const f = (time * 1.6) % 1;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(150,170,255,${0.55 * (1 - f)})`; c.lineWidth = 0.9; ellipse(c, 0, cy + 1 + f * 4, rx + f * 3, ry + f * 1.4); c.stroke();
      c.restore();
      c.strokeStyle = OL; c.lineWidth = 3.8; ellipse(c, 0, cy, rx, ry); c.stroke();
      for (let i = 0; i < 8; i++) {
        c.strokeStyle = i % 2 ? '#ef4444' : '#e5e7eb'; c.lineWidth = 2.2;
        c.beginPath(); c.ellipse(0, cy, rx, ry, 0, i * 0.785 + time * 0.8, (i + 1) * 0.785 + time * 0.8); c.stroke();
      }
      tube(c, [0, 6.2, -4, cy - 1.4], 0.8, METAL_SH);
      tube(c, [0, 6.2, 4, cy - 1.4], 0.8, METAL_SH);
      break;
    }
    case 5: { // spiral shredder
      cel(c, rr(c, -4.2, 0, 8.4, 5, 1.6), ORANGE, ORANGE_SH, rr(c, 1.2, 0, 3, 5, 1), 1);
      c.save(); rrect(c, -3.6, 1.4, 7.2, 1.8, 0.5); c.clip();
      c.fillStyle = '#ffcc33'; c.fillRect(-4, 1, 8, 3); c.fillStyle = OL;
      for (let i = -2; i < 4; i++) c.fillRect(-4 + i * 2.4 + 0.6, 1, 1, 3);
      c.restore();
      collar();
      cel(c, rr(c, -3.3, 4.6, 6.6, 8, 2.2), DARK, DARK_SH, rr(c, 1, 4.6, 2.3, 8, 1), 1);
      c.save(); rrect(c, -3.3, 4.6, 6.6, 8, 2.2); c.clip();
      c.strokeStyle = '#d7dde0'; c.lineWidth = 1;
      const off = (time * 22) % 2.6;
      for (let i = -1; i < 5; i++) { const yy = 4 + i * 2.6 + off; c.beginPath(); c.moveTo(-3.4, yy); c.lineTo(3.4, yy + 1.8); c.stroke(); }
      c.restore();
      c.fillStyle = '#d7dde0';
      for (let i = 0; i < 4; i++) { const tx = -2.6 + i * 1.75; c.beginPath(); c.moveTo(tx - 0.6, 12.4); c.lineTo(tx + 0.6, 12.4); c.lineTo(tx, 14); c.closePath(); c.fill(); }
      break;
    }
    case 6: { // tractor-beam emitter
      glow(c, 0, 9, 9 + k * 3, '#00e5ff', 0.45);
      cel(c, () => { c.beginPath(); c.moveTo(-2.4, 0); c.lineTo(2.4, 0); c.lineTo(3.8, 7.4); c.lineTo(-3.8, 7.4); c.closePath(); }, DARK, DARK_SH, () => { c.fillRect(0.8, 0, 4, 8); }, 1);
      for (const s of [-1, 1]) cel(c, () => { c.beginPath(); c.moveTo(s * 3, 2.4); c.lineTo(s * 5.6, 5.6); c.lineTo(s * 3.6, 6.6); c.closePath(); }, ORANGE, null, null, 0.8);
      collar();
      cel(c, circ(c, 0, 8.6, 2.8), '#c7fbff', null, null, 1);
      c.fillStyle = '#00e5ff'; c.beginPath(); c.arc(0, 8.6, 1.5 + Math.sin(time * 10) * 0.3, 0, 6.28); c.fill();
      c.save(); c.translate(0, 8.6); c.rotate(time * 3);
      c.strokeStyle = 'rgba(120,250,255,0.9)'; c.lineWidth = 0.8; ellipse(c, 0, 0, 5.4, 1.8); c.stroke();
      c.restore();
      break;
    }
  }
  c.restore();
}

/** Visuals for area tools at the collection center. */
export function drawAreaTool(c: C, g: Game, time: number, collecting: boolean) {
  const ac = g.areaCenter;
  if (!ac) return;
  const tool = g.tool;
  const r = tool.radius * g.d.reachMult * TILE;
  const x = ac.x * TILE, y = ac.y * TILE;
  c.save();
  c.globalAlpha = collecting ? 0.9 : 0.35;
  c.strokeStyle = tool.color;
  c.lineWidth = 1.5;
  c.setLineDash([6, 5]);
  c.lineDashOffset = -time * 30;
  c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, 6.28); c.stroke();
  c.setLineDash([]);
  if (collecting) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y, 0, r, [[0, shade(tool.color, 0, 0.28)], [1, shade(tool.color, 0, 0)]]);
    c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, 6.28); c.fill();
    // swirl
    c.strokeStyle = shade(tool.color, 0.4, 0.6);
    c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a0 = time * (tool.id === 'advanced' ? 6 : 4) + i * 2.09;
      c.beginPath(); c.ellipse(x, y, r * (0.4 + i * 0.2), r * 0.85 * (0.4 + i * 0.2), 0, a0, a0 + 1.4); c.stroke();
    }
  }
  c.restore();
}

/** Bracket around the target tile of single-target tools. */
export function drawAimTile(c: C, tile: number, worldTiles: number, time: number, color: string) {
  if (tile < 0) return;
  const tx = tile % worldTiles, ty = Math.floor(tile / worldTiles);
  const x = tx * TILE, y = ty * TILE;
  const p = 2 + Math.sin(time * 6) * 1.5;
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 3;
  const L = 8;
  const corners: [number, number, number, number][] = [[x - p, y - p, 1, 1], [x + TILE + p, y - p, -1, 1], [x - p, y + TILE + p, 1, -1], [x + TILE + p, y + TILE + p, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) { c.beginPath(); c.moveTo(cx + L * sx, cy); c.lineTo(cx, cy); c.lineTo(cx, cy + L * sy); c.stroke(); }
  c.restore();
}
