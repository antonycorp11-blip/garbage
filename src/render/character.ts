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
/** Chunky capsule segment (arms, struts, femurs): cel shading + outline + one highlight. */
function seg(c: C, x1: number, y1: number, x2: number, y2: number, w: number, base: string, sh: string, lw = 1) {
  const L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
  c.save(); c.translate(x1, y1); c.rotate(a);
  cel(c, rr(c, -w / 2, -w / 2, L + w, w, w / 2), base, sh, rr(c, -w / 2, w * 0.1, L + w, w, w * 0.4), lw);
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = Math.max(0.45, w * 0.16); c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -w * 0.2); c.lineTo(L, -w * 0.2); c.stroke();
  c.restore();
}
/** Tapered limb from a thick end to a thin end. */
function taper(c: C, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, base: string, sh: string) {
  const L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
  c.save(); c.translate(x1, y1); c.rotate(a);
  const path = () => { c.beginPath(); c.moveTo(0, -w1 / 2); c.lineTo(L, -w2 / 2); c.arc(L, 0, w2 / 2, -Math.PI / 2, Math.PI / 2); c.lineTo(0, w1 / 2); c.arc(0, 0, w1 / 2, Math.PI / 2, Math.PI * 1.5); c.closePath(); };
  cel(c, path, base, sh, () => { c.fillRect(-w1, 0.15, L + w1 * 2, w1); }, 0.95);
  c.restore();
}
/** Round joint cap with a bolt. */
function joint(c: C, x: number, y: number, r: number, cap = DARK) {
  cel(c, circ(c, x, y, r), cap, shade(cap, -0.3), circ(c, x + r * 0.4, y + r * 0.4, r * 0.85), 0.9);
  cel(c, circ(c, x, y, r * 0.45), METAL, null, null, 0.55);
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(x - r * 0.38, y - r * 0.42, r * 0.17, 0, 6.28); c.fill();
}
/** Coil spring between two points (suspension). */
function spring(c: C, x1: number, y1: number, x2: number, y2: number, w: number, turns: number) {
  const pts: number[] = [];
  for (let i = 0; i <= turns * 2; i++) {
    const t = i / (turns * 2), side = i === 0 || i === turns * 2 ? 0 : i % 2 ? 1 : -1;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    pts.push(x1 + dx * t + (-dy / L) * side * w, y1 + dy * t + (dx / L) * side * w);
  }
  tube(c, pts, 0.9, '#e6edf2');
}
const bolt = (c: C, x: number, y: number, r = 0.45) => { c.fillStyle = OL; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill(); };

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
  const H = move === 'treads' ? 7.4 : move === 'legs' ? 10 : hover ? 12 + Math.sin(time * 3) * 1.1 : 11.4;
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
    const spin = walk * 1.25;
    if (side) {
      const cy = -5.7, r = 5.7;
      const topY = podY + 1.2;
      // suspension: strut + coil spring from the pod to the axle
      seg(c, -2.2, topY, -0.6, cy, 1.6, DARK, DARK_SH, 0.8);
      spring(c, 1.6, topY + 0.6, 1.0, cy - 2.2, 1.1, 3);
      // tyre with chunky tread blocks
      cel(c, circ(c, 0, cy, r), '#323b44', '#1e252c', circ(c, 1.5, cy + 1.5, r - 0.4), 1.2);
      for (let i = 0; i < 10; i++) {
        const a = spin + i * 0.6283;
        c.save(); c.translate(Math.cos(a) * (r - 0.15), cy + Math.sin(a) * (r - 0.15)); c.rotate(a);
        rrect(c, -0.75, -0.9, 1.5, 1.8, 0.45); c.fillStyle = '#4c5864'; c.fill(); c.strokeStyle = OL; c.lineWidth = 0.55; c.stroke();
        c.restore();
      }
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, cy, r - 1.2, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
      // rim + hub cap with bolts
      cel(c, circ(c, 0, cy, 3.4), METAL, METAL_SH, circ(c, 0.9, cy + 0.9, 3), 1);
      cel(c, circ(c, 0, cy, 1.9), ORANGE, ORANGE_SH, circ(c, 0.6, cy + 0.6, 1.7), 0.8);
      for (let i = 0; i < 4; i++) { const a = spin + i * 1.571; bolt(c, Math.cos(a) * 2.65, cy + Math.sin(a) * 2.65, 0.34); }
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(-0.5, cy - 0.6, 0.45, 0, 6.28); c.fill();
      // fork plate over the axle
      cel(c, () => { c.beginPath(); c.moveTo(-3.4, topY + 0.4); c.lineTo(-0.8, topY + 0.4); c.lineTo(0.9, cy); c.lineTo(-1.2, cy + 0.8); c.closePath(); }, TEAL, TEAL_SH, () => { c.fillRect(-0.6, topY, 3, cy - topY + 2); }, 0.9);
      bolt(c, -0.1, cy, 0.55);
      // fender
      c.lineCap = 'round';
      c.strokeStyle = OL; c.lineWidth = 3.2; c.beginPath(); c.arc(0, cy, r + 1.5, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
      c.strokeStyle = SHELL; c.lineWidth = 1.9; c.stroke();
      c.strokeStyle = ORANGE; c.lineWidth = 0.7; c.beginPath(); c.arc(0, cy, r + 1.5, Math.PI * 1.3, Math.PI * 1.7); c.stroke();
    } else {
      const cy = -5.7;
      // fork arms on both sides
      for (const sx of [-1, 1]) seg(c, sx * 4.6, podY + 0.8, sx * 4.4, cy, 2.2, TEAL, TEAL_SH, 0.9);
      // tyre seen head-on, tread chevrons rolling
      cel(c, rr(c, -3.5, cy - 5.7, 7, 11.4, 3.3), '#323b44', '#1e252c', rr(c, 1, cy - 5.7, 2.5, 11.4, 1.2), 1.2);
      c.save(); rrect(c, -3.5, cy - 5.7, 7, 11.4, 3.3); c.clip();
      c.strokeStyle = '#4c5864'; c.lineWidth = 1.1; c.lineCap = 'butt';
      for (let i = 0; i < 5; i++) {
        const ty = cy - 7 + ((spin * 2.2 + i * 2.8) % 14);
        c.beginPath(); c.moveTo(-3.2, ty - 1); c.lineTo(0, ty + 0.6); c.lineTo(3.2, ty - 1); c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(-2.6, cy - 5, 1, 9);
      c.restore();
      rrect(c, -3.5, cy - 5.7, 7, 11.4, 3.3); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke();
      for (const sx of [-1, 1]) { cel(c, circ(c, sx * 4.5, cy, 1.9), METAL, METAL_SH, circ(c, sx * 4.5 + 0.6, cy + 0.6, 1.5), 0.85); cel(c, circ(c, sx * 4.5, cy, 0.9), ORANGE, null, null, 0.55); }
      // fender cap
      cel(c, rr(c, -4.8, cy - 7.4, 9.6, 2.8, 1.3), SHELL, SHELL_SH, rr(c, -4.8, cy - 5.9, 9.6, 1.4, 0.6), 1);
      c.fillStyle = ORANGE; c.fillRect(-3.2, cy - 7, 6.4, 0.75);
    }
  };

  const treads = (layer: 'back' | 'front') => {
    const off = walk * 2.3;
    if (side) {
      if (layer === 'back') return;
      const x0 = -12.5, w = 25, h = 8.6, y0 = -h;
      // track loop
      cel(c, rr(c, x0, y0, w, h, h / 2), '#323b44', '#1e252c', rr(c, x0, y0 + h * 0.5, w, h * 0.5, 2), 1.25);
      // link plates on top (moving back) and bottom (moving forward)
      c.save(); rrect(c, x0 - 1, y0 - 1.4, w + 2, h + 2.8, h / 2 + 1); c.clip();
      for (let i = 0; i < 12; i++) {
        const tx = x0 + 1 + ((i * 2.2 - off * 1.0) % (w - 2) + (w - 2)) % (w - 2);
        rrect(c, tx, y0 - 0.7, 1.6, 1.5, 0.4); c.fillStyle = '#56626d'; c.fill(); c.strokeStyle = OL; c.lineWidth = 0.5; c.stroke();
        const bx = x0 + 1 + ((i * 2.2 + off) % (w - 2) + (w - 2)) % (w - 2);
        rrect(c, bx, -0.8, 1.6, 1.5, 0.4); c.fillStyle = '#4a5560'; c.fill(); c.stroke();
      }
      c.restore();
      // sprockets at both ends + road wheels
      for (const wx of [x0 + h / 2, x0 + w - h / 2]) {
        cel(c, circ(c, wx, y0 + h / 2, 3), METAL, METAL_SH, circ(c, wx + 0.9, y0 + h / 2 + 0.9, 2.5), 0.9);
        c.fillStyle = OL;
        for (let i = 0; i < 6; i++) { const a = off * 0.9 + i * 1.047; c.beginPath(); c.arc(wx + Math.cos(a) * 2.1, y0 + h / 2 + Math.sin(a) * 2.1, 0.45, 0, 6.28); c.fill(); }
        cel(c, circ(c, wx, y0 + h / 2, 1.1), ORANGE, null, null, 0.6);
      }
      for (const wx of [-3, 3]) { cel(c, circ(c, wx, y0 + h / 2 + 0.6, 2.1), DARK, DARK_SH, circ(c, wx + 0.6, y0 + h / 2 + 1.2, 1.7), 0.85); bolt(c, wx, y0 + h / 2 + 0.6, 0.55); }
      // armoured side skirt over the upper run
      cel(c, () => { c.beginPath(); c.moveTo(x0 + 2.2, y0 - 1.4); c.lineTo(x0 + w - 2.2, y0 - 1.4); c.lineTo(x0 + w - 0.4, y0 + 2.6); c.lineTo(x0 + 0.4, y0 + 2.6); c.closePath(); }, ORANGE, ORANGE_SH, () => { c.fillRect(x0, y0 + 1.2, w, 2); }, 1);
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x0 + 3, y0 - 0.9, w - 6, 0.6);
      for (let i = 0; i < 5; i++) bolt(c, x0 + 3.4 + i * (w - 6.8) / 4, y0 + 0.9, 0.4);
    } else {
      if (layer === 'back') {
        seg(c, -6, -5.2, 6, -5.2, 2.4, METAL_SH, DARK, 0.9);
        return;
      }
      for (const cx of [-7.4, 7.4]) {
        cel(c, rr(c, cx - 3.2, -8.2, 6.4, 8.2, 2.6), '#323b44', '#1e252c', rr(c, cx + 0.8, -8.2, 2.4, 8.2, 1.2), 1.2);
        c.save(); rrect(c, cx - 3.2, -8.2, 6.4, 8.2, 2.6); c.clip();
        for (let i = 0; i < 5; i++) {
          const ty = -9 + ((off * 1.6 + i * 2) % 10);
          rrect(c, cx - 2.6, ty, 5.2, 1.1, 0.4); c.fillStyle = '#56626d'; c.fill(); c.strokeStyle = OL; c.lineWidth = 0.45; c.stroke();
        }
        c.restore();
        rrect(c, cx - 3.2, -8.2, 6.4, 8.2, 2.6); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke();
        cel(c, rr(c, cx - 3.8, -9.8, 7.6, 3, 1.2), ORANGE, ORANGE_SH, rr(c, cx - 3.8, -8.3, 7.6, 1.5, 0.6), 1);
        bolt(c, cx - 2, -8.4, 0.38); bolt(c, cx + 2, -8.4, 0.38);
      }
    }
  };

  const legs = (layer: 'back' | 'front') => {
    const leg = (hx: number, hy: number, fx: number, fy: number, ph: number, far: boolean) => {
      const p = walk * 1.15 + ph;
      const lift = o.moving ? Math.max(0, Math.sin(p)) * 3 : 0;
      // planted feet slide back under the body, lifted ones swing forward
      const slide = o.moving && side ? Math.cos(p) * 1.5 : 0;
      const fX = fx + slide, fY = fy - lift;
      const kx = hx + (fX - hx) * 1.1, ky = Math.min(hy, fY) - 6.4 - lift * 0.4;
      const k1 = far ? 0.82 : 1;
      // armoured femur with an orange stripe, knee, tapered shin, claw foot
      seg(c, hx, hy, kx, ky, 3.6 * k1, far ? SHELL_SH : SHELL, far ? '#a8916f' : SHELL_SH, 1);
      if (!far) { c.strokeStyle = ORANGE; c.lineWidth = 0.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx + (kx - hx) * 0.3, hy + (ky - hy) * 0.3 + 0.6); c.lineTo(hx + (kx - hx) * 0.75, hy + (ky - hy) * 0.75 + 0.6); c.stroke(); }
      taper(c, kx, ky, fX, fY - 0.8, 3 * k1, 1.2 * k1, far ? METAL_SH : METAL, far ? DARK : METAL_SH);
      joint(c, kx, ky, 1.9 * k1, far ? DARK_SH : DARK);
      cel(c, () => { c.beginPath(); c.moveTo(fX - 1.4 * k1, fY - 1.6); c.lineTo(fX + 1.4 * k1, fY - 1.6); c.lineTo(fX, fY + 0.6); c.closePath(); }, far ? DARK_SH : ORANGE, far ? null : ORANGE_SH, () => { c.fillRect(fX, fY - 2, 2, 3); }, 0.8);
    };
    const hy = podY + 1.2;
    if (side) {
      if (layer === 'back') { leg(-3, hy - 1.2, -9.5, -1.4, 0, true); leg(0.5, hy - 1.2, 1.5, -1.4, Math.PI, true); leg(3.5, hy - 1.2, 11, -1.4, 0, true); }
      else { leg(-3.5, hy, -11.5, 0, Math.PI, false); leg(0, hy, -0.5, 0.5, 0, false); leg(3.2, hy, 9.5, 0, Math.PI, false); }
    } else {
      if (layer === 'back') { leg(-4, hy - 1, -12.5, -2.2, Math.PI, true); leg(4, hy - 1, 12.5, -2.2, 0, true); }
      else {
        leg(-5, hy, -15.5, -0.4, 0, false); leg(5, hy, 15.5, -0.4, Math.PI, false);
        leg(-3.6, hy + 0.6, -9.8, 1.8, Math.PI, false); leg(3.6, hy + 0.6, 9.8, 1.8, 0, false);
      }
      // hip ring under the pod
      cel(c, rr(c, -6, hy - 1.6, 12, 2.6, 1.2), DARK, DARK_SH, rr(c, -6, hy - 0.4, 12, 1.4, 0.6), 0.9);
    }
  };

  const hoverUnit = () => {
    const jets = side ? [-6, 6] : [-9.4, 9.4];
    // thrust plumes
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const jx of jets) {
      const fl = 0.75 + Math.sin(time * 23 + jx) * 0.12 + (o.moving ? 0.25 : 0);
      c.fillStyle = rad(c, jx, podY + 6, 0, -podY - 4, [[0, `rgba(160,250,255,${0.55 * fl})`], [1, 'rgba(80,220,255,0)']]);
      c.beginPath(); c.moveTo(jx - 1.7, podY + 3.6); c.lineTo(jx + 1.7, podY + 3.6); c.lineTo(jx + 3.2, -0.4); c.lineTo(jx - 3.2, -0.4); c.closePath(); c.fill();
      c.fillStyle = `rgba(235,255,255,${0.85 * fl})`; ellipse(c, jx, podY + 4.6, 1.2, 1.4 + fl * 0.8); c.fill();
    }
    c.restore();
    // central skirt with running lights
    cel(c, ell(c, 0, podY + 0.8, side ? 9.4 : 10.6, 2.8), DARK, DARK_SH, ell(c, 1.5, podY + 1.8, side ? 9 : 10, 2), 1.1);
    for (let i = 0; i < 5; i++) {
      const lx = (i - 2) * (side ? 3.3 : 3.8);
      c.fillStyle = Math.sin(time * 6 - i * 0.9) > 0.2 ? GLOW : '#1f7f88'; c.beginPath(); c.arc(lx, podY + 1.5, 0.6, 0, 6.28); c.fill();
    }
    // sleek thruster nacelles on short pylons
    for (const jx of jets) {
      const sgn = Math.sign(jx);
      seg(c, sgn * 3.5, podY - 1.6, jx, podY + 0.4, 1.6, DARK, DARK_SH, 0.8);
      const nac = () => { c.beginPath(); c.ellipse(jx, podY + 1.2, 3.3, 2.4, 0, 0, 6.28); };
      cel(c, nac, SHELL, SHELL_SH, () => { c.beginPath(); c.ellipse(jx + 0.9, podY + 2.3, 3.2, 2, 0, 0, 6.28); }, 1.05);
      c.save(); nac(); c.clip(); c.fillStyle = ORANGE; c.fillRect(jx + sgn * 1.4 - (sgn > 0 ? 0 : 2.2), podY - 2, 2.2, 7); c.restore();
      nac(); c.strokeStyle = OL; c.lineWidth = 1.05; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(c, jx - 1, podY + 0.1, 1.3, 0.6); c.fill();
      cel(c, ell(c, jx, podY + 3.4, 2, 0.85), DARK_SH, null, null, 0.8);
      c.fillStyle = GLOW; ellipse(c, jx, podY + 3.5, 1.2, 0.45); c.fill();
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
    const mx = side ? -2 : 0, my = top + 0.8;
    const bulbCol = mood === 'worried' ? '#ff5a4f' : mood === 'happy' || mood === 'focus' ? '#ffe45c' : mood === 'sleepy' ? '#b69cff' : '#7dff8a';
    // mount plate on the dome
    const plate = () => {
      cel(c, rr(c, mx - 3.4, my - 1.6, 6.8, 2.6, 1.3), DARK, DARK_SH, rr(c, mx - 3.4, my - 0.4, 6.8, 1.4, 0.6), 0.95);
      bolt(c, mx - 2.2, my - 0.3, 0.35); bolt(c, mx + 2.2, my - 0.3, 0.35);
    };
    if (lo.sensor === 'radar') {
      plate();
      seg(c, mx, my - 1.2, mx, my - 4.6, 1.7, METAL, METAL_SH, 0.85);
      joint(c, mx, my - 4.8, 1.3, TEAL);
      const a = Math.sin(time * 1.3) * 1.15, cs = Math.cos(a), sn = 1;
      c.save(); c.translate(mx, my - 7.2);
      const w = 6.2 * Math.max(0.3, Math.abs(cs)), hh = 3.9;
      const front = sn > 0;
      if (front) {
        // bowl facing us: rim, deep inner cone, feed horn
        cel(c, () => { c.beginPath(); c.ellipse(0, 0, w, hh, 0, 0, 6.28); }, SHELL, null, null, 1.1);
        c.fillStyle = rad(c, -w * 0.2, -0.6, 0.2, w, [[0, '#9fb0bd'], [0.7, '#56656f'], [1, '#3a4650']]);
        c.beginPath(); c.ellipse(0, 0.3, Math.max(0.2, w - 1.1), hh - 1, 0, 0, 6.28); c.fill();
        c.strokeStyle = 'rgba(42,26,16,0.4)'; c.lineWidth = 0.5; c.stroke();
        c.strokeStyle = ORANGE; c.lineWidth = 0.7; c.beginPath(); c.ellipse(0, 0, Math.max(0.2, w - 0.45), hh - 0.45, 0, 0, 6.28); c.stroke();
        const fx = Math.sin(a) * 1.6;
        tube(c, [0, 0.3, fx, -3.2], 0.7, METAL);
        cel(c, circ(c, fx, -3.4, 0.95), ORANGE, null, null, 0.6);
        c.fillStyle = Math.sin(time * 7) > 0 ? '#ff5a4f' : '#ffe45c'; c.beginPath(); c.arc(fx, -3.4, 0.4, 0, 6.28); c.fill();
      } else {
        // back of the dish with stiffening ribs
        cel(c, () => { c.beginPath(); c.ellipse(0, 0, w, hh, 0, 0, 6.28); }, METAL, METAL_SH, () => { c.beginPath(); c.ellipse(w * 0.35, 0.8, w, hh, 0, 0, 6.28); }, 1.1);
        c.strokeStyle = 'rgba(42,26,16,0.45)'; c.lineWidth = 0.5;
        for (const t of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(t * w, -hh * 0.85); c.lineTo(t * w * 0.6, hh * 0.85); c.stroke(); }
        cel(c, circ(c, 0, 0, 1.1), DARK, null, null, 0.6);
      }
      c.restore();
    } else if (lo.sensor === 'scanner') {
      plate();
      seg(c, mx, my - 1.2, mx, my - 3.6, 1.8, METAL, METAL_SH, 0.85);
      const py = my - 7;
      const sweep = Math.sin(time * 1.8);
      if (!back) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const bx = mx + (side ? 2.4 : sweep * 2.5), ang = side ? 0.35 + sweep * 0.35 : Math.PI / 2 + sweep * 0.6;
        c.translate(bx, py); c.rotate(side ? ang : ang - Math.PI / 2);
        c.fillStyle = rad(c, 0, 0, 0, 24, [[0, 'rgba(140,255,240,0.32)'], [1, 'rgba(120,255,240,0)']]);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(24, -6); c.lineTo(24, 6); c.closePath(); c.fill();
        c.restore();
      }
      // hex collar + faceted prism
      cel(c, () => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.52; c.lineTo(mx + Math.cos(a) * 2.6, py + 3 + Math.sin(a) * 1.1); } c.closePath(); }, DARK, null, null, 0.85);
      c.save(); c.translate(mx, py); c.rotate(Math.sin(time * 1.2) * 0.12);
      glow(c, 0, -0.5, 6, '#6ff6ff', 0.4);
      const T = -5.2, B = 2.4;
      c.lineJoin = 'round';
      c.beginPath(); c.moveTo(0, T); c.lineTo(3.6, -0.6); c.lineTo(2, B); c.lineTo(-2, B); c.lineTo(-3.6, -0.6); c.closePath();
      c.fillStyle = '#7ef0e6'; c.fill();
      c.fillStyle = '#c4fffa'; c.beginPath(); c.moveTo(0, T); c.lineTo(-3.6, -0.6); c.lineTo(-0.6, 0.4); c.closePath(); c.fill();
      c.fillStyle = '#3cc8bb'; c.beginPath(); c.moveTo(0, T); c.lineTo(3.6, -0.6); c.lineTo(2, B); c.lineTo(0.6, 0.4); c.closePath(); c.fill();
      c.fillStyle = '#239d93'; c.beginPath(); c.moveTo(-0.6, 0.4); c.lineTo(0.6, 0.4); c.lineTo(2, B); c.lineTo(-2, B); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(42,26,16,0.35)'; c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(0, T); c.lineTo(-0.6, 0.4); c.lineTo(0.6, 0.4); c.lineTo(0, T); c.stroke();
      c.beginPath(); c.moveTo(0, T); c.lineTo(3.6, -0.6); c.lineTo(2, B); c.lineTo(-2, B); c.lineTo(-3.6, -0.6); c.closePath();
      c.strokeStyle = OL; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-1.3, -2.2, 0.45, 0, 6.28); c.fill();
      c.restore();
    } else {
      plate();
      // two-stage mast with a collar, then a spring tip and a glass bulb in a socket
      const sway = Math.sin(time * 3.1) * 0.9 + (o.moving ? (side ? -1.6 : -Math.cos(walk) * 1.2) : 0);
      seg(c, mx, my - 1.2, mx, my - 4, 1.7, METAL, METAL_SH, 0.85);
      cel(c, rr(c, mx - 1.5, my - 4.6, 3, 1.3, 0.5), TEAL, null, null, 0.7);
      const tx = mx + sway, ty = my - 8.6;
      c.strokeStyle = OL; c.lineWidth = 1.7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(mx, my - 4.6); c.quadraticCurveTo(mx, my - 6.6, tx, ty + 1.6); c.stroke();
      c.strokeStyle = '#e6edf2'; c.lineWidth = 0.8; c.stroke();
      glow(c, tx, ty - 0.6, 5.2, bulbCol, 0.55);
      cel(c, rr(c, tx - 1.2, ty + 0.4, 2.4, 1.6, 0.5), METAL, METAL_SH, null, 0.7);
      cel(c, circ(c, tx, ty - 0.8, 2.1), bulbCol, shade(bulbCol, -0.25), circ(c, tx + 0.9, ty + 0.1, 1.7), 0.95);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(tx - 0.7, ty - 1.6, 0.6, 0, 6.28); c.fill();
    }
  };

  // ------------------------------------------------------------------ tank (back-mounted)
  /** view: 'peek' = behind the pod seen from the front, 'side' = behind in profile, 'full' = back view */
  const tank = (view: 'peek' | 'side' | 'full') => {
    const t = lo.tank;
    let cx: number, cy: number;
    if (view === 'peek') { cx = 4.2; cy = top + 1; }
    else if (view === 'side') { cx = -PW / 2 - 2.4; cy = top + PH * 0.5; }
    else { cx = 0; cy = top + PH * 0.42; }
    c.save(); c.translate(cx, cy); c.scale(tS, tS);
    if (t === 'quantum') {
      const R = 6.4;
      // cradle: base plate and back bracket
      cel(c, rr(c, -5, R - 1.4, 10, 2.8, 1.2), TEAL, TEAL_SH, rr(c, -5, R, 10, 1.4, 0.6), 1);
      c.strokeStyle = OL; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, R + 0.9, Math.PI * 0.2, Math.PI * 0.8, true); c.stroke();
      c.strokeStyle = METAL_SH; c.lineWidth = 1.4; c.stroke();
      const pulse = (time % 3) < 0.4 ? 1 - (time % 3) / 0.4 : 0;
      c.fillStyle = rad(c, -1.6, -1.8, 0.5, R, [[0, '#8b6cff'], [0.55, '#3b1f8f'], [1, '#160a3a']]);
      c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.clip();
      c.globalCompositeOperation = 'lighter';
      const sp = 0.3 + fill * 0.7;
      c.strokeStyle = `rgba(120,255,240,${0.55 * sp})`; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = time * (1.4 + i * 0.5) + i * 2; c.beginPath(); c.ellipse(0, 0, 1.6 + i * 1.5, 0.9 + i * 0.9, a, 0, 4); c.stroke(); }
      c.fillStyle = `rgba(255,255,255,${0.85 * sp})`;
      for (let i = 0; i < 7; i++) { const a = time * 1.7 + i * 0.9, d = 1.2 + (i % 3) * 1.5; c.fillRect(Math.cos(a) * d - 0.35, Math.sin(a) * d * 0.7 - 0.35, 0.7, 0.7); }
      if (pulse > 0) { c.fillStyle = `rgba(160,255,250,${pulse * 0.6})`; c.fillRect(-R, -R, R * 2, R * 2); }
      c.restore();
      c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke();
      // equator band + side clamps in front of the glass
      c.save(); c.beginPath(); c.arc(0, 0, R + 0.1, 0, Math.PI); c.clip();
      c.strokeStyle = OL; c.lineWidth = 2.4; ellipse(c, 0, 0, R, 1.6); c.stroke();
      c.strokeStyle = METAL; c.lineWidth = 1.2; ellipse(c, 0, 0, R, 1.6); c.stroke();
      c.restore();
      for (const sx of [-1, 1]) { cel(c, rr(c, sx * R - 1.3, -1.6, 2.6, 3.2, 0.9), METAL, METAL_SH, null, 0.85); bolt(c, sx * R, 0, 0.4); }
      cel(c, rr(c, -1.6, -R - 1.4, 3.2, 1.8, 0.7), TEAL, null, null, 0.8);
      c.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(c, -2.5, -3.1, 1.9, 1, -0.6); c.fill();
      glow(c, 0, 0, R + 3, '#8a7bff', 0.18 + pulse * 0.3);
    } else if (t === 'compactor') {
      const w = 12.4, h = 11;
      const pump = (Math.sin(time * (2.5 + fill * 7)) * 0.5 + 0.5);
      // hydraulic piston: housing + chrome rod + ram head
      cel(c, rr(c, -4.6, -h / 2 - 3.2, 4, 3.6, 1), METAL, METAL_SH, rr(c, -2.4, -h / 2 - 3.2, 2, 3.6, 0.6), 0.9);
      cel(c, rr(c, -3.15, -h / 2 - 5.2 - pump * 2, 1.1, 2.6 + pump * 2, 0.5), '#f1f6f9', null, null, 0.7);
      cel(c, rr(c, -4.2, -h / 2 - 6.4 - pump * 2, 3.2, 1.5, 0.6), DARK, null, null, 0.8);
      // body with top plate
      cel(c, rr(c, -w / 2, -h / 2, w, h, 2.2), DARK, DARK_SH, rr(c, w * 0.15, -h / 2, w, h, 1), 1.15);
      cel(c, rr(c, -w / 2 + 0.6, -h / 2 + 0.5, w - 1.2, 2, 0.8), METAL, null, null, 0.7);
      // hazard plate
      c.save(); rrect(c, -w / 2 + 1, -h / 2 + 3, w - 2, 2.6, 0.6); c.clip();
      c.fillStyle = '#ffcc33'; c.fillRect(-w / 2, -h / 2 + 2, w, 5);
      c.fillStyle = OL; for (let i = -2; i < 7; i++) { c.beginPath(); c.moveTo(-w / 2 + i * 2.6, -h / 2 + 6); c.lineTo(-w / 2 + i * 2.6 + 1.3, -h / 2 + 6); c.lineTo(-w / 2 + i * 2.6 + 3, -h / 2 + 2.5); c.lineTo(-w / 2 + i * 2.6 + 1.7, -h / 2 + 2.5); c.closePath(); c.fill(); }
      c.restore();
      rrect(c, -w / 2 + 1, -h / 2 + 3, w - 2, 2.6, 0.6); c.strokeStyle = OL; c.lineWidth = 0.6; c.stroke();
      // gauge + lamp + vents
      cel(c, circ(c, 2.4, 2.4, 2.3), SHELL, null, null, 0.85);
      c.strokeStyle = full ? '#e53935' : OL; c.lineWidth = 0.7;
      const ga = Math.PI * (0.8 + fill * 1.4);
      c.beginPath(); c.moveTo(2.4, 2.4); c.lineTo(2.4 + Math.cos(ga) * 1.8, 2.4 + Math.sin(ga) * 1.8); c.stroke();
      c.fillStyle = full ? (Math.sin(time * 10) > 0 ? '#ff5a4f' : '#7a1f1a') : '#7dff8a'; c.beginPath(); c.arc(-3.6, 1.4, 0.95, 0, 6.28); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.5; c.stroke();
      c.fillStyle = '#1a2026'; for (let i = 0; i < 3; i++) c.fillRect(-4.6, 3.2 + i * 1.1, 3.4, 0.55);
    } else {
      const w = 10.6, h = 13.4;
      // canister body
      cel(c, rr(c, -w / 2, -h / 2, w, h, 3.6), METAL, METAL_SH, rr(c, w * 0.18, -h / 2, w, h, 1.4), 1.15);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-w / 2 + 1.2, -h / 2 + 2.4, 0.8, h - 4.8);
      // bands with rivets
      for (const by of [-h / 2 + 1.6, h / 2 - 3]) {
        cel(c, rr(c, -w / 2 - 0.3, by, w + 0.6, 1.5, 0.6), DARK, null, null, 0.75);
        for (let i = 0; i < 4; i++) bolt(c, -w / 2 + 1.5 + i * (w - 3) / 3, by + 0.75, 0.3);
      }
      // lid with valve wheel
      cel(c, rr(c, -w / 2 + 0.6, -h / 2 - 1.8, w - 1.2, 2.4, 1.1), TEAL, TEAL_SH, rr(c, w * 0.15, -h / 2 - 1.8, w, 2.4, 1), 1);
      seg(c, 2.2, -h / 2 - 1.9, 2.2, -h / 2 - 3.2, 0.9, METAL, METAL_SH, 0.6);
      cel(c, ell(c, 2.2, -h / 2 - 3.4, 1.6, 0.75), METAL_SH, null, null, 0.8);
      bolt(c, 2.2, -h / 2 - 3.4, 0.35);
      // window with the load
      const wx = -2.4, wy = -h / 2 + 3.6, ww = 4.8, wh = h - 7.6;
      cel(c, rr(c, wx - 0.6, wy - 0.6, ww + 1.2, wh + 1.2, 1.8), DARK, null, null, 0.8);
      cel(c, rr(c, wx, wy, ww, wh, 1.4), '#1d2a30', null, null, 0.6);
      if (fill > 0.02) {
        c.save(); rrect(c, wx, wy, ww, wh, 1.4); c.clip();
        const tp = wy + wh * (1 - fill);
        c.fillStyle = '#5b4a7a'; c.fillRect(wx, tp, ww, wh);
        for (let i = 0; i < 8; i++) { c.fillStyle = MAT_COLS[i % 6]; c.fillRect(wx + ((i * 37) % 10) / 10 * ww - 0.6, tp + ((i * 53) % 10) / 10 * (wy + wh - tp), 1.5, 1.2); }
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(wx + 0.6, wy + 0.6, 0.7, wh - 1.2);
      if (full) { c.fillStyle = Math.sin(time * 10) > 0 ? '#ff5a4f' : '#7a1f1a'; c.beginPath(); c.arc(-w / 2 + 2, -h / 2 - 2.4, 1.1, 0, 6.28); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.6; c.stroke(); }
    }
    c.restore();
  };

  // ------------------------------------------------------------------ arm boom + tool
  const arm = () => {
    const sway = o.moving ? Math.sin(walk) * 0.12 : Math.sin(time * 1.6) * 0.05;
    let sx: number, sy: number, a1: number, a2: number, a3: number;
    if (side) { sx = 2; sy = top + PH * 0.6; a1 = -0.85 - k * 0.5 + sway; a2 = -1.35 + k * 0.25; a3 = -0.95 + k * 0.35; }
    else if (back) { sx = PW / 2 - 0.5; sy = top + PH * 0.5; a1 = -1.05 + k * 0.5 - sway; a2 = -0.25 + k * 0.45; a3 = -0.15 + k * 0.3; }
    else { sx = -PW / 2 + 0.5; sy = top + PH * 0.5; a1 = 1.05 - k * 0.5 + sway; a2 = 0.25 - k * 0.45; a3 = 0.15 - k * 0.3; }
    const L1 = 5.6, L2 = 4.6 + k * 1.8;
    const ex = sx - Math.sin(a1) * L1, ey = sy + Math.cos(a1) * L1;
    const wx = ex - Math.sin(a2) * L2, wy = ey + Math.cos(a2) * L2;
    // upper arm with a hydraulic cylinder along it
    seg(c, sx, sy, ex, ey, 3.8, ORANGE, ORANGE_SH, 1);
    const ux = (ex - sx) / L1, uy = (ey - sy) / L1, px = -uy, py = ux;
    const off = 2.3;
    seg(c, sx + px * off + ux * 0.6, sy + py * off + uy * 0.6, sx + px * off + ux * 2.8, sy + py * off + uy * 2.8, 1.5, DARK, DARK_SH, 0.7);
    tube(c, [sx + px * off + ux * 3, sy + py * off + uy * 3, ex + px * 1.2, ey + py * 1.2], 0.7, '#eef3f6');
    // forearm + joints
    seg(c, ex, ey, wx, wy, 2.9, METAL, METAL_SH, 0.95);
    joint(c, ex, ey, 2.1, DARK);
    joint(c, sx, sy, 3, TEAL);
    c.save(); c.translate(wx, wy); c.rotate(a3); c.scale(0.95, 0.95);
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
  // wrist collar shared by every attachment
  const collar = () => { cel(c, rr(c, -2.8, -1.4, 5.6, 3.2, 1.2), DARK, DARK_SH, rr(c, -2.8, 0.2, 5.6, 1.6, 0.6), 0.95); bolt(c, -1.6, 0.2, 0.35); bolt(c, 1.6, 0.2, 0.35); };
  switch (tier) {
    case 0: { // factory pincer: two thick curved jaws with teeth
      cel(c, rr(c, -3.2, 1.4, 6.4, 3.6, 1.6), METAL, METAL_SH, rr(c, -3.2, 3, 6.4, 2, 0.8), 0.95);
      collar();
      const open = 0.12 + (1 - k) * 0.5;
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 1.3, 4.6); c.rotate(s * -open);
        const jaw = () => { c.beginPath(); c.moveTo(s * -0.8, -0.2); c.bezierCurveTo(s * 6, 0.6, s * 5.6, 8, s * 0.2, 10.4); c.lineTo(s * -1, 8.8); c.bezierCurveTo(s * 2.4, 6.6, s * 2.2, 3, s * -1.6, 2.2); c.closePath(); };
        cel(c, jaw, TEAL, TEAL_SH, () => { c.beginPath(); c.ellipse(s * 3, 5, 2.2, 5, 0, 0, 6.28); }, 1);
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(s * 1.6, 2.6, 0.5, 1.4, s * -0.5, 0, 6.28); c.fill();
        // teeth on the inner edge
        c.fillStyle = METAL; c.strokeStyle = OL; c.lineWidth = 0.45;
        for (const ty of [3.6, 5.6]) { c.beginPath(); c.moveTo(s * 1.1, ty - 0.8); c.lineTo(s * -0.4, ty); c.lineTo(s * 1.1, ty + 0.8); c.closePath(); c.fill(); c.stroke(); }
        c.restore();
      }
      joint(c, 0, 3.4, 1.5, ORANGE);
      break;
    }
    case 1: { // telescopic scoop: nested tubes + bucket with rim and teeth
      const ext = k * 5;
      cel(c, rr(c, -2.3, 0, 4.6, 5.6, 1.2), METAL, METAL_SH, rr(c, 0.6, 0, 1.7, 5.6, 0.6), 0.95);
      cel(c, rr(c, -2.6, 4.4, 5.2, 1.3, 0.5), DARK, null, null, 0.7);
      cel(c, rr(c, -1.8, 5.6, 3.6, 3.4 + ext * 0.5, 1), '#c9d4dc', METAL_SH, rr(c, 0.5, 5.6, 1.3, 4 + ext, 0.5), 0.9);
      cel(c, rr(c, -2.1, 8.4 + ext * 0.5, 4.2, 1.1, 0.4), DARK, null, null, 0.65);
      cel(c, rr(c, -1.3, 9.4 + ext * 0.5, 2.6, 1.8 + ext * 0.5, 0.7), '#eef3f6', null, null, 0.8);
      collar();
      const b = 11 + ext;
      const bucket = () => { c.beginPath(); c.moveTo(-4.8, b); c.lineTo(4.8, b); c.lineTo(4.2, b + 4.8); c.quadraticCurveTo(0, b + 7.2, -4.2, b + 4.8); c.closePath(); };
      cel(c, bucket, ORANGE, ORANGE_SH, () => { c.fillRect(1.2, b, 5, 8); }, 1.1);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-3.6, b + 1.6, 0.7, 2.6);
      // opening seen from above + thick rim
      c.fillStyle = '#3a2416'; ellipse(c, 0, b + 0.5, 4.2, 1.1); c.fill();
      cel(c, rr(c, -5.3, b - 0.9, 10.6, 1.8, 0.8), DARK, null, null, 0.9);
      bolt(c, -3.8, b, 0.3); bolt(c, 3.8, b, 0.3);
      // teeth along the lip
      c.fillStyle = METAL; c.strokeStyle = OL; c.lineWidth = 0.5;
      for (let i = 0; i < 4; i++) { const tx = -2.7 + i * 1.8; const ty = b + 5.6 - Math.abs(tx) * 0.25; c.beginPath(); c.moveTo(tx - 0.7, ty - 0.6); c.lineTo(tx + 0.7, ty - 0.6); c.lineTo(tx, ty + 1); c.closePath(); c.fill(); c.stroke(); }
      break;
    }
    case 2: { // hydraulic claw: cylinder, chrome rod, hub and three jointed fingers
      cel(c, rr(c, -2.7, 0, 5.4, 6.8, 1.7), ORANGE, ORANGE_SH, rr(c, 0.8, 0, 1.9, 6.8, 0.8), 1);
      c.save(); rrect(c, -2.7, 4.2, 5.4, 1.5, 0.4); c.clip(); c.fillStyle = '#ffcc33'; c.fillRect(-3, 4, 6, 2); c.fillStyle = OL; for (let i = -1; i < 4; i++) c.fillRect(-2.6 + i * 1.6, 4, 0.7, 2); c.restore();
      collar();
      const rod = 1.4 + k * 3.6;
      cel(c, rr(c, -0.85, 6.4, 1.7, rod + 0.8, 0.6), '#f1f6f9', null, null, 0.7);
      const e = 7 + rod;
      const open = (1 - k) * 0.6 + 0.12;
      const finger = (ang: number, len: number) => {
        const bx = Math.sin(ang) * 2.2, by = e + 1 + Math.cos(ang) * 2.2;
        const kx = bx + Math.sin(ang) * len, ky = by + Math.cos(ang) * len;
        const curl = -Math.sign(ang || 0.0001) * (0.9 - open * 0.6);
        const tipA = ang + curl;
        const tx = kx + Math.sin(tipA) * (len * 0.9), ty = ky + Math.cos(tipA) * (len * 0.9);
        seg(c, bx, by, kx, ky, 2.2, METAL, METAL_SH, 0.85);
        taper(c, kx, ky, tx, ty, 2, 0.6, DARK, DARK_SH);
        joint(c, kx, ky, 1, ORANGE);
      };
      finger(0, 2.6);
      finger(-open - 0.25, 3.2); finger(open + 0.25, 3.2);
      joint(c, 0, e + 1, 2.7, DARK);
      break;
    }
    case 3: { // ionic vacuum: corrugated hose + bell nozzle with a glowing ring
      for (let i = 0; i < 5; i++) cel(c, rr(c, -2.6, 0.8 + i * 1.35, 5.2, 1.8, 0.9), i % 2 ? '#56636f' : '#3e4852', null, null, 0.75);
      collar();
      const bell = () => { c.beginPath(); c.moveTo(-2.4, 7.4); c.lineTo(2.4, 7.4); c.quadraticCurveTo(3.4, 11, 6, 13.4); c.lineTo(-6, 13.4); c.quadraticCurveTo(-3.4, 11, -2.4, 7.4); c.closePath(); };
      cel(c, bell, SHELL, SHELL_SH, () => { c.fillRect(1.2, 6, 6, 9); }, 1.1);
      cel(c, rr(c, -2.8, 7.4, 5.6, 1.8, 0.7), ORANGE, ORANGE_SH, null, 0.8);
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-3.4, 10.2, 0.7, 2);
      cel(c, ell(c, 0, 13.4, 6, 1.9), DARK, null, null, 1.1);
      c.fillStyle = SCREEN; ellipse(c, 0, 13.5, 4.6, 1.3); c.fill();
      const p = 0.6 + Math.sin(time * 12) * 0.25 + k * 0.4;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(110,250,255,${0.9 * p})`; c.lineWidth = 1; ellipse(c, 0, 13.4, 4.9, 1.45); c.stroke();
      c.fillStyle = rad(c, 0, 13.4, 0, 9, [[0, `rgba(110,250,255,${0.35 * p})`], [1, 'rgba(110,250,255,0)']]);
      c.beginPath(); c.moveTo(-4.6, 13.4); c.lineTo(4.6, 13.4); c.lineTo(7.5, 21); c.lineTo(-7.5, 21); c.closePath(); c.fill();
      // particles drawn into the mouth
      c.fillStyle = `rgba(200,255,255,${0.8 * p})`;
      for (let i = 0; i < 4; i++) { const t = (time * 1.6 + i * 0.25) % 1; c.fillRect((i - 1.5) * 3.4 * (1 - t), 21 - t * 7.5, 0.9, 0.9); }
      c.restore();
      break;
    }
    case 4: { // magnetic horseshoe with field arcs
      cel(c, rr(c, -1.3, 0, 2.6, 5.4, 0.8), METAL, METAL_SH, rr(c, 0.3, 0, 1, 5.4, 0.4), 0.85);
      collar();
      const cy = 9.6, R = 4.6;
      const f = (time * 1.6) % 1;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const ff = (f + i * 0.5) % 1;
        c.strokeStyle = `rgba(150,180,255,${0.6 * (1 - ff)})`; c.lineWidth = 0.9;
        c.beginPath(); c.arc(0, cy + 5.4, R + ff * 4, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
      }
      c.restore();
      const shoe = () => { c.beginPath(); c.arc(0, cy, R, Math.PI, Math.PI * 2); c.lineTo(R, cy + 4.2); c.moveTo(-R, cy + 4.2); c.lineTo(-R, cy); };
      c.lineCap = 'butt';
      shoe(); c.strokeStyle = OL; c.lineWidth = 5; c.stroke();
      shoe(); c.strokeStyle = '#e23b3b'; c.lineWidth = 3.4; c.stroke();
      c.strokeStyle = '#a21f1f'; c.lineWidth = 1.2; c.beginPath(); c.arc(0.4, cy + 0.6, R, Math.PI * 1.2, Math.PI * 1.9); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.7; c.beginPath(); c.arc(-0.3, cy - 0.3, R, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
      c.lineCap = 'round';
      for (const s of [-1, 1]) {
        cel(c, rr(c, s * R - 2.1, cy + 3.6, 4.2, 3, 0.7), '#e9eef2', METAL_SH, rr(c, s * R + 0.3, cy + 3.6, 1.8, 3, 0.4), 0.95);
        c.fillStyle = shade(s < 0 ? '#60a5fa' : '#e23b3b', 0, 0.85); c.fillRect(s * R - 1.6, cy + 5.6, 3.2, 0.7);
      }
      break;
    }
    case 5: { // shredder: hazard housing + toothed drum
      const hood = () => { c.beginPath(); c.moveTo(-5.2, 5.6); c.lineTo(-5.2, 2.2); c.quadraticCurveTo(-5.2, 0, -3, 0); c.lineTo(3, 0); c.quadraticCurveTo(5.2, 0, 5.2, 2.2); c.lineTo(5.2, 5.6); c.closePath(); };
      cel(c, hood, ORANGE, ORANGE_SH, () => { c.fillRect(1.5, 0, 5, 6); }, 1.1);
      c.save(); rrect(c, -4.4, 2.2, 8.8, 1.8, 0.5); c.clip();
      c.fillStyle = '#ffcc33'; c.fillRect(-5, 2, 10, 2.4); c.fillStyle = OL;
      for (let i = -2; i < 5; i++) { c.beginPath(); c.moveTo(-5 + i * 2.4, 4.2); c.lineTo(-4 + i * 2.4, 4.2); c.lineTo(-2.6 + i * 2.4, 2); c.lineTo(-3.6 + i * 2.4, 2); c.closePath(); c.fill(); }
      c.restore();
      collar();
      // drum
      const drum = rr(c, -4.6, 5, 9.2, 7, 3.2);
      cel(c, drum, '#47525d', DARK, rr(c, 1.2, 5, 3.4, 7, 1.4), 1.1);
      c.save(); rrect(c, -4.6, 5, 9.2, 7, 3.2); c.clip();
      const off = (time * 14) % 2.8;
      c.fillStyle = '#dfe5e9'; c.strokeStyle = OL; c.lineWidth = 0.45;
      for (let r = -1; r < 4; r++) {
        const yy = 5 + r * 2.8 + off;
        for (let i = 0; i < 4; i++) { const tx = -3.6 + i * 2.4 + (r % 2 ? 1.2 : 0); c.beginPath(); c.moveTo(tx - 0.8, yy + 0.8); c.lineTo(tx + 0.8, yy + 0.8); c.lineTo(tx, yy - 0.6); c.closePath(); c.fill(); c.stroke(); }
      }
      c.restore();
      for (const sx of [-1, 1]) joint(c, sx * 4.8, 8.5, 1.4, METAL_SH);
      // teeth biting below
      c.fillStyle = '#dfe5e9';
      for (let i = 0; i < 4; i++) { const tx = -2.7 + i * 1.8; c.beginPath(); c.moveTo(tx - 0.8, 11.6); c.lineTo(tx + 0.8, 11.6); c.lineTo(tx, 13.4 + Math.sin(time * 20 + i) * 0.3); c.closePath(); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.5; c.stroke(); }
      break;
    }
    case 6: { // tractor-beam emitter: dish, prongs, lens and a beam cone
      const beam = 0.35 + k * 0.6 + Math.sin(time * 5) * 0.06;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = rad(c, 0, 12, 0, 12, [[0, `rgba(120,250,255,${0.55 * beam})`], [1, 'rgba(120,250,255,0)']]);
      c.beginPath(); c.moveTo(-1.6, 12); c.lineTo(1.6, 12); c.lineTo(7.5, 24); c.lineTo(-7.5, 24); c.closePath(); c.fill();
      c.restore();
      glow(c, 0, 10, 9 + k * 3, '#00e5ff', 0.4);
      cel(c, rr(c, -2, 0, 4, 4.6, 1.2), DARK, DARK_SH, rr(c, 0.6, 0, 1.4, 4.6, 0.6), 0.95);
      for (const s of [-1, 1]) cel(c, () => { c.beginPath(); c.moveTo(s * 2, 1); c.lineTo(s * 5.2, 3.6); c.lineTo(s * 4.4, 5.2); c.lineTo(s * 2, 4.2); c.closePath(); }, ORANGE, ORANGE_SH, null, 0.85);
      collar();
      // dish
      cel(c, ell(c, 0, 6.6, 6.2, 2.4), SHELL, SHELL_SH, ell(c, 1.5, 7.4, 6, 2), 1.1);
      c.fillStyle = rad(c, 0, 6.8, 0, 5, [[0, '#a5f3fc'], [0.6, '#2a6f7e'], [1, '#17323a']]);
      ellipse(c, 0, 6.9, 4.6, 1.6); c.fill();
      // prongs to the lens
      for (const s of [-1, 0, 1]) tube(c, [s * 3.6, 6.8, s * 0.9, 11.2], 0.75, METAL);
      cel(c, circ(c, 0, 11.6, 2.1), '#c7fbff', '#7ee7f2', circ(c, 0.7, 12.3, 1.7), 1);
      c.fillStyle = '#00e5ff'; c.beginPath(); c.arc(0, 11.6, 1.1 + Math.sin(time * 10) * 0.25, 0, 6.28); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-0.7, 10.9, 0.45, 0, 6.28); c.fill();
      c.save(); c.translate(0, 11.6); c.rotate(time * 3);
      c.strokeStyle = 'rgba(140,250,255,0.9)'; c.lineWidth = 0.8; ellipse(c, 0, 0, 4.6, 1.5); c.stroke();
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
