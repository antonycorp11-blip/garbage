import { TILE } from '../core/constants';
import { Game } from '../game/Game';
import { ellipse, groundShadow, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const OL = '#2a1a10';
const SKIN = '#f2b98b', SKIN_SH = '#d48e62';
const VEST = '#ff8a1e', VEST_SH = '#d9620b';
const SHIRT = '#2f7f8f', SHIRT_SH = '#215c69';
const PANTS = '#34425f', PANTS_SH = '#252f45';
const BOOT = '#5a3a22', BOOT_SH = '#3b2514';
const GLOVE = '#f4c84a', GLOVE_SH = '#c99a22';
const CAP = '#2f8a57', CAP_SH = '#1f6340';
const HAIR = '#5a3420';

type PathFn = () => void;
/** Cartoon cel-shaded part: base fill, shadow clipped inside, dark outline. */
function cel(c: C, path: PathFn, base: string, shadow: string | null, shadowShape: PathFn | null, lw = 1.1) {
  path(); c.fillStyle = base; c.fill();
  if (shadow && shadowShape) { c.save(); path(); c.clip(); shadowShape(); c.fillStyle = shadow; c.fill(); c.restore(); }
  path(); c.strokeStyle = OL; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke();
}
const rr = (c: C, x: number, y: number, w: number, h: number, r: number) => () => rrect(c, x, y, w, h, r);
const circ = (c: C, x: number, y: number, r: number) => () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const ell = (c: C, x: number, y: number, rx: number, ry: number, rot = 0) => () => ellipse(c, x, y, rx, ry, rot);

/** Draws the scavenger at its feet position. Fully procedural, animated. */
export function drawPlayer(c: C, g: Game, time: number) {
  const p = g.player;
  drawWorker(c, p.x, p.y, time, {
    facing: p.facing, moving: p.moving, walk: p.walk, action: p.action, tier: g.toolTier,
    bagLvl: g.upgrades.c_bag || 0, fill: g.d.capacity ? p.carried / g.d.capacity : 0, crown: !!g.flags.crown,
  });
}

export interface WorkerPose { facing: string; moving: boolean; walk: number; action: number; tier: number; bagLvl: number; fill: number; crown: boolean }

export function drawWorker(c: C, x: number, y: number, time: number, o: WorkerPose) {
  const dir = o.facing;
  const side = dir === 'left' || dir === 'right';
  const walk = o.moving ? o.walk : 0;
  const sw = Math.sin(walk);
  const bob = o.moving ? Math.abs(Math.cos(walk)) * 1.2 : Math.sin(time * 2.4) * 0.3;
  const k = o.action > 0 ? Math.sin(o.action * Math.PI) : 0;
  const blink = (time % 3.6) < 0.13;
  const bagS = 1 + Math.min(0.7, o.bagLvl * 0.05) + o.fill * 0.08;
  const bagCol = o.bagLvl >= 9 ? '#5d6b3a' : o.bagLvl >= 4 ? '#8a6a32' : '#8b6b45';

  groundShadow(c, x, y + 0.5, 10, 4, 0.42);
  if (o.tier >= 6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y - 12, 0, 26, [[0, 'rgba(0,229,255,0.22)'], [1, 'rgba(0,229,255,0)']]);
    c.beginPath(); c.arc(x, y - 12, 26, 0, 6.28); c.fill();
    c.restore();
  }
  c.save();
  c.translate(x, y - bob);
  if (dir === 'left') c.scale(-1, 1);

  // ------------------------------------------------------------- shared parts
  const boot = (bx: number, by: number, w: number, fwd: number) => {
    cel(c, rr(c, bx - w / 2 + fwd, by - 3.2, w, 3.6, 1.6), BOOT, BOOT_SH, rr(c, bx - w / 2 + fwd, by - 1.2, w, 2, 0.5), 1);
  };
  const glove = (gx: number, gy: number) => cel(c, circ(c, gx, gy, 2.3), GLOVE, GLOVE_SH, circ(c, gx + 0.9, gy + 0.9, 1.8), 1);
  const arm = (sx: number, sy: number, ang: number, len: number, far: boolean, withTool: boolean) => {
    c.save(); c.translate(sx, sy); c.rotate(ang);
    cel(c, rr(c, -2, -1.5, 4, 5.5, 2), far ? SHIRT_SH : SHIRT, far ? null : SHIRT_SH, rr(c, 0.6, -1.5, 2, 5.5, 1), 1);
    cel(c, rr(c, -1.6, 3, 3.2, len - 3, 1.6), far ? SKIN_SH : SKIN, far ? null : SKIN_SH, rr(c, 0.5, 3, 1.4, len - 3, 0.6), 1);
    glove(0, len + 0.4);
    if (withTool) { c.translate(0, len + 0.4); drawTool(c, o.tier, o.action, time, side); }
    c.restore();
  };
  const bedroll = (bx: number, by: number, w: number) => {
    if (o.bagLvl < 3) return;
    cel(c, rr(c, bx, by, w, 4.2, 2.1), '#b8503c', '#8a3426', rr(c, bx, by + 2.4, w, 1.8, 0.6), 1);
    c.fillStyle = OL; c.fillRect(bx + w * 0.25, by, 0.9, 4.2); c.fillRect(bx + w * 0.7, by, 0.9, 4.2);
  };
  const contents = (bx: number, by: number, w: number) => {
    if (o.fill < 0.25) return;
    const n = Math.min(5, Math.ceil(o.fill * 5));
    const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'];
    for (let i = 0; i < n; i++) {
      c.save(); c.translate(bx + 1.5 + i * (w - 3) / 4.5, by + 1); c.rotate(-0.5 + i * 0.25);
      cel(c, rr(c, -1.1, -3, 2.2, 3.8, 0.7), cols[i], null, null, 0.7);
      c.restore();
    }
  };
  const head = (hx: number) => {
    const hy = -25;
    if (dir === 'down') { cel(c, circ(c, -7.2, -24, 1.7), SKIN, null, null, 1); cel(c, circ(c, 7.2, -24, 1.7), SKIN, null, null, 1); }
    cel(c, circ(c, hx, hy, 7.6), SKIN, SKIN_SH, () => { c.beginPath(); c.arc(hx + 3.5, hy + 3.5, 7.2, 0, 6.28); }, 1.2);
    if (dir === 'up') {
      // back of the head: hair
      cel(c, () => { c.beginPath(); c.arc(hx, hy, 7.6, 0, Math.PI * 2); }, HAIR, '#3e2214', () => { c.beginPath(); c.arc(hx + 3, hy + 3, 6, 0, 6.28); }, 1.2);
    } else if (dir === 'down') {
      // hair tufts at the temples
      c.fillStyle = HAIR;
      c.beginPath(); c.moveTo(-7.4, -26); c.lineTo(-5.4, -21.8); c.lineTo(-4.4, -25.6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(7.4, -26); c.lineTo(5.4, -21.8); c.lineTo(4.4, -25.6); c.closePath(); c.fill();
      // eyes
      if (blink) { c.strokeStyle = OL; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-3.6, -23); c.lineTo(-1.6, -23); c.moveTo(1.6, -23); c.lineTo(3.6, -23); c.stroke(); }
      else {
        for (const ex of [-2.6, 2.6]) {
          c.fillStyle = OL; ellipse(c, ex, -23, 1.15, 1.65); c.fill();
          c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 0.4, -23.6, 0.45, 0, 6.28); c.fill();
        }
      }
      c.strokeStyle = HAIR; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-3.8, -25.4); c.quadraticCurveTo(-2.6, -26.1, -1.5, -25.5); c.moveTo(1.5, -25.5); c.quadraticCurveTo(2.6, -26.1, 3.8, -25.4); c.stroke();
      c.fillStyle = 'rgba(232,96,80,0.45)'; ellipse(c, -4.4, -20.8, 1.4, 0.9); c.fill(); ellipse(c, 4.4, -20.8, 1.4, 0.9); c.fill();
      c.strokeStyle = OL; c.lineWidth = 0.8; c.beginPath();
      if (o.fill >= 1) c.arc(0, -18.6, 1.3, Math.PI + 0.5, -0.5); else c.arc(0, -20.6, 1.5, 0.3, Math.PI - 0.3);
      c.stroke();
    } else {
      // profile
      cel(c, circ(c, hx - 1.6, -24, 1.7), SKIN, null, null, 1);
      c.fillStyle = HAIR; c.beginPath(); c.moveTo(hx - 7.4, -26); c.quadraticCurveTo(hx - 7.6, -20, hx - 3.6, -19.8); c.lineTo(hx - 3.4, -26); c.closePath(); c.fill();
      cel(c, circ(c, hx + 7.4, -22.4, 1.5), SKIN, null, null, 1);
      if (blink) { c.strokeStyle = OL; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx + 2.6, -23); c.lineTo(hx + 4.6, -23); c.stroke(); }
      else { c.fillStyle = OL; ellipse(c, hx + 3.6, -23, 1.1, 1.6); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 4, -23.6, 0.45, 0, 6.28); c.fill(); }
      c.strokeStyle = HAIR; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx + 2.4, -25.4); c.quadraticCurveTo(hx + 3.6, -26.1, hx + 4.9, -25.4); c.stroke();
      c.fillStyle = 'rgba(232,96,80,0.45)'; ellipse(c, hx + 3.6, -20.6, 1.4, 0.9); c.fill();
      c.strokeStyle = OL; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx + 4.6, -19.8); c.quadraticCurveTo(hx + 5.6, -19.4, hx + 6.2, -20.1); c.stroke();
    }
    // cap
    const capPath = () => { c.beginPath(); c.moveTo(hx - 7.9, -25.6); c.bezierCurveTo(hx - 8, -35.5, hx + 8, -35.5, hx + 7.9, -25.6); c.quadraticCurveTo(hx, -27.4, hx - 7.9, -25.6); c.closePath(); };
    cel(c, capPath, CAP, CAP_SH, () => { c.beginPath(); c.arc(hx + 6, -27, 6.5, 0, 6.28); }, 1.2);
    c.fillStyle = 'rgba(255,255,255,0.28)'; ellipse(c, hx - 3, -31.4, 2.2, 1, -0.4); c.fill();
    if (dir === 'down') {
      cel(c, ell(c, hx, -25.8, 8.4, 2.2), CAP_SH, null, null, 1.1);
      cel(c, circ(c, hx, -29.8, 1.6), '#ffd54f', null, null, 0.8);
    } else if (dir === 'up') {
      c.fillStyle = OL; c.fillRect(hx - 2.2, -27, 4.4, 1.3);
    } else {
      cel(c, () => { c.beginPath(); c.moveTo(hx + 3, -26.6); c.quadraticCurveTo(hx + 10, -27.4, hx + 12.4, -25.4); c.quadraticCurveTo(hx + 9, -24.4, hx + 3, -25); c.closePath(); }, CAP_SH, null, null, 1.1);
      cel(c, circ(c, hx + 3.2, -29.6, 1.4), '#ffd54f', null, null, 0.8);
    }
    if (o.crown) {
      c.save(); c.translate(hx, -33);
      cel(c, () => { c.beginPath(); c.moveTo(-5, 0); c.lineTo(-5.4, -6); c.lineTo(-2.6, -3.2); c.lineTo(0, -7.4); c.lineTo(2.6, -3.2); c.lineTo(5.4, -6); c.lineTo(5, 0); c.closePath(); }, '#ffd54f', '#d4a017', () => { c.fillRect(-6, -1.6, 12, 2); }, 1);
      c.fillStyle = '#e53935'; c.beginPath(); c.arc(0, -2.6, 0.9, 0, 6.28); c.fill();
      c.restore();
    }
    if (o.fill >= 1 && dir !== 'up') {
      const t = (time * 1.3) % 1;
      c.fillStyle = `rgba(140,205,255,${1 - t})`; c.beginPath(); c.ellipse(hx + (side ? -5 : 6.5), -27 + t * 6, 0.9, 1.4, 0, 0, 6.28); c.fill();
    }
  };
  const vestStripe = (x0: number, w: number) => { c.fillStyle = '#fff6c9'; c.fillRect(x0, -12.8, w, 1.8); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x0, -11.4, w, 0.4); };

  if (side) {
    // ============================== PROFILE (facing right) ==============================
    const legA = sw * 0.55;
    // far arm (behind)
    arm(-1, -16.5, -legA * 0.8 + 0.1, 8, true, false);
    // backpack attached to the back
    const bw = 6.6 * bagS, bh = 12.5 * bagS;
    const bx = -4.2 - bw, by = -20.5 - (bh - 12.5) * 0.4;
    bedroll(bx - 0.6, by - 3.6, bw + 1.2);
    cel(c, rr(c, bx, by, bw, bh, 2.8), bagCol, shade(bagCol, -0.3), rr(c, bx, by + bh * 0.55, bw, bh, 2), 1.15);
    cel(c, rr(c, bx - 0.8, by + bh * 0.45, 3, bh * 0.4, 1.2), shade(bagCol, -0.12), null, null, 0.9);
    contents(bx, by, bw);
    if (o.tier === 3) cel(c, rr(c, bx + 0.6, by - 8, bw - 1.2, 9, 2.6), '#e53935', '#a51d1d', rr(c, bx + bw * 0.55, by - 8, bw, 9, 1), 1);
    // legs rotate around the hip
    const legSide = (a: number, far: boolean) => {
      c.save(); c.translate(0, -8.5); c.rotate(-a);
      cel(c, rr(c, -2.1, -0.5, 4.2, 7, 1.8), far ? PANTS_SH : PANTS, far ? null : PANTS_SH, rr(c, 0.8, -0.5, 1.6, 7, 0.6), 1);
      c.translate(0, 8.5);
      boot(0, 0, 6, 1.2);
      c.restore();
    };
    legSide(-legA, true); legSide(legA, false);
    // torso
    cel(c, rr(c, -5, -18.4, 10.4, 11, 3.6), VEST, VEST_SH, rr(c, 1.6, -18.4, 4, 11, 1), 1.15);
    vestStripe(-4.6, 9.6);
    cel(c, rr(c, -5.2, -8.6, 10.8, 2, 1), '#4a2c18', null, null, 0.9);
    cel(c, rr(c, 1.6, -9, 3, 2.8, 0.8), '#ffcc00', null, null, 0.8);
    // strap over the shoulder
    c.strokeStyle = '#5a3a20'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4.2, -18); c.quadraticCurveTo(0.5, -18.6, 0.2, -9.5); c.stroke();
    // near arm + tool
    const reach = side ? -k * 1.5 : 0;
    arm(0.6, -16.5, legA * 0.8 - 0.1 + reach, 8 + k * 2, false, true);
    head(0.6);
  } else if (dir === 'down') {
    // ============================== FRONT ==============================
    const bw = 17 * bagS;
    cel(c, rr(c, -bw / 2, -20.5, bw, 12, 3.4), bagCol, shade(bagCol, -0.3), null, 1.1);
    const lift = (s: number) => Math.max(0, s) * 2.2;
    for (const [lx, l] of [[-2.6, lift(sw)], [2.6, lift(-sw)]] as [number, number][]) {
      cel(c, rr(c, lx - 2.2, -9 - l, 4.4, 7.2, 1.8), PANTS, PANTS_SH, rr(c, lx + 0.6, -9 - l, 2, 7.2, 0.6), 1);
      boot(lx, -l, 5.4, 0);
    }
    // torso: shirt + vest panels
    cel(c, rr(c, -7, -18.6, 14, 11.6, 4), SHIRT, SHIRT_SH, rr(c, 2, -18.6, 5, 11.6, 2), 1.15);
    const panel = (x0: number, x1: number) => () => { c.beginPath(); c.moveTo(x0, -18); c.lineTo(x1, -18); c.lineTo(x1 + (x1 > 0 ? 0 : 0), -7.4); c.lineTo(x0, -7.4); c.closePath(); };
    c.save(); rrect(c, -7, -18.6, 14, 11.6, 4); c.clip();
    cel(c, panel(-7.5, -1.1), VEST, null, null, 1);
    cel(c, panel(1.1, 7.5), VEST, VEST_SH, () => { c.fillRect(4.5, -19, 4, 12); }, 1);
    vestStripe(-7, 5.9); vestStripe(1.1, 5.9);
    c.restore();
    rrect(c, -7, -18.6, 14, 11.6, 4); c.strokeStyle = OL; c.lineWidth = 1.15; c.stroke();
    cel(c, rr(c, -5.6, -16.6, 2.6, 2.2, 0.6), VEST_SH, null, null, 0.7);
    // straps
    c.fillStyle = '#5a3a20'; c.fillRect(-5, -18.4, 1.6, 8.5); c.fillRect(3.4, -18.4, 1.6, 8.5);
    cel(c, rr(c, -7.2, -9, 14.4, 2.2, 1), '#4a2c18', null, null, 0.9);
    cel(c, rr(c, -1.2, -9.2, 2.4, 2.6, 0.5), '#e8c766', null, null, 0.7);
    // arms
    arm(-7.2, -16.5, 0.18 + sw * 0.3, 8, false, false);
    arm(7.2, -16.5, -0.18 - sw * 0.3 - k * 0.5, 8 + k * 2.5, false, true);
    head(0);
  } else {
    // ============================== BACK ==============================
    const lift = (s: number) => Math.max(0, s) * 2.2;
    for (const [lx, l] of [[-2.6, lift(-sw)], [2.6, lift(sw)]] as [number, number][]) {
      cel(c, rr(c, lx - 2.2, -9 - l, 4.4, 7.2, 1.8), PANTS, PANTS_SH, rr(c, lx + 0.6, -9 - l, 2, 7.2, 0.6), 1);
      boot(lx, -l, 5.4, 0);
    }
    cel(c, rr(c, -7, -18.6, 14, 11.6, 4), VEST, VEST_SH, rr(c, 2.5, -18.6, 5, 11.6, 2), 1.15);
    vestStripe(-6.6, 13.2);
    cel(c, rr(c, -7.2, -9, 14.4, 2.2, 1), '#4a2c18', null, null, 0.9);
    arm(-7.2, -16.5, 0.18 - sw * 0.3, 8, false, false);
    arm(7.2, -16.5, -0.18 + sw * 0.3 - k * 0.4, 8 + k * 2, false, true);
    // big backpack
    const bw = 13 * bagS, bh = 13 * bagS;
    const bx = -bw / 2, by = -19 - (bh - 13) * 0.6;
    head(0);
    bedroll(bx - 1, by - 3, bw + 2);
    cel(c, rr(c, bx, by, bw, bh, 3.4), bagCol, shade(bagCol, -0.3), rr(c, bx + bw * 0.6, by, bw, bh, 2), 1.2);
    cel(c, rr(c, bx + 0.8, by + 0.6, bw - 1.6, bh * 0.38, 2.6), shade(bagCol, 0.15), null, null, 1);
    cel(c, rr(c, -1.1, by + bh * 0.32, 2.2, 1.8, 0.4), '#e8c766', null, null, 0.7);
    cel(c, rr(c, bx + 2, by + bh * 0.58, bw - 4, bh * 0.3, 1.4), shade(bagCol, -0.12), null, null, 0.9);
    contents(bx, by, bw);
    if (o.tier === 3) cel(c, rr(c, bx + 2, by - 9, bw - 4, 10, 3), '#e53935', '#a51d1d', rr(c, bx + bw * 0.6, by - 9, bw, 10, 1), 1);
  }
  c.restore();
}

export function drawTool(c: C, tier: number, act: number, time: number, side: boolean) {
  const k = act > 0 ? Math.sin(act * Math.PI) : 0;
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  // in front/back views tools hang down and slightly outwards
  if (!side) c.rotate(1.25 - k * 0.5);
  const stick = (len: number, w: number, col: string) => cel(c, rr(c, -w / 2, -2, w, len, w / 2), col, shade(col, -0.3), rr(c, 0, -2, w / 2, len, w / 4), 0.9);
  switch (tier) {
    case 0: break;
    case 1: { // shovel
      c.rotate(-0.9 + k * 1.1);
      stick(14, 1.8, '#9a6431');
      cel(c, rr(c, -2.6, -3.6, 5.2, 2, 0.8), '#5d4027', null, null, 0.8);
      cel(c, () => { c.beginPath(); c.moveTo(-3.4, 11); c.lineTo(3.4, 11); c.lineTo(3, 17); c.quadraticCurveTo(0, 19.4, -3, 17); c.closePath(); }, '#c9d2d8', '#8d989e', () => { c.fillRect(0.5, 10, 4, 10); }, 1);
      break;
    }
    case 2: { // grabber
      c.rotate(-1.15 + k * 0.6);
      const len = 15 + k * 9;
      stick(len, 1.9, '#f2a93b');
      cel(c, rr(c, -2.2, -2.5, 4.4, 4, 1), '#37474f', null, null, 0.8);
      const open = 1.4 + (1 - k) * 2.2;
      c.strokeStyle = OL; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(0, len - 1); c.lineTo(-open, len + 2.5); c.lineTo(-0.6, len + 5); c.moveTo(0, len - 1); c.lineTo(open, len + 2.5); c.lineTo(0.6, len + 5); c.stroke();
      c.strokeStyle = '#9aa5ab'; c.lineWidth = 1.2; c.stroke();
      break;
    }
    case 3: { // vacuum nozzle + hose
      c.rotate(-1);
      c.strokeStyle = OL; c.lineWidth = 3.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-4, -8, -6, -14); c.stroke();
      c.strokeStyle = '#4a4f54'; c.lineWidth = 2; c.stroke();
      stick(9, 3, '#e53935');
      cel(c, rr(c, -3.4, 7, 6.8, 3.4, 1.2), '#263238', null, null, 0.9);
      break;
    }
    case 4: { // horseshoe magnet
      c.rotate(-1.4 + Math.sin(time * 8) * 0.05);
      stick(6, 1.8, '#5c6bc0');
      c.strokeStyle = OL; c.lineWidth = 4.6; c.beginPath(); c.arc(0, 8.5, 4, 0, Math.PI); c.stroke();
      c.strokeStyle = '#e53935'; c.lineWidth = 3; c.stroke();
      cel(c, rr(c, -5.6, 5, 3.2, 3.4, 0.6), '#e5e7eb', null, null, 0.8);
      cel(c, rr(c, 2.4, 5, 3.2, 3.4, 0.6), '#e5e7eb', null, null, 0.8);
      break;
    }
    case 5: { // portable shredder
      c.rotate(-1.3);
      cel(c, rr(c, -4.2, 1.5, 8.4, 10, 2.4), '#43a047', '#1f6b25', rr(c, 1, 1.5, 4, 10, 1), 1);
      cel(c, rr(c, -2.6, 3.5, 5.2, 2.4, 0.6), '#263238', null, null, 0.7);
      c.save(); c.translate(0, 13); c.rotate(time * 30);
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); cel(c, rr(c, -0.8, 0, 1.6, 5, 0.6), '#d7dde0', null, null, 0.6); }
      c.restore();
      break;
    }
    case 6: { // advanced gauntlet
      c.rotate(-1.2);
      cel(c, rr(c, -3.2, -1, 6.4, 8.5, 2.4), '#263238', '#11181c', rr(c, 1, -1, 3, 8.5, 1), 1);
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = rad(c, 0, 10.5, 0, 8, [[0, 'rgba(0,229,255,0.9)'], [1, 'rgba(0,229,255,0)']]);
      c.beginPath(); c.arc(0, 10.5, 8, 0, 6.28); c.fill();
      c.restore();
      c.strokeStyle = '#00e5ff'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 10.5, 3 + Math.sin(time * 10), 0, 6.28); c.stroke();
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
