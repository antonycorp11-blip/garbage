import { mulberry } from '../core/rng';
import { ellipse, lin, makeCanvas, rad, rrect, shade } from './paint';

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

// ------------------------------------------------------------------ primitives
export function rivet(c: C, x: number, y: number, r = 0.9, col = '#9aa3a8') {
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath(); c.arc(x + 0.25, y + 0.35, r, 0, 6.28); c.fill();
  c.fillStyle = rad(c, x - r * 0.35, y - r * 0.35, 0, r * 1.2, [[0, shade(col, 0.6)], [1, shade(col, -0.35)]]);
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
}

export function rivetRow(c: C, x0: number, y0: number, x1: number, y1: number, n: number, r = 0.8, col?: string) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    rivet(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, col);
  }
}

export function bolt(c: C, x: number, y: number, r = 1.4) {
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.lineTo(x + 0.3 + Math.cos(a) * r, y + 0.4 + Math.sin(a) * r); }
  c.fill();
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, '#d7dde0'], [1, '#5c666c']]);
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.fill();
}

/** Metal plate with bevel, optional rivets, weathering. */
export function plate(c: C, x: number, y: number, w: number, h: number, col: string, opts: { r?: number; rivets?: boolean; rust?: number; seed?: number; vertical?: boolean } = {}) {
  const r = opts.r ?? 1.5;
  rrect(c, x, y, w, h, r);
  c.fillStyle = opts.vertical
    ? lin(c, x, y, x + w, y, [[0, shade(col, 0.22)], [0.45, col], [1, shade(col, -0.35)]])
    : lin(c, x, y, x, y + h, [[0, shade(col, 0.25)], [0.5, col], [1, shade(col, -0.3)]]);
  c.fill();
  c.strokeStyle = shade(col, -0.62); c.lineWidth = 0.7; c.stroke();
  // top-left bevel highlight
  c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(x + r, y + 0.6); c.lineTo(x + w - r, y + 0.6); c.moveTo(x + 0.6, y + r); c.lineTo(x + 0.6, y + h - r); c.stroke();
  if (opts.rivets) {
    const m = 1.6;
    rivet(c, x + m, y + m, 0.7); rivet(c, x + w - m, y + m, 0.7); rivet(c, x + m, y + h - m, 0.7); rivet(c, x + w - m, y + h - m, 0.7);
  }
  if (opts.rust) weather(c, x, y, w, h, opts.rust, opts.seed ?? 1);
}

/** Rust blotches, streaks, scratches and grime inside a rect. */
export function weather(c: C, x: number, y: number, w: number, h: number, amount: number, seed: number) {
  const r = mulberry(seed * 7919 + 13);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const n = Math.round(amount * (w * h) / 40);
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, s = 0.6 + r() * 2.4;
    const k = r();
    c.fillStyle = k < 0.55 ? `rgba(${138 + r() * 30 | 0},${78 + r() * 25 | 0},${32 + r() * 15 | 0},${0.18 + r() * 0.25})` : `rgba(${45 + r() * 20 | 0},${35 + r() * 15 | 0},${25 + r() * 10 | 0},${0.12 + r() * 0.2})`;
    ellipse(c, px, py, s, s * (0.5 + r() * 0.5), r() * 3); c.fill();
    if (r() < 0.35) { // drip streak
      c.strokeStyle = 'rgba(120,70,30,0.22)'; c.lineWidth = 0.5 + r() * 0.6;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + (r() - 0.5), py + 2 + r() * 5); c.stroke();
    }
  }
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 0.3;
  for (let i = 0; i < n * 0.6; i++) { const px = x + r() * w, py = y + r() * h; c.beginPath(); c.moveTo(px, py); c.lineTo(px + (r() - 0.5) * 5, py + (r() - 0.5) * 2); c.stroke(); }
  c.fillStyle = lin(c, 0, y + h * 0.6, 0, y + h, [[0, 'rgba(40,25,10,0)'], [1, `rgba(40,25,10,${0.25 * amount})`]]);
  c.fillRect(x, y, w, h);
  c.restore();
}

export function hazardStripes(c: C, x: number, y: number, w: number, h: number, a = '#f5c518', b = '#1f1f1f') {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = a; c.fillRect(x, y, w, h);
  c.fillStyle = b;
  for (let i = -h; i < w + h; i += 5) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 2.5, y + h); c.lineTo(x + i + 2.5 + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, w, h * 0.3);
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, y + h * 0.75, w, h * 0.25);
  c.restore();
}

/** Thick pipe along a polyline, with metallic shading. */
export function pipe(c: C, pts: number[], width: number, col: string) {
  const path = () => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  path(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = width + 1.2; c.stroke();
  path(); c.strokeStyle = shade(col, -0.35); c.lineWidth = width; c.stroke();
  path(); c.strokeStyle = col; c.lineWidth = width * 0.6; c.stroke();
  c.save(); c.translate(-width * 0.18, -width * 0.18);
  path(); c.strokeStyle = shade(col, 0.5, 0.7); c.lineWidth = width * 0.22; c.stroke();
  c.restore();
}

export function cable(c: C, x0: number, y0: number, x1: number, y1: number, sag: number, col = '#1d1d1f', w = 0.9) {
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}

export function vent(c: C, x: number, y: number, w: number, h: number, slats: number) {
  rrect(c, x, y, w, h, 0.8); c.fillStyle = '#1b1d1f'; c.fill();
  for (let i = 0; i < slats; i++) {
    const yy = y + 0.8 + (i * (h - 1.6)) / slats;
    c.fillStyle = 'rgba(160,170,175,0.55)'; c.fillRect(x + 0.6, yy, w - 1.2, 0.6);
  }
}

export function windowGlass(c: C, x: number, y: number, w: number, h: number, lit = false, frame = '#2b2f33') {
  c.fillStyle = frame; rrect(c, x - 0.8, y - 0.8, w + 1.6, h + 1.6, 1); c.fill();
  c.fillStyle = lit ? lin(c, x, y, x, y + h, [[0, '#fff7c2'], [1, '#f3b84a']]) : lin(c, x, y, x + w, y + h, [[0, '#a9d4ea'], [0.5, '#3f6a82'], [1, '#1d3442']]);
  c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath(); c.moveTo(x, y + h * 0.7); c.lineTo(x + w * 0.4, y); c.lineTo(x + w * 0.6, y); c.lineTo(x, y + h); c.closePath(); c.fill();
}

export function gauge(c: C, x: number, y: number, r: number, needle: number) {
  c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(x, y, r + 0.6, 0, 6.28); c.fill();
  c.fillStyle = '#f2efe6'; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  c.strokeStyle = '#d32f2f'; c.lineWidth = 0.6; c.beginPath(); c.arc(x, y, r * 0.75, -0.6, 0.3); c.stroke();
  c.strokeStyle = '#111'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(needle) * r * 0.85, y + Math.sin(needle) * r * 0.85); c.stroke();
}

/** 3/4 view box: top face + front face, with bevel and outline. */
export function box34(c: C, x: number, y: number, w: number, top: number, front: number, col: string, r = 1.5) {
  // front
  rrect(c, x, y + top - r, w, front + r, r);
  c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(col, -0.12)], [0.6, shade(col, -0.22)], [1, shade(col, -0.42)]]); c.fill();
  c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.7; c.stroke();
  // top
  rrect(c, x, y, w, top, r);
  c.fillStyle = lin(c, x, y, x + w, y + top, [[0, shade(col, 0.32)], [1, shade(col, 0.02)]]); c.fill();
  c.strokeStyle = shade(col, -0.55); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(x + r, y + 0.5); c.lineTo(x + w - r, y + 0.5); c.stroke();
}

/** 3/4 vertical cylinder (tank, drum). */
export function cylinder34(c: C, cx: number, top: number, rx: number, h: number, col: string, bands = 0) {
  const ry = rx * 0.42;
  c.beginPath(); c.moveTo(cx - rx, top); c.lineTo(cx - rx, top + h); c.ellipse(cx, top + h, rx, ry, 0, Math.PI, 0, true); c.lineTo(cx + rx, top); c.closePath();
  c.fillStyle = lin(c, cx - rx, 0, cx + rx, 0, [[0, shade(col, -0.1)], [0.28, shade(col, 0.35)], [0.55, col], [1, shade(col, -0.5)]]); c.fill();
  c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.7; c.stroke();
  for (let i = 1; i <= bands; i++) {
    const yy = top + (h * i) / (bands + 1);
    c.beginPath(); c.ellipse(cx, yy, rx, ry, 0, 0, Math.PI); c.strokeStyle = shade(col, -0.45); c.lineWidth = 0.9; c.stroke();
    c.beginPath(); c.ellipse(cx, yy - 0.6, rx, ry, 0, 0.3, Math.PI - 0.3); c.strokeStyle = shade(col, 0.4, 0.5); c.lineWidth = 0.4; c.stroke();
  }
  ellipse(c, cx, top, rx, ry);
  c.fillStyle = lin(c, cx - rx, top - ry, cx + rx, top + ry, [[0, shade(col, 0.45)], [1, shade(col, -0.05)]]); c.fill();
  c.strokeStyle = shade(col, -0.55); c.stroke();
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
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(i, y, step * 0.35, h);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(i + step * 0.55, y, step * 0.3, h);
    }
  } else {
    for (let i = y; i < y + h; i += step) {
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(x, i, w, step * 0.35);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, i + step * 0.55, w, step * 0.3);
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
