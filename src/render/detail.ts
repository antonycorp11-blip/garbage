import { mulberry } from '../core/rng';
import { ellipse, makeCanvas, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

// ------------------------------------------------------------------ sprite cache
/** Resolution multiplier for cached static layers (crisp at max zoom on hi-dpi). */
export const CACHE_SCALE = Math.min(3, Math.max(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * 1.6));

interface Cached { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }
const cache = new Map<string, Cached>();

/** Draws (once) a static layer into an offscreen canvas. Coordinates: (0,0) = anchor. */
export function cachedLayer(key: string, x0: number, y0: number, w: number, h: number, draw: (c: C) => void): Cached {
  let e = cache.get(key);
  if (!e) {
    const S = CACHE_SCALE;
    const cv = makeCanvas(w * S, h * S);
    const c = cv.getContext('2d')!;
    c.scale(S, S);
    c.translate(-x0, -y0);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    draw(c);
    e = { cv, ox: x0, oy: y0, w, h };
    cache.set(key, e);
  }
  return e;
}

export function blit(c: C, e: Cached, x: number, y: number) {
  c.drawImage(e.cv, x + e.ox, y + e.oy, e.w, e.h);
}

// ------------------------------------------------------------------ primitives (cartoon style)
/** Shared outline color/width: the same ink as the characters, so everything reads as one game. */
export const INK = '#2a1a10';
export const INK_W = 1.15;

function ink(c: C, w = INK_W) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); }

export function rivet(c: C, x: number, y: number, r = 0.9, col = '#b9c2c7') {
  c.fillStyle = INK; c.beginPath(); c.arc(x, y, r + 0.35, 0, 6.28); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 6.28); c.fill();
}

export function rivetRow(c: C, x0: number, y0: number, x1: number, y1: number, n: number, r = 0.8, col?: string) {
  const m = Math.max(2, Math.round(n * 0.6));
  for (let i = 0; i < m; i++) {
    const t = m === 1 ? 0.5 : i / (m - 1);
    rivet(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r * 0.9, col);
  }
}

export function bolt(c: C, x: number, y: number, r = 1.4) {
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath();
  c.fillStyle = '#c3cbd0'; c.fill(); ink(c, 0.8);
  c.fillStyle = '#7a858b'; c.beginPath(); c.arc(x, y, r * 0.35, 0, 6.28); c.fill();
}

/** Cel-shaded plate: flat base, darker lower band, crisp highlight, ink outline. */
export function plate(c: C, x: number, y: number, w: number, h: number, col: string, opts: { r?: number; rivets?: boolean; rust?: number; seed?: number; vertical?: boolean } = {}) {
  const r = opts.r ?? 1.5;
  rrect(c, x, y, w, h, r); c.fillStyle = col; c.fill();
  c.save(); rrect(c, x, y, w, h, r); c.clip();
  c.fillStyle = shade(col, -0.22);
  if (opts.vertical) c.fillRect(x + w * 0.62, y, w, h); else c.fillRect(x, y + h * 0.62, w, h);
  c.fillStyle = 'rgba(255,255,255,0.28)';
  if (opts.vertical) c.fillRect(x + w * 0.12, y, Math.max(0.8, w * 0.12), h); else c.fillRect(x, y + h * 0.1, w, Math.max(0.7, h * 0.12));
  c.restore();
  rrect(c, x, y, w, h, r); ink(c, Math.min(INK_W, Math.max(0.6, Math.min(w, h) * 0.25)));
  if (opts.rivets) { const m = 1.8; rivet(c, x + m, y + m, 0.6); rivet(c, x + w - m, y + m, 0.6); rivet(c, x + m, y + h - m, 0.6); rivet(c, x + w - m, y + h - m, 0.6); }
  if (opts.rust) weather(c, x, y, w, h, opts.rust, opts.seed ?? 1);
}

/** Stylized wear: a few clean-edged rust patches and drips (no noisy grain). */
export function weather(c: C, x: number, y: number, w: number, h: number, amount: number, seed: number) {
  const r = mulberry(seed * 7919 + 13);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const n = Math.max(1, Math.round(amount * (w * h) / 220));
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, s = 1.2 + r() * 2.4;
    c.fillStyle = r() < 0.6 ? 'rgba(168,92,40,0.45)' : 'rgba(60,40,25,0.22)';
    c.beginPath();
    for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28, rr2 = s * (0.7 + r() * 0.5); c.lineTo(px + Math.cos(a) * rr2, py + Math.sin(a) * rr2 * 0.7); }
    c.closePath(); c.fill();
    if (r() < 0.4) { c.fillStyle = 'rgba(168,92,40,0.35)'; c.fillRect(px - 0.4, py, 0.8, 2 + r() * 4); }
  }
  c.restore();
}

export function hazardStripes(c: C, x: number, y: number, w: number, h: number, a = '#ffc928', b = '#2a1a10') {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = a; c.fillRect(x, y, w, h);
  c.fillStyle = b;
  const step = Math.max(4, h * 1.6);
  for (let i = -h; i < w + h; i += step) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + step / 2, y + h); c.lineTo(x + i + step / 2 + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
  c.restore();
  c.beginPath(); c.rect(x, y, w, h); ink(c, 0.6);
}

/** Thick pipe along a polyline: ink outline, flat body, one highlight. */
export function pipe(c: C, pts: number[], width: number, col: string) {
  const path = () => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  path(); c.strokeStyle = INK; c.lineWidth = width + INK_W * 1.6; c.stroke();
  path(); c.strokeStyle = shade(col, -0.18); c.lineWidth = width; c.stroke();
  c.save(); c.translate(-width * 0.16, -width * 0.16);
  path(); c.strokeStyle = shade(col, 0.35); c.lineWidth = width * 0.32; c.stroke();
  c.restore();
}

export function cable(c: C, x0: number, y0: number, x1: number, y1: number, sag: number, col = '#2b2b30', w = 0.9) {
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
  c.strokeStyle = INK; c.lineWidth = w + 0.8; c.stroke();
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}

export function vent(c: C, x: number, y: number, w: number, h: number, slats: number) {
  rrect(c, x, y, w, h, 0.8); c.fillStyle = '#23272b'; c.fill(); ink(c, 0.6);
  for (let i = 0; i < slats; i++) {
    const yy = y + 0.9 + (i * (h - 1.6)) / slats;
    c.fillStyle = '#6d777d'; c.fillRect(x + 0.8, yy, w - 1.6, Math.max(0.5, (h - 1.6) / slats * 0.45));
  }
}

export function windowGlass(c: C, x: number, y: number, w: number, h: number, lit = false, frame = '#3a4046') {
  rrect(c, x - 0.8, y - 0.8, w + 1.6, h + 1.6, 1); c.fillStyle = frame; c.fill(); ink(c, 0.7);
  c.fillStyle = lit ? '#ffe28a' : '#7cc4e8'; c.fillRect(x, y, w, h);
  c.fillStyle = lit ? '#ffc94a' : '#4d93b8'; c.fillRect(x, y + h * 0.55, w, h * 0.45);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath(); c.moveTo(x + w * 0.15, y + h * 0.75); c.lineTo(x + w * 0.45, y); c.lineTo(x + w * 0.6, y); c.lineTo(x + w * 0.3, y + h * 0.75); c.closePath(); c.fill();
}

export function gauge(c: C, x: number, y: number, r: number, needle: number) {
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fillStyle = '#fbf6e9'; c.fill(); ink(c, 0.7);
  c.strokeStyle = '#e53935'; c.lineWidth = 0.7; c.beginPath(); c.arc(x, y, r * 0.7, -0.7, 0.2); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(needle) * r * 0.8, y + Math.sin(needle) * r * 0.8); c.stroke();
}

/** 3/4 view box: cel-shaded top face + front face, ink outline. */
export function box34(c: C, x: number, y: number, w: number, top: number, front: number, col: string, r = 1.5) {
  const fy = y + top;
  // front face
  rrect(c, x, fy - r, w, front + r, r); c.fillStyle = shade(col, -0.2); c.fill();
  c.save(); rrect(c, x, fy - r, w, front + r, r); c.clip();
  c.fillStyle = shade(col, -0.36); c.fillRect(x + w * 0.72, fy - r, w, front + r);
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, fy + front - Math.min(2, front * 0.25), w, 3);
  c.restore();
  rrect(c, x, fy - r, w, front + r, r); ink(c);
  // top face
  rrect(c, x, y, w, top, r); c.fillStyle = shade(col, 0.12); c.fill();
  c.save(); rrect(c, x, y, w, top, r); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x, y, w, Math.max(0.8, top * 0.22));
  c.restore();
  rrect(c, x, y, w, top, r); ink(c);
}

/** 3/4 vertical cylinder (tank, drum), cel-shaded. */
export function cylinder34(c: C, cx: number, top: number, rx: number, h: number, col: string, bands = 0) {
  const ry = rx * 0.42;
  const body = () => { c.beginPath(); c.moveTo(cx - rx, top); c.lineTo(cx - rx, top + h); c.ellipse(cx, top + h, rx, ry, 0, Math.PI, 0, true); c.lineTo(cx + rx, top); c.closePath(); };
  body(); c.fillStyle = col; c.fill();
  c.save(); body(); c.clip();
  c.fillStyle = shade(col, -0.25); c.fillRect(cx + rx * 0.35, top - ry, rx, h + ry * 2);
  c.fillStyle = shade(col, -0.42); c.fillRect(cx + rx * 0.75, top - ry, rx, h + ry * 2);
  c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(cx - rx * 0.62, top, rx * 0.22, h + ry);
  for (let i = 1; i <= bands; i++) {
    const yy = top + (h * i) / (bands + 1);
    c.beginPath(); c.ellipse(cx, yy, rx, ry, 0, 0, Math.PI); c.strokeStyle = shade(col, -0.5); c.lineWidth = 1.1; c.stroke();
  }
  c.restore();
  body(); ink(c);
  ellipse(c, cx, top, rx, ry); c.fillStyle = shade(col, 0.2); c.fill();
  c.save(); ellipse(c, cx, top, rx, ry); c.clip(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(cx - rx, top - ry, rx * 2, ry * 0.7); c.restore();
  ellipse(c, cx, top, rx, ry); ink(c);
}

/** Soft rectangular contact shadow. */
export function contactShadow(c: C, x: number, y: number, w: number, h: number, a = 0.35, blur = 4) {
  c.save();
  c.shadowColor = `rgba(0,0,0,${a})`;
  c.shadowBlur = blur * CACHE_SCALE;
  c.shadowOffsetX = 2 * CACHE_SCALE; c.shadowOffsetY = 3 * CACHE_SCALE;
  c.fillStyle = `rgba(0,0,0,${a * 0.6})`;
  rrect(c, x, y, w, h, 3); c.fill();
  c.restore();
}

export function corrugated(c: C, x: number, y: number, w: number, h: number, col: string, step = 3, vertical = true) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = col; c.fillRect(x, y, w, h);
  if (vertical) {
    for (let i = x; i < x + w; i += step) {
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(i, y, step * 0.3, h);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(i + step * 0.62, y, step * 0.22, h);
    }
  } else {
    for (let i = y; i < y + h; i += step) {
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x, i, w, step * 0.3);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, i + step * 0.62, w, step * 0.22);
    }
  }
  c.restore();
}

export function stencil(c: C, text: string, x: number, y: number, size: number, col = 'rgba(20,20,20,0.75)') {
  c.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = col; c.fillText(text, x, y);
}

export function levelStars(c: C, x: number, y: number, level: number) {
  for (let i = 0; i < level; i++) {
    const sx = x + (i - (level - 1) / 2) * 3.4;
    c.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.28 - Math.PI / 2, r = k % 2 ? 0.7 : 1.6; c.lineTo(sx + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
    c.fillStyle = '#ffd54f'; c.fill();
    c.strokeStyle = '#7a5500'; c.lineWidth = 0.35; c.stroke();
  }
}

export function glow(c: C, x: number, y: number, r: number, col: string, a = 0.5) {
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = rad(c, x, y, 0, r, [[0, shade(col, 0, a)], [1, shade(col, 0, 0)]]);
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  c.restore();
}

export function lamp(c: C, x: number, y: number, col: string, on: boolean, r = 1.3) {
  c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(x, y, r + 0.5, 0, 6.28); c.fill();
  c.fillStyle = on ? rad(c, x - r * 0.3, y - r * 0.3, 0, r, [[0, '#fff'], [0.4, col], [1, shade(col, -0.3)]]) : shade(col, -0.65);
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  if (on) glow(c, x, y, r * 5, col, 0.45);
}

export { makeCanvas };

// ------------------------------------------------------------------ sci-fi kit (alien outpost style)
/** Shared palette for machines: cream shells, orange + teal accents, violet mechanics, cyan energy. */
export const SCI = {
  shell: '#f3ead8', shellD: '#d8c9ad', orange: '#ff9a3c', orangeD: '#d9661a', teal: '#2bb5a8', tealD: '#17796f',
  violet: '#4b416e', violetD: '#2f2848', cyan: '#5ff2ff', cyanD: '#18a9c9', gold: '#ffd257',
};

/** Rounded cel-shaded shell (capsule/pod) with a soft rim light. */
export function shell(c: C, x: number, y: number, w: number, h: number, col: string, r = Math.min(w, h) * 0.45) {
  rrect(c, x, y, w, h, r); c.fillStyle = col; c.fill();
  c.save(); rrect(c, x, y, w, h, r); c.clip();
  c.fillStyle = shade(col, -0.16); c.beginPath(); c.ellipse(x + w * 0.62, y + h * 1.05, w * 0.75, h * 0.62, 0, 0, 6.28); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(x + w * 0.3, y + h * 0.22, w * 0.22, h * 0.1, -0.35, 0, 6.28); c.fill();
  c.restore();
  rrect(c, x, y, w, h, r); ink(c);
}

/** Glass window/dome face with a gloss streak. */
export function glass(c: C, x: number, y: number, w: number, h: number, tint = '#1d3a4f', r = 2) {
  rrect(c, x, y, w, h, r); c.fillStyle = tint; c.fill();
  c.save(); rrect(c, x, y, w, h, r); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, w, h * 0.45);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath(); c.moveTo(x + w * 0.18, y + h); c.lineTo(x + w * 0.42, y); c.lineTo(x + w * 0.52, y); c.lineTo(x + w * 0.28, y + h); c.closePath(); c.fill();
  c.restore();
  rrect(c, x, y, w, h, r); ink(c, 0.8);
}

/** Level pips: small capsules, gold when maxed. */
export function levelPips(c: C, cx: number, y: number, level: number, max = 5) {
  const w = 2.6, gap = 1.1, total = max * w + (max - 1) * gap;
  rrect(c, cx - total / 2 - 1.4, y - 1.4, total + 2.8, 4.6, 2.3); c.fillStyle = 'rgba(30,22,40,0.85)'; c.fill();
  for (let i = 0; i < max; i++) {
    rrect(c, cx - total / 2 + i * (w + gap), y, w, 1.8, 0.9);
    c.fillStyle = i < level ? (level >= max ? SCI.gold : SCI.orange) : 'rgba(255,255,255,0.15)'; c.fill();
  }
}

/** Glowing energy stroke (additive). */
export function energyLine(c: C, pts: number[], w: number, col: string, a = 0.9) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); };
  path(); c.strokeStyle = shade(col, 0, a * 0.35); c.lineWidth = w * 3; c.stroke();
  path(); c.strokeStyle = shade(col, 0.4, a); c.lineWidth = w; c.stroke();
  c.restore();
}

/** Faceted gem in a material color (packets, silo contents, piles). */
export function gem(c: C, x: number, y: number, r: number, col: string, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.85, -r * 0.2); c.lineTo(r * 0.5, r * 0.85); c.lineTo(-r * 0.5, r * 0.85); c.lineTo(-r * 0.85, -r * 0.2); c.closePath();
  c.fillStyle = col; c.fill();
  c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.85, -r * 0.2); c.lineTo(0, r * 0.1); c.lineTo(-r * 0.85, -r * 0.2); c.closePath();
  c.fillStyle = shade(col, 0.35); c.fill();
  c.beginPath(); c.moveTo(0, r * 0.1); c.lineTo(r * 0.5, r * 0.85); c.lineTo(r * 0.85, -r * 0.2); c.closePath();
  c.fillStyle = shade(col, -0.25); c.fill();
  c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.85, -r * 0.2); c.lineTo(r * 0.5, r * 0.85); c.lineTo(-r * 0.5, r * 0.85); c.lineTo(-r * 0.85, -r * 0.2); c.closePath();
  c.strokeStyle = INK; c.lineWidth = Math.max(0.45, r * 0.22); c.stroke();
  c.restore();
}
