import { TILE } from '../core/constants';
import { Game } from '../game/Game';
import { ellipse, groundShadow, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const OL = '#2a1a10';
// "Lixinho", the scrap robot: warm yellow shell, teal trims, glowing visor face
const SHELL = '#ffc53d', SHELL_SH = '#e0921b', SHELL_HI = '#ffe08a';
const TEAL = '#2bb5a8', TEAL_SH = '#1b7f78';
const METAL = '#9fb0b8', METAL_SH = '#6d7f88';
const VISOR = '#16303a', GLOW = '#6ff6ff';
const TIRE = '#2f3338', TIRE_SH = '#1c1f22';

type PathFn = () => void;
/** Cartoon cel-shaded part: base fill, shadow clipped inside, dark outline. */
function cel(c: C, path: PathFn, base: string, shadow: string | null, shadowShape: PathFn | null, lw = 1.1) {
  path(); c.fillStyle = base; c.fill();
  if (shadow && shadowShape) { c.save(); path(); c.clip(); shadowShape(); c.fillStyle = shadow; c.fill(); c.restore(); }
  path(); c.strokeStyle = OL; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke();
}
const rr = (c: C, x: number, y: number, w: number, h: number, r: number) => () => rrect(c, x, y, w, h, r);
const circ = (c: C, x: number, y: number, r: number) => () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };

/** Draws the scrap robot at its wheel contact point. Fully procedural, animated. */
export function drawPlayer(c: C, g: Game, time: number) {
  const p = g.player;
  drawWorker(c, p.x, p.y, time, {
    facing: p.facing, moving: p.moving, walk: p.walk, action: p.action, tier: g.toolTier,
    bagLvl: g.upgrades.c_bag || 0, fill: g.d.capacity ? p.carried / g.d.capacity : 0, crown: !!g.flags.crown,
    happy: p.collecting,
  });
}

export interface WorkerPose { facing: string; moving: boolean; walk: number; action: number; tier: number; bagLvl: number; fill: number; crown: boolean; happy?: boolean }

export function drawWorker(c: C, x: number, y: number, time: number, o: WorkerPose) {
  const dir = o.facing;
  const side = dir === 'left' || dir === 'right';
  const walk = o.moving ? o.walk : 0;
  const sw = Math.sin(walk);
  // rolling: a light bounce on the wheel; idle: hovering breath
  const bob = o.moving ? Math.abs(Math.sin(walk)) * 1.1 : Math.sin(time * 2.4) * 0.45;
  const k = o.action > 0 ? Math.sin(o.action * Math.PI) : 0;
  const blink = (time % 3.4) < 0.12 || ((time + 1.3) % 7.9) < 0.1;
  const full = o.fill >= 1;
  const happy = !full && (k > 0.05 || !!o.happy);
  const tankS = 1 + Math.min(0.6, o.bagLvl * 0.05);
  const fill = Math.max(0, Math.min(1, o.fill));
  const bulb = full ? '#ff5a4f' : happy ? '#ffe45c' : '#7dff8a';

  groundShadow(c, x, y + 0.5, 12, 4.6, 0.42);
  if (o.tier >= 6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y - 14, 0, 28, [[0, 'rgba(0,229,255,0.22)'], [1, 'rgba(0,229,255,0)']]);
    c.beginPath(); c.arc(x, y - 14, 28, 0, 6.28); c.fill();
    c.restore();
  }
  // dust puffs kicked by the wheel
  if (o.moving) {
    const back = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    for (let i = 0; i < 3; i++) {
      const t = (walk * 0.35 + i / 3) % 1;
      const px = x + back * (5 + t * 9) + (back === 0 ? (i - 1) * 4 * t : 0);
      const py = y - 1 - t * 4 + (dir === 'up' ? -2 : dir === 'down' ? 2 * t : 0);
      c.fillStyle = `rgba(214,190,150,${0.45 * (1 - t)})`;
      c.beginPath(); c.arc(px, py, 1.4 + t * 2.4, 0, 6.28); c.fill();
    }
  }

  c.save();
  c.translate(x, y);
  const S = 1.3;
  const sq = o.moving ? Math.cos(walk * 2) * 0.04 : Math.sin(time * 2.4) * 0.02;
  c.scale(S * (dir === 'left' ? -1 : 1), S);

  // ------------------------------------------------------------- wheel (stays on the ground)
  const wheel = () => {
    if (side) {
      cel(c, circ(c, 0, -3.8, 3.8), TIRE, TIRE_SH, circ(c, 1.2, -2.6, 3.4), 1.1);
      cel(c, circ(c, 0, -3.8, 1.9), METAL, null, null, 0.8);
      c.strokeStyle = OL; c.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) { const a = walk * 1.4 + i * 2.094; c.beginPath(); c.moveTo(0, -3.8); c.lineTo(Math.cos(a) * 1.9, -3.8 + Math.sin(a) * 1.9); c.stroke(); }
    } else {
      cel(c, rr(c, -2.6, -7.6, 5.2, 7.6, 2.4), TIRE, TIRE_SH, rr(c, 0.6, -7.6, 2, 7.6, 1), 1.1);
      // tread marks scrolling
      c.fillStyle = '#4a5057';
      for (let i = 0; i < 3; i++) { const ty = -6.8 + ((walk * 1.6 + i * 2.2) % 6.6); c.fillRect(-1.8, ty, 3.6, 0.7); }
    }
    // fork that holds the wheel
    cel(c, rr(c, -3.4, -9.4, 6.8, 3, 1.2), TEAL, TEAL_SH, rr(c, 0.8, -9.4, 3, 3, 1), 1);
  };

  // everything above the wheel bobs and squashes
  const upper = (fn: () => void) => {
    c.save();
    c.translate(0, -8 - bob);
    c.scale(1 + sq, 1 - sq);
    c.translate(0, 8);
    fn();
    c.restore();
  };

  const hand = (hx: number, hy: number) => {
    cel(c, circ(c, hx, hy, 2.2), TEAL, TEAL_SH, circ(c, hx + 0.9, hy + 0.9, 1.7), 1);
  };
  const arm = (sx: number, sy: number, ang: number, len: number, far: boolean, withTool: boolean) => {
    c.save(); c.translate(sx, sy); c.rotate(ang);
    cel(c, circ(c, 0, 0, 2), far ? METAL_SH : METAL, null, null, 0.9);
    // springy accordion arm
    c.strokeStyle = OL; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0.5); c.lineTo(0, len - 1); c.stroke();
    c.strokeStyle = far ? METAL_SH : METAL; c.lineWidth = 1.4; c.stroke();
    c.strokeStyle = OL; c.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) { const yy = len * (i / 4); c.beginPath(); c.moveTo(-0.9, yy); c.lineTo(0.9, yy); c.stroke(); }
    hand(0, len + 0.4);
    if (withTool) { c.translate(0, len + 0.4); drawTool(c, o.tier, o.action, time, side); }
    c.restore();
  };

  // trash-compactor tank (back) with a window showing the load
  const tank = (tx: number, ty: number, w: number, h: number, window: boolean) => {
    cel(c, rr(c, tx, ty, w, h, 2.6), METAL, METAL_SH, rr(c, tx + w * 0.62, ty, w, h, 1.4), 1.15);
    // lid + hazard band
    cel(c, rr(c, tx - 0.6, ty - 1.4, w + 1.2, 3, 1.2), TEAL, TEAL_SH, rr(c, tx + w * 0.6, ty - 1.4, w, 3, 1), 1);
    if (window) {
      const wx = tx + 2, wy = ty + 3, ww = w - 4, wh = h - 6;
      cel(c, rr(c, wx, wy, ww, wh, 1.4), '#1d2a30', null, null, 0.9);
      if (fill > 0.02) {
        c.save(); rrect(c, wx, wy, ww, wh, 1.4); c.clip();
        const top = wy + wh * (1 - fill);
        const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f', '#f48fb1'];
        c.fillStyle = '#8a6a45'; c.fillRect(wx, top, ww, wh);
        for (let i = 0; i < 9; i++) {
          const bx = wx + ((i * 37) % 10) / 10 * ww, by = top + ((i * 53) % 10) / 10 * (wy + wh - top);
          c.fillStyle = cols[i % cols.length]; c.fillRect(bx - 0.9, by - 0.6, 1.8, 1.3);
        }
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(wx + 0.6, wy + 0.6, 0.8, wh - 1.2);
    }
    if (full) { // blinking "full" lamp
      c.fillStyle = Math.sin(time * 10) > 0 ? '#ff5a4f' : '#7a1f1a';
      c.beginPath(); c.arc(tx + w - 1.6, ty - 2.6, 1.1, 0, 6.28); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.6; c.stroke();
    }
    if (o.tier === 3) cel(c, rr(c, tx + 1, ty - 9, w - 2, 8, 2.6), '#e53935', '#a51d1d', rr(c, tx + w * 0.6, ty - 9, w, 8, 1), 1);
  };

  const body = (bx: number) => {
    // rounded egg torso
    const path = () => { c.beginPath(); c.moveTo(bx - 7, -14); c.bezierCurveTo(bx - 7.4, -20, bx + 7.4, -20, bx + 7, -14); c.bezierCurveTo(bx + 7.2, -8.6, bx + 4, -7.6, bx, -7.6); c.bezierCurveTo(bx - 4, -7.6, bx - 7.2, -8.6, bx - 7, -14); c.closePath(); };
    cel(c, path, SHELL, SHELL_SH, () => { c.beginPath(); c.ellipse(bx + 5, -11, 6, 7, 0, 0, 6.28); }, 1.2);
    c.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(c, bx - 3.6, -15.6, 1.8, 1.1, -0.5); c.fill();
  };
  const chest = (cx: number) => {
    // belly panel: little load meter + recycling heart
    cel(c, rr(c, cx - 3.6, -15.2, 7.2, 5.4, 1.6), TEAL, TEAL_SH, rr(c, cx + 1.5, -15.2, 3, 5.4, 1), 1);
    for (let i = 0; i < 4; i++) {
      const on = fill > i / 4 + 0.01;
      c.fillStyle = on ? (full ? '#ff6b5e' : '#b9ff8a') : '#0f4b47';
      c.fillRect(cx - 2.6 + i * 1.45, -13, 1.05, 2.4);
    }
  };

  const head = (hx: number) => {
    const hy = -26.5;
    const W = 19, H = 14.5;
    // antenna (springy, lags behind the bob)
    const sway = Math.sin(time * 3.1) * 0.8 + (o.moving ? -Math.cos(walk) * 1.2 : 0) + (dir === 'right' || dir === 'left' ? -1.2 * (o.moving ? 1 : 0) : 0);
    c.strokeStyle = OL; c.lineWidth = 1.9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx + 1.5, hy - H / 2 + 0.5); c.quadraticCurveTo(hx + 2, hy - H / 2 - 4, hx + 2.4 + sway, hy - H / 2 - 7); c.stroke();
    c.strokeStyle = METAL; c.lineWidth = 0.9; c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, hx + 2.4 + sway, hy - H / 2 - 8, 0, 5, [[0, shade(bulb, 0, 0.6)], [1, shade(bulb, 0, 0)]]);
    c.beginPath(); c.arc(hx + 2.4 + sway, hy - H / 2 - 8, 5, 0, 6.28); c.fill();
    c.restore();
    cel(c, circ(c, hx + 2.4 + sway, hy - H / 2 - 8, 1.9), bulb, shade(bulb, -0.25), circ(c, hx + 3.2 + sway, hy - H / 2 - 7.2, 1.5), 0.9);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(hx + 1.8 + sway, hy - H / 2 - 8.7, 0.55, 0, 6.28); c.fill();

    // side bolts ("ears")
    if (!side) {
      cel(c, rr(c, hx - W / 2 - 2, hy - 2.6, 3, 5.2, 1.2), TEAL, TEAL_SH, null, 1);
      cel(c, rr(c, hx + W / 2 - 1, hy - 2.6, 3, 5.2, 1.2), TEAL, TEAL_SH, rr(c, hx + W / 2 + 0.5, hy - 2.6, 2, 5.2, 1), 1);
    } else {
      cel(c, circ(c, hx - 2.6, hy + 0.5, 2.4), TEAL, TEAL_SH, circ(c, hx - 1.8, hy + 1.3, 2), 1);
    }
    // head shell
    cel(c, rr(c, hx - W / 2, hy - H / 2, W, H, 6), SHELL, SHELL_SH, rr(c, hx + W * 0.18, hy - H / 2, W, H, 4), 1.25);
    c.fillStyle = SHELL_HI; ellipse(c, hx - 4.6, hy - H / 2 + 2.1, 3.4, 1.2, -0.15); c.fill();

    if (dir === 'up') {
      // back of the head: vent grill + screws
      cel(c, rr(c, hx - 5.5, hy - 2, 11, 6, 1.6), SHELL_SH, null, null, 1);
      c.fillStyle = OL;
      for (let i = 0; i < 4; i++) c.fillRect(hx - 4.2 + i * 2.6, hy - 1, 1.2, 4);
      for (const sx of [-7, 7]) { c.beginPath(); c.arc(hx + sx, hy - 4, 0.7, 0, 6.28); c.fill(); }
    } else {
      // visor screen
      const vx = side ? hx - 0.6 : hx - 7.6, vw = side ? 9.4 : 15.2, vy = hy - 4.8, vh = 10;
      cel(c, rr(c, vx, vy, vw, vh, 3.6), VISOR, null, null, 1.1);
      c.save(); rrect(c, vx, vy, vw, vh, 3.6); c.clip();
      c.fillStyle = 'rgba(111,246,255,0.08)'; c.fillRect(vx, vy, vw, vh);
      // scanline shimmer
      c.fillStyle = 'rgba(111,246,255,0.07)';
      const sl = vy + ((time * 9) % (vh + 4)) - 2; c.fillRect(vx, sl, vw, 1.4);
      c.restore();
      const eyes = side ? [hx + 5.6] : [hx - 3.4, hx + 3.4];
      const ey = hy - 0.4;
      c.save();
      c.shadowColor = GLOW; c.shadowBlur = 4;
      c.strokeStyle = GLOW; c.fillStyle = GLOW; c.lineCap = 'round';
      for (const ex of eyes) {
        if (happy) {
          // ^ ^ joy arcs
          c.lineWidth = 1.5; c.beginPath(); c.arc(ex, ey + 1.2, 2, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
        } else if (blink) {
          c.lineWidth = 1.3; c.beginPath(); c.moveTo(ex - 1.8, ey + 0.3); c.lineTo(ex + 1.8, ey + 0.3); c.stroke();
        } else if (full) {
          // worried: tilted brows over round eyes
          c.beginPath(); c.ellipse(ex, ey + 0.6, 1.5, 1.9, 0, 0, 6.28); c.fill();
          const s = side ? 1 : Math.sign(ex - hx);
          c.lineWidth = 0.9; c.beginPath(); c.moveTo(ex - 1.8 * s, ey - 3.2); c.lineTo(ex + 1.6 * s, ey - 2.2); c.stroke();
        } else {
          const squint = o.moving ? 0.8 : 1;
          c.beginPath(); c.ellipse(ex, ey, 1.75, 2.5 * squint, 0, 0, 6.28); c.fill();
        }
      }
      c.restore();
      if (!happy && !blink && !full) {
        c.fillStyle = '#fff';
        for (const ex of eyes) { c.beginPath(); c.arc(ex + 0.6, ey - 1, 0.6, 0, 6.28); c.fill(); }
      }
      // blush + mouth on the screen
      c.fillStyle = 'rgba(255,120,170,0.55)';
      if (side) { ellipse(c, hx + 3.6, hy + 2.6, 1.3, 0.7); c.fill(); }
      else { ellipse(c, hx - 5.4, hy + 2.6, 1.5, 0.8); c.fill(); ellipse(c, hx + 5.4, hy + 2.6, 1.5, 0.8); c.fill(); }
      c.save(); c.shadowColor = GLOW; c.shadowBlur = 3; c.strokeStyle = GLOW; c.lineWidth = 0.9; c.lineCap = 'round';
      const mx = side ? hx + 7.2 : hx;
      c.beginPath();
      if (full) { c.moveTo(mx - 1.4, hy + 3.4); c.quadraticCurveTo(mx, hy + 2.4, mx + 1.4, hy + 3.4); }
      else if (happy) { c.moveTo(mx - 1.8, hy + 2.2); c.quadraticCurveTo(mx, hy + 4.6, mx + 1.8, hy + 2.2); c.closePath(); c.fillStyle = GLOW; c.fill(); }
      else { c.moveTo(mx - 1.3, hy + 2.6); c.quadraticCurveTo(mx, hy + 3.7, mx + 1.3, hy + 2.6); }
      c.stroke(); c.restore();
      // glass glare
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.beginPath(); c.moveTo(vx + 1.6, vy + 1); c.lineTo(vx + 4.2, vy + 1); c.lineTo(vx + 2.2, vy + vh - 1.5); c.lineTo(vx + 0.9, vy + vh - 2.5); c.closePath(); c.fill();
    }
    if (o.crown) {
      c.save(); c.translate(hx - 3, hy - H / 2 - 0.2); c.rotate(-0.18);
      cel(c, () => { c.beginPath(); c.moveTo(-4.4, 0); c.lineTo(-4.8, -5.4); c.lineTo(-2.3, -2.8); c.lineTo(0, -6.6); c.lineTo(2.3, -2.8); c.lineTo(4.8, -5.4); c.lineTo(4.4, 0); c.closePath(); }, '#ffd54f', '#d4a017', () => { c.fillRect(-6, -1.6, 12, 2); }, 1);
      c.fillStyle = '#e53935'; c.beginPath(); c.arc(0, -2.4, 0.9, 0, 6.28); c.fill();
      c.restore();
    }
    if (full && dir !== 'up') {
      const t = (time * 1.3) % 1;
      c.fillStyle = `rgba(140,205,255,${1 - t})`; c.beginPath(); c.ellipse(hx + (side ? -4 : 9.5), hy - 5 + t * 6, 0.9, 1.4, 0, 0, 6.28); c.fill();
    }
  };

  const tw = 11 * tankS, th = 12 * tankS;
  if (side) {
    // ============================== PROFILE (facing right) ==============================
    wheel();
    upper(() => {
      arm(-1, -15, -sw * 0.45 + 0.15, 7, true, false);
      tank(-6.5 - tw * 0.7, -21 - (th - 12) * 0.5, tw * 0.75, th, false);
      body(0);
      chest(2.4);
      const reach = -k * 1.5;
      arm(1, -14.6, sw * 0.45 - 0.15 + reach, 7 + k * 2, false, true);
      head(0.8);
    });
  } else if (dir === 'down') {
    // ============================== FRONT ==============================
    upper(() => {
      // tank peeks out behind the body
      cel(c, rr(c, -tw / 2 - 2, -19.5 - (th - 12) * 0.5, tw + 4, 8 + (th - 12) * 0.5, 3), METAL_SH, null, null, 1.1);
    });
    wheel();
    upper(() => {
      body(0);
      chest(0);
      arm(-7, -14.6, 0.32 + sw * 0.25, 7, false, false);
      arm(7, -14.6, -0.32 - sw * 0.25 - k * 0.5, 7 + k * 2.5, false, true);
      head(0);
    });
  } else {
    // ============================== BACK ==============================
    wheel();
    upper(() => {
      body(0);
      arm(-7, -14.6, 0.32 - sw * 0.25, 7, false, false);
      arm(7, -14.6, -0.32 + sw * 0.25 - k * 0.4, 7 + k * 2, false, true);
      head(0);
      tank(-tw / 2, -20 - (th - 12) * 0.6, tw, th, true);
    });
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
