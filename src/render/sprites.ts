import { ItemKind } from '../data/regions';
import { mulberry } from '../core/rng';
import { ctx2d, ellipse, lin, makeCanvas, poly, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;
type R = () => number;

export interface Sprite { page: number; sx: number; sy: number; sw: number; sh: number; ax: number; ay: number; w: number; h: number }

/**
 * Sprite store. Each sprite keeps its own small canvas ("page"): drawing a sub-rectangle of a
 * huge packed atlas is dramatically slower in browsers (the whole page gets sampled/uploaded).
 */
export class Atlas {
  pages: (HTMLCanvasElement | ImageBitmap)[] = [];
  constructor(public size = 2048) {}
  /** Swap the canvases for immutable ImageBitmaps (GPU friendly) once the browser has made them. */
  finalize() {
    if (typeof createImageBitmap !== 'function') return;
    this.pages.forEach((cv, i) => {
      if (!(cv instanceof HTMLCanvasElement)) return;
      createImageBitmap(cv).then((bm) => { this.pages[i] = bm; }).catch(() => undefined);
    });
  }
  add(src: HTMLCanvasElement, ax: number, ay: number, scale: number): Sprite {
    const w = src.width, h = src.height;
    this.pages.push(src);
    return { page: this.pages.length - 1, sx: 0, sy: 0, sw: w, sh: h, ax, ay, w: w / scale, h: h / scale };
  }
}

let RS = 1;
function shadowOn(c: C, k = 1) {
  c.shadowColor = 'rgba(10,6,0,0.5)';
  c.shadowBlur = 2.6 * RS * k;
  c.shadowOffsetX = 1.4 * RS * k;
  c.shadowOffsetY = 2.4 * RS * k;
}
function shadowOff(c: C) {
  c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
}
function blobPath(c: C, rx: number, ry: number, r: R, lumps = 9, amp = 0.16) {
  c.beginPath();
  const pts: [number, number][] = [];
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 2 * amp;
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  for (let i = 0; i < lumps; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % lumps];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const p0 = pts[0], p1 = pts[1];
  c.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  c.closePath();
}
interface KindDef { size: number; pal: string[][]; rots: number[]; draw: (c: C, p: string[], r: R) => void }

const FULL = [0, 1.57, 3.14, 4.71].map((a) => a + 0.3);
const SOFT = [-0.5, -0.15, 0.2, 0.55];
const TINY = [-0.18, -0.06, 0.06, 0.18];

// ---------------------------------------------------------------- cartoon helpers
const INK = '#2a1a10';
function ink(c: C, w = 0.85) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
/** Cel shading: the shape in its base color with a darker rim on the lower-right side. */
function cel(c: C, path: () => void, base: string, k = 0.34, off = 1.2) {
  path(); c.fillStyle = shade(base, -k); c.fill();
  shadowOff(c);
  c.save(); path(); c.clip();
  c.translate(-off, -off); path(); c.fillStyle = base; c.fill();
  c.restore();
}
function hl(c: C, x: number, y: number, rx: number, ry: number, a = 0.6, rot = -0.6) {
  c.fillStyle = `rgba(255,255,255,${a})`; ellipse(c, x, y, rx, ry, rot); c.fill();
}
function glow(c: C, x: number, y: number, r: number, col: string, a = 0.5) {
  c.fillStyle = rad(c, x, y, 0, r, [[0, shade(col, 0.2, a)], [0.5, shade(col, 0, a * 0.4)], [1, shade(col, 0, 0)]]);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function hexPath(c: C, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}
/** One faceted crystal prism standing on (x, y). */
function prism(c: C, x: number, y: number, len: number, w: number, ang: number, col: string) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const path = () => poly(c, [-w / 2, 0, -w / 2, -len * 0.72, 0, -len, w / 2, -len * 0.72, w / 2, 0, 0, w * 0.35]);
  path(); c.fillStyle = shade(col, -0.3); c.fill();
  c.save(); path(); c.clip();
  c.fillStyle = shade(col, 0.25); c.fillRect(-w, -len - 2, w, len + w + 4);
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-w / 2 + 0.5, -len * 0.7, 0.9, len * 0.6);
  c.restore();
  path(); ink(c, 0.75);
  c.restore();
}
function rivets(c: C, pts: number[]) {
  for (let i = 0; i < pts.length; i += 2) {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(pts[i] + 0.25, pts[i + 1] + 0.3, 0.6, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(pts[i], pts[i + 1], 0.45, 0, 6.28); c.fill();
  }
}
/** Small glowing alien glyph. */
function glyph(c: C, x: number, y: number, s: number, col: string, k: number) {
  c.save(); c.translate(x, y);
  c.strokeStyle = col; c.lineWidth = 0.6; c.lineCap = 'round';
  c.shadowColor = col; c.shadowBlur = 2.5 * RS;
  c.beginPath();
  switch (k % 4) {
    case 0: c.arc(0, 0, s * 0.5, 0.4, 5.6); c.moveTo(0, -s * 0.5); c.lineTo(0, s * 0.5); break;
    case 1: c.moveTo(-s * 0.5, s * 0.5); c.lineTo(0, -s * 0.5); c.lineTo(s * 0.5, s * 0.5); c.moveTo(-s * 0.25, 0.1); c.lineTo(s * 0.25, 0.1); break;
    case 2: c.arc(0, 0, s * 0.45, 0, 6.28); c.moveTo(-s * 0.15, 0); c.arc(0, 0, s * 0.15, Math.PI, 7.6); break;
    default: c.moveTo(-s * 0.5, -s * 0.4); c.lineTo(s * 0.5, -s * 0.4); c.moveTo(0, -s * 0.4); c.lineTo(0, s * 0.5); c.moveTo(-s * 0.35, s * 0.15); c.lineTo(s * 0.35, s * 0.15);
  }
  c.stroke();
  c.restore();
}

export const KIND_DEFS: Record<ItemKind, KindDef> = {
  crystal: {
    size: 20, rots: SOFT,
    pal: [['#f472b6'], ['#67e8f9'], ['#a78bfa'], ['#fbbf24']],
    draw(c, [col], r) {
      glow(c, 0, -3, 11, col, 0.45);
      shadowOn(c, 0.8);
      c.fillStyle = '#5b4a7a'; blobPath(c, 6, 2.6, r, 7, 0.2); c.fill();
      shadowOff(c);
      ink(c, 0.7);
      const n = 3 + Math.floor(r() * 2);
      const sh: [number, number, number, number][] = [];
      for (let i = 0; i < n; i++) sh.push([(i / (n - 1) - 0.5) * 7.5, 0.5 + r(), 6 + r() * 6 + (i === 1 ? 4 : 0), (i / (n - 1) - 0.5) * 0.9 + (r() - 0.5) * 0.25]);
      sh.sort((a, b) => a[2] - b[2]);
      for (const [x, y, len, ang] of sh) prism(c, x, y, len, 3 + r() * 1.4, ang, col);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(-1.5, -9, 0.7, 0, 6.28); c.fill();
    },
  },
  shard: {
    size: 14, rots: FULL,
    pal: [['#f9a8d4'], ['#a5f3fc'], ['#c4b5fd'], ['#fde68a']],
    draw(c, [col]) {
      glow(c, 0, 0, 7, col, 0.35);
      shadowOn(c, 0.6);
      const path = () => poly(c, [-6, 0, -3.5, -2.2, 4, -1.8, 6.5, 0, 4, 2, -3.5, 2.2]);
      path(); c.fillStyle = shade(col, -0.25); c.fill();
      shadowOff(c);
      c.save(); path(); c.clip(); c.fillStyle = shade(col, 0.3); c.fillRect(-7, -3, 14, 3); c.restore();
      path(); ink(c, 0.7);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-3.5, -1); c.lineTo(3.8, -0.8); c.stroke();
    },
  },
  capsule: {
    size: 16, rots: FULL,
    pal: [['#fdf4ff', '#f472b6'], ['#ecfeff', '#14b8a6'], ['#fff7ed', '#fb923c'], ['#eef2ff', '#6366f1']],
    draw(c, [a, b]) {
      shadowOn(c, 0.7);
      cel(c, () => rrect(c, -7, -3.2, 14, 6.4, 3.2), a, 0.18);
      c.save(); rrect(c, -7, -3.2, 14, 6.4, 3.2); c.clip();
      c.fillStyle = b; c.fillRect(0, -4, 8, 8);
      c.fillStyle = shade(b, -0.3); c.fillRect(0, 1.6, 8, 2);
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(-0.4, -4, 0.8, 8);
      c.restore();
      rrect(c, -7, -3.2, 14, 6.4, 3.2); ink(c);
      hl(c, -3.5, -1.4, 2.4, 0.8, 0.85, 0);
      hl(c, 3.5, -1.4, 2, 0.6, 0.45, 0);
    },
  },
  canister: {
    size: 16, rots: FULL,
    pal: [['#e2e8f0', '#22d3ee'], ['#fde68a', '#f472b6'], ['#ddd6fe', '#4ade80']],
    draw(c, [body, band]) {
      shadowOn(c, 0.7);
      cel(c, () => rrect(c, -6.5, -3.4, 13, 6.8, 2), body, 0.25);
      rrect(c, -6.5, -3.4, 13, 6.8, 2); ink(c);
      // glowing band
      c.save(); c.shadowColor = band; c.shadowBlur = 3 * RS;
      c.fillStyle = band; c.fillRect(-1.6, -3.4, 3.2, 6.8);
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-1.1, -2.8, 0.8, 5.6);
      c.strokeStyle = INK; c.lineWidth = 0.5; c.strokeRect(-1.6, -3.4, 3.2, 6.8);
      // valve cap
      c.fillStyle = '#64748b'; rrect(c, 6, -1.6, 2.2, 3.2, 0.6); c.fill(); ink(c, 0.6);
      hl(c, -4, -1.8, 1.8, 0.7, 0.7, 0);
    },
  },
  goo: {
    size: 16, rots: SOFT,
    pal: [['#86efac'], ['#5eead4'], ['#bef264'], ['#f0abfc']],
    draw(c, [col], r) {
      glow(c, 0, 0, 10, col, 0.55);
      shadowOn(c, 0.5);
      blobPath(c, 6.2, 4.6, r, 8, 0.12);
      c.fillStyle = rad(c, -1.5, -1.5, 0, 7, [[0, shade(col, 0.55, 0.95)], [0.6, shade(col, 0, 0.85)], [1, shade(col, -0.35, 0.95)]]);
      c.fill();
      shadowOff(c);
      ink(c, 0.75);
      for (let i = 0; i < 3; i++) {
        const x = (r() - 0.5) * 6, y = (r() - 0.5) * 3, rr = 0.6 + r() * 0.8;
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.4; c.beginPath(); c.arc(x, y, rr, 0, 6.28); c.stroke();
      }
      hl(c, -2.4, -2, 2, 1, 0.85);
      // drip
      c.fillStyle = shade(col, 0, 0.9); ellipse(c, 5, 3.6, 1, 1.4); c.fill(); ink(c, 0.5);
    },
  },
  pod: {
    size: 16, rots: SOFT,
    pal: [['#e879f9', '#fdf4ff'], ['#2dd4bf', '#ccfbf1'], ['#fb923c', '#ffedd5']],
    draw(c, [col, stripe]) {
      shadowOn(c, 0.7);
      const path = () => { c.beginPath(); c.moveTo(0, -6.5); c.bezierCurveTo(5.5, -4, 5.5, 4, 0, 5.5); c.bezierCurveTo(-5.5, 4, -5.5, -4, 0, -6.5); c.closePath(); };
      cel(c, path, col, 0.3);
      c.save(); path(); c.clip();
      c.strokeStyle = shade(stripe, 0, 0.7); c.lineWidth = 0.8;
      for (const k of [-2.4, 0, 2.4]) { c.beginPath(); c.moveTo(k * 0.6, -6.5); c.quadraticCurveTo(k * 1.4, 0, k * 0.6, 5.5); c.stroke(); }
      c.restore();
      path(); ink(c);
      hl(c, -1.8, -2.5, 1.2, 2.2, 0.55, 0.2);
      // sprout
      c.strokeStyle = '#4ade80'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -6.3); c.quadraticCurveTo(1.5, -9.5, 3.8, -8.6); c.stroke();
      c.fillStyle = '#86efac'; ellipse(c, 3.8, -8.6, 1.4, 0.8, 0.4); c.fill(); ink(c, 0.5);
    },
  },
  amber: {
    size: 14, rots: SOFT,
    pal: [['#fb923c'], ['#fbbf24'], ['#f97316']],
    draw(c, [col], r) {
      glow(c, 0, 0, 8, col, 0.4);
      shadowOn(c, 0.6);
      const pts: number[] = [];
      const n = 7;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28, d = 4.2 + r() * 1.8; pts.push(Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.9); }
      poly(c, pts); c.fillStyle = shade(col, -0.2, 0.95); c.fill();
      shadowOff(c);
      c.save(); poly(c, pts); c.clip();
      c.fillStyle = shade(col, 0.35, 0.9); c.fillRect(-8, -7, 8, 7);
      // trapped critter
      c.fillStyle = 'rgba(60,25,5,0.65)'; ellipse(c, 0.6, 0.6, 1.4, 0.9); c.fill();
      c.strokeStyle = 'rgba(60,25,5,0.6)'; c.lineWidth = 0.35;
      for (const s of [-1, 1]) for (const k of [-0.6, 0.2, 1]) { c.beginPath(); c.moveTo(0.6 + k, 0.6); c.lineTo(0.6 + k * 1.6, 0.6 + s * 1.8); c.stroke(); }
      c.restore();
      poly(c, pts); ink(c, 0.75);
      hl(c, -2, -2, 1.6, 0.8, 0.8);
    },
  },
  ring: {
    size: 18, rots: FULL,
    pal: [['#93c5fd'], ['#f472b6'], ['#fcd34d'], ['#c4b5fd']],
    draw(c, [col]) {
      shadowOn(c, 0.8);
      c.beginPath(); c.ellipse(0, 0, 7.6, 5.4, 0, 0, 6.28); c.ellipse(0, 0.4, 3.6, 2.2, 0, 0, 6.28, true);
      c.fillStyle = shade(col, -0.35); c.fill('evenodd');
      shadowOff(c);
      c.save();
      c.beginPath(); c.ellipse(0, 0, 7.6, 5.4, 0, 0, 6.28); c.ellipse(0, 0.4, 3.6, 2.2, 0, 0, 6.28, true); c.clip('evenodd');
      c.beginPath(); c.ellipse(-0.8, -0.9, 7.2, 4.8, 0, 0, 6.28); c.fillStyle = col; c.fill();
      c.beginPath(); c.ellipse(0, 1.1, 3.6, 2.2, 0, 0, 6.28); c.fillStyle = shade(col, -0.45); c.fill();
      c.restore();
      c.beginPath(); c.ellipse(0, 0, 7.6, 5.4, 0, 0, 6.28); ink(c);
      c.beginPath(); c.ellipse(0, 0.4, 3.6, 2.2, 0, 0, 6.28); ink(c, 0.6);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.9; c.beginPath(); c.ellipse(0, 0, 5.8, 3.9, 0, 3.6, 4.9); c.stroke();
    },
  },
  bolt: {
    size: 14, rots: FULL,
    pal: [['#cbd5e1'], ['#fcd34d'], ['#a5b4fc']],
    draw(c, [col]) {
      shadowOn(c, 0.6);
      cel(c, () => rrect(c, -1.4, -1.2, 8, 2.4, 0.8), shade(col, -0.1), 0.3, 0.6);
      rrect(c, -1.4, -1.2, 8, 2.4, 0.8); ink(c, 0.6);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.4;
      for (let x = 0.5; x < 6.5; x += 1.2) { c.beginPath(); c.moveTo(x, -1.2); c.lineTo(x + 0.6, 1.2); c.stroke(); }
      shadowOn(c, 0.6);
      cel(c, () => hexPath(c, -3, 0, 3.6, 3.4, 0.3), col, 0.3, 0.8);
      hexPath(c, -3, 0, 3.6, 3.4, 0.3); ink(c, 0.7);
      c.fillStyle = shade(col, -0.5); c.beginPath(); c.arc(-3, 0, 1.3, 0, 6.28); c.fill(); ink(c, 0.5);
      hl(c, -4.4, -1.6, 1.2, 0.5, 0.75);
    },
  },
  plate: {
    size: 18, rots: FULL,
    pal: [['#e2e8f0', '#fb923c'], ['#99f6e4', '#0f766e'], ['#c7d2fe', '#f472b6'], ['#fef3c7', '#38bdf8']],
    draw(c, [col, stripe]) {
      shadowOn(c, 0.7);
      const pts = [-7.5, -4, 6, -5, 7.5, 3.2, 3, 4.6, 1.5, 3.4, -7, 4.2];
      cel(c, () => poly(c, pts), col, 0.22);
      c.save(); poly(c, pts); c.clip();
      c.fillStyle = stripe; poly(c, [-8, -1.5, 8, -2.5, 8, 0.2, -8, 1.2]); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = -6; x < 7; x += 3) poly(c, [x, -1.2, x + 1.2, -1.3, x + 0.4, 0.8, x - 0.8, 0.9]);
      c.restore();
      poly(c, pts); ink(c);
      rivets(c, [-6, -2.8, -2, -3.4, 2, -3.8, 5.6, -3.8, -5.6, 3, 5.6, 2.3]);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-1, -4.5); c.lineTo(-0.5, 4.2); c.stroke();
    },
  },
  chip: {
    size: 14, rots: FULL,
    pal: [['#065f46', '#5eead4'], ['#4c1d95', '#f0abfc'], ['#1e3a8a', '#7dd3fc']],
    draw(c, [col, trace], r) {
      shadowOn(c, 0.6);
      cel(c, () => rrect(c, -5.5, -4, 11, 8, 1.2), col, 0.3, 0.8);
      rrect(c, -5.5, -4, 11, 8, 1.2); ink(c, 0.7);
      c.save(); c.shadowColor = trace; c.shadowBlur = 2.5 * RS;
      c.strokeStyle = trace; c.lineWidth = 0.5;
      for (let i = 0; i < 4; i++) {
        const y = -2.6 + i * 1.7;
        c.beginPath(); c.moveTo(-5, y); c.lineTo(-2 + r() * 2, y); c.lineTo(-1 + r() * 2, y + (r() - 0.5) * 1.6); c.lineTo(5, y + (r() - 0.5)); c.stroke();
      }
      c.restore();
      c.fillStyle = '#1f2937'; rrect(c, -1.8, -2, 3.6, 3.6, 0.5); c.fill(); ink(c, 0.5);
      c.fillStyle = trace; c.fillRect(-0.6, -0.8, 1.2, 1.2);
      hl(c, -3.5, -2.8, 1.6, 0.5, 0.5, 0);
    },
  },
  cube: {
    size: 14, rots: SOFT,
    pal: [['#312e81', '#67e8f9'], ['#701a75', '#f9a8d4'], ['#134e4a', '#bef264']],
    draw(c, [col, g], r) {
      glow(c, 0, -1, 8, g, 0.35);
      shadowOn(c, 0.7);
      c.fillStyle = shade(col, -0.35); rrect(c, -4.6, -2.6, 9.2, 7.4, 1); c.fill();
      shadowOff(c);
      c.fillStyle = shade(col, 0.2); rrect(c, -4.6, -5.2, 9.2, 5, 1); c.fill();
      rrect(c, -4.6, -5.2, 9.2, 10, 1); ink(c, 0.75);
      c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-4.6, -0.2); c.lineTo(4.6, -0.2); c.stroke();
      glyph(c, 0, -2.7, 3, g, Math.floor(r() * 4));
      glyph(c, 0, 2.4, 2.4, shade(g, 0, 0.8), Math.floor(r() * 4) + 1);
      hl(c, -2.8, -4.2, 1.4, 0.5, 0.6, 0);
    },
  },
  cell: {
    size: 16, rots: FULL,
    pal: [['#475569', '#22d3ee'], ['#57534e', '#a3e635'], ['#4c1d95', '#f472b6']],
    draw(c, [col, plasma]) {
      shadowOn(c, 0.7);
      cel(c, () => rrect(c, -7, -3, 14, 6, 1.6), col, 0.3, 0.8);
      rrect(c, -7, -3, 14, 6, 1.6); ink(c);
      c.save(); c.shadowColor = plasma; c.shadowBlur = 4 * RS;
      c.fillStyle = rad(c, 0, 0, 0, 4.5, [[0, '#ffffff'], [0.35, shade(plasma, 0.3)], [1, plasma]]);
      rrect(c, -4.5, -1.8, 9, 3.6, 1.2); c.fill();
      c.restore();
      rrect(c, -4.5, -1.8, 9, 3.6, 1.2); ink(c, 0.5);
      c.fillStyle = '#cbd5e1'; rrect(c, 7, -1.4, 1.6, 2.8, 0.5); c.fill(); ink(c, 0.5);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.5;
      for (const x of [-2, 0.5, 3]) { c.beginPath(); c.moveTo(x, -1.6); c.lineTo(x, 1.6); c.stroke(); }
    },
  },
  droidhead: {
    size: 16, rots: SOFT,
    pal: [['#f8fafc', '#fb923c'], ['#a7f3d0', '#0d9488'], ['#ddd6fe', '#7c3aed']],
    draw(c, [col, trim]) {
      shadowOn(c, 0.8);
      cel(c, () => { c.beginPath(); c.ellipse(0, 0, 6.4, 5.4, 0, 0, 6.28); }, col, 0.25);
      c.beginPath(); c.ellipse(0, 0, 6.4, 5.4, 0, 0, 6.28); ink(c);
      c.fillStyle = trim; c.beginPath(); c.ellipse(0, 3.6, 5.2, 1.6, 0, 0, Math.PI); c.fill(); ink(c, 0.5);
      // cracked lens
      c.fillStyle = '#0f172a'; c.beginPath(); c.arc(0.4, -0.4, 2.6, 0, 6.28); c.fill(); ink(c, 0.6);
      c.fillStyle = 'rgba(103,232,249,0.55)'; c.beginPath(); c.arc(0.4, -0.4, 1.3, 0, 6.28); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(-1.2, -2); c.lineTo(0.6, -0.2); c.lineTo(0, 1.6); c.moveTo(0.6, -0.2); c.lineTo(2.4, 0.2); c.stroke();
      // bent antenna
      c.strokeStyle = INK; c.lineWidth = 0.7; c.beginPath(); c.moveTo(3.5, -4); c.lineTo(5.2, -7); c.lineTo(7.4, -7.6); c.stroke();
      c.fillStyle = '#f87171'; c.beginPath(); c.arc(7.4, -7.6, 0.9, 0, 6.28); c.fill(); ink(c, 0.4);
      hl(c, -3.2, -2.8, 1.6, 0.8, 0.8);
    },
  },
  droidarm: {
    size: 18, rots: FULL,
    pal: [['#e2e8f0', '#fb923c'], ['#99f6e4', '#334155'], ['#fde68a', '#475569']],
    draw(c, [col, joint]) {
      shadowOn(c, 0.7);
      cel(c, () => rrect(c, -8, -1.6, 7, 3.2, 1.4), col, 0.25, 0.7);
      rrect(c, -8, -1.6, 7, 3.2, 1.4); ink(c, 0.7);
      cel(c, () => rrect(c, 0, -1.4, 5.5, 2.8, 1.2), col, 0.25, 0.7);
      rrect(c, 0, -1.4, 5.5, 2.8, 1.2); ink(c, 0.7);
      c.fillStyle = joint; c.beginPath(); c.arc(-0.4, 0, 1.9, 0, 6.28); c.fill(); ink(c, 0.6);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(-0.8, -0.5, 0.5, 0, 6.28); c.fill();
      // claw
      c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(5.4, -0.8); c.quadraticCurveTo(8.4, -2.8, 8.6, -0.2); c.moveTo(5.4, 0.8); c.quadraticCurveTo(8.4, 2.8, 8.6, 0.2); c.stroke();
      c.strokeStyle = '#94a3b8'; c.lineWidth = 0.8; c.stroke();
    },
  },
  antenna: {
    size: 18, rots: FULL,
    pal: [['#cbd5e1', '#f472b6'], ['#fcd34d', '#22d3ee'], ['#c4b5fd', '#4ade80']],
    draw(c, [col, bulb]) {
      shadowOn(c, 0.6);
      c.strokeStyle = INK; c.lineWidth = 1.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-7, 1); c.lineTo(6, -0.5); c.stroke();
      shadowOff(c);
      c.strokeStyle = col; c.lineWidth = 0.9; c.stroke();
      for (const x of [-3, 0.5]) {
        c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, 0.5); c.lineTo(x - 1, -3.5); c.moveTo(x, 0.5); c.lineTo(x - 1, 4); c.stroke();
        c.strokeStyle = col; c.lineWidth = 0.6; c.stroke();
      }
      cel(c, () => rrect(c, -8.6, -1.4, 3.2, 4.4, 0.8), '#64748b', 0.3, 0.6);
      rrect(c, -8.6, -1.4, 3.2, 4.4, 0.8); ink(c, 0.6);
      glow(c, 6.6, -0.7, 4, bulb, 0.6);
      c.fillStyle = bulb; c.beginPath(); c.arc(6.6, -0.7, 1.7, 0, 6.28); c.fill(); ink(c, 0.6);
      hl(c, 6.1, -1.3, 0.6, 0.4, 0.9);
    },
  },
  dish: {
    size: 18, rots: SOFT,
    pal: [['#f1f5f9', '#f472b6'], ['#e0e7ff', '#fb923c'], ['#ccfbf1', '#a855f7']],
    draw(c, [col, tip]) {
      shadowOn(c, 0.8);
      c.fillStyle = '#64748b'; rrect(c, -1, 1, 2, 5, 0.6); c.fill();
      shadowOff(c); ink(c, 0.6);
      shadowOn(c, 0.8);
      cel(c, () => { c.beginPath(); c.ellipse(0, -1, 7.4, 4.6, -0.25, 0, 6.28); }, col, 0.2);
      c.beginPath(); c.ellipse(0, -1, 7.4, 4.6, -0.25, 0, 6.28); ink(c);
      c.fillStyle = shade(col, -0.18); c.beginPath(); c.ellipse(0.3, -0.6, 5.2, 3, -0.25, 0, 6.28); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.4; c.beginPath(); c.ellipse(0.3, -0.6, 3, 1.7, -0.25, 0, 6.28); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0.3, -0.6); c.lineTo(-1.2, -6); c.stroke();
      c.strokeStyle = '#94a3b8'; c.lineWidth = 0.45; c.stroke();
      c.fillStyle = tip; c.beginPath(); c.arc(-1.2, -6, 1.2, 0, 6.28); c.fill(); ink(c, 0.5);
      hl(c, -4, -2.6, 1.8, 0.7, 0.75);
    },
  },
  crate: {
    size: 16, rots: SOFT,
    pal: [['#2dd4bf', '#fde047'], ['#fb923c', '#e0f2fe'], ['#a78bfa', '#5eead4'], ['#f472b6', '#fef9c3']],
    draw(c, [col, g], r) {
      shadowOn(c, 0.8);
      c.fillStyle = shade(col, -0.35); rrect(c, -6, -2, 12, 7.5, 1); c.fill();
      shadowOff(c);
      c.fillStyle = shade(col, 0.15); rrect(c, -6, -6, 12, 5.4, 1); c.fill();
      rrect(c, -6, -6, 12, 11.5, 1); ink(c, 0.8);
      c.strokeStyle = INK; c.lineWidth = 0.55; c.beginPath(); c.moveTo(-6, -0.6); c.lineTo(6, -0.6); c.stroke();
      // corner brackets
      c.fillStyle = '#334155';
      for (const [x, y] of [[-6, -6], [4.2, -6], [-6, 3.7], [4.2, 3.7]]) c.fillRect(x, y, 1.8, 1.8);
      c.fillStyle = shade(col, -0.15);
      c.fillRect(-3.4, 0.6, 6.8, 3.4);
      glyph(c, 0, 2.3, 2.6, g, Math.floor(r() * 4));
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-5, -5.2, 6, 1);
    },
  },
  meteor: {
    size: 16, rots: SOFT,
    pal: [['#6d5a8a', '#fb923c'], ['#4c5a7a', '#22d3ee'], ['#7a5a6a', '#f472b6']],
    draw(c, [col, vein], r) {
      shadowOn(c, 0.8);
      const seed = Math.floor(r() * 1e6);
      const sil = () => blobPath(c, 6.6, 5, mulberry(seed), 9, 0.2);
      cel(c, sil, col, 0.35, 1.3);
      sil(); ink(c, 0.8);
      // craters
      for (let i = 0; i < 3; i++) {
        const x = (r() - 0.5) * 7, y = (r() - 0.5) * 4.5, s = 0.7 + r() * 0.9;
        c.fillStyle = shade(col, -0.35); ellipse(c, x, y, s, s * 0.7); c.fill();
        c.fillStyle = shade(col, 0.25); ellipse(c, x - 0.3, y - 0.3, s * 0.6, s * 0.4); c.fill();
      }
      // glowing veins
      c.save(); c.shadowColor = vein; c.shadowBlur = 3 * RS;
      c.strokeStyle = vein; c.lineWidth = 0.6;
      c.beginPath(); let x = -4, y = (r() - 0.5) * 2; c.moveTo(x, y);
      for (let i = 0; i < 4; i++) { x += 2 + r() * 1.2; y += (r() - 0.5) * 2.4; c.lineTo(x, y); }
      c.stroke(); c.restore();
      hl(c, -2.6, -2.4, 1.8, 0.8, 0.4);
    },
  },
  pipe: {
    size: 18, rots: FULL,
    pal: [['#94a3b8', '#f472b6'], ['#5eead4', '#334155'], ['#fdba74', '#475569']],
    draw(c, [col, flange]) {
      shadowOn(c, 0.6);
      cel(c, () => rrect(c, -8, -2, 16, 4, 1.4), col, 0.3, 0.7);
      rrect(c, -8, -2, 16, 4, 1.4); ink(c, 0.75);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-7.4, -1.4, 14.8, 0.8);
      for (const x of [-6.5, 4.5]) { c.fillStyle = flange; rrect(c, x, -2.8, 2, 5.6, 0.6); c.fill(); ink(c, 0.55); }
      c.fillStyle = '#1f2937'; ellipse(c, 8, 0, 0.9, 1.8); c.fill(); ink(c, 0.5);
    },
  },
  gear: {
    size: 16, rots: FULL,
    pal: [['#cbd5e1'], ['#fcd34d'], ['#93c5fd'], ['#f9a8d4']],
    draw(c, [col]) {
      shadowOn(c, 0.7);
      const path = () => {
        c.beginPath();
        const T = 9;
        for (let i = 0; i < T * 2; i++) {
          const a = (i / (T * 2)) * Math.PI * 2;
          const rr = i % 2 === 0 ? 6.4 : 5;
          c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.86);
          c.lineTo(Math.cos(a + Math.PI / (T * 2)) * rr, Math.sin(a + Math.PI / (T * 2)) * rr * 0.86);
        }
        c.closePath();
      };
      cel(c, path, col, 0.3, 0.9);
      path(); ink(c, 0.7);
      c.fillStyle = shade(col, -0.45); c.beginPath(); c.ellipse(0, 0, 1.8, 1.5, 0, 0, 6.28); c.fill(); ink(c, 0.5);
      c.strokeStyle = shade(col, -0.25); c.lineWidth = 0.5; c.beginPath(); c.ellipse(0, 0, 3.4, 2.9, 0, 0, 6.28); c.stroke();
      hl(c, -2.6, -2.2, 1.4, 0.6, 0.7);
    },
  },
  ufo: {
    size: 16, rots: SOFT,
    pal: [['#f472b6', '#a5f3fc'], ['#4ade80', '#fde68a'], ['#fbbf24', '#c4b5fd']],
    draw(c, [col, dome]) {
      shadowOn(c, 0.8);
      cel(c, () => { c.beginPath(); c.ellipse(0, 1, 7, 2.8, 0, 0, 6.28); }, col, 0.3, 0.8);
      c.beginPath(); c.ellipse(0, 1, 7, 2.8, 0, 0, 6.28); ink(c);
      c.fillStyle = shade(dome, 0, 0.9); c.beginPath(); c.ellipse(0, -0.4, 3.6, 3.4, 0, Math.PI, 0); c.fill(); ink(c, 0.7);
      // tiny pilot
      c.fillStyle = '#4ade80'; c.beginPath(); c.arc(0, -1.2, 1.3, 0, 6.28); c.fill();
      c.fillStyle = INK; c.fillRect(-0.7, -1.6, 0.4, 0.5); c.fillRect(0.3, -1.6, 0.4, 0.5);
      for (const x of [-4.5, 0, 4.5]) { c.fillStyle = '#fef08a'; c.beginPath(); c.arc(x, 1.6, 0.7, 0, 6.28); c.fill(); }
      hl(c, -1.6, -2, 1, 0.6, 0.8);
    },
  },
  // ------------------------------------------------------------ big pieces
  hull: {
    size: 40, rots: TINY,
    pal: [['#e2e8f0', '#fb923c'], ['#bae6fd', '#e11d48'], ['#ddd6fe', '#0d9488']],
    draw(c, [col, stripe], r) {
      shadowOn(c, 1.4);
      const pts: number[] = [-17, 6, -16, -4, -10, -10, 2, -12, 12, -9, 17, -3];
      // torn edge
      let x = 17, y = -3;
      while (x > -16) { x -= 2 + r() * 2.5; y = 6 + (r() - 0.5) * 3.5; pts.push(Math.max(-17, x), y); }
      cel(c, () => poly(c, pts), col, 0.28, 2);
      c.save(); poly(c, pts); c.clip();
      c.fillStyle = stripe; poly(c, [-20, -1, 20, -6, 20, -2, -20, 3]); c.fill();
      c.fillStyle = shade(col, -0.12);
      for (let k = -14; k < 16; k += 9) poly(c, [k, -14, k + 0.8, -14, k + 2, 8, k + 1.2, 8]);
      c.restore();
      poly(c, pts); ink(c, 1);
      // porthole
      c.fillStyle = '#334155'; c.beginPath(); c.arc(-6, -4, 3.6, 0, 6.28); c.fill(); ink(c, 0.8);
      c.fillStyle = rad(c, -7, -5, 0, 3, [[0, '#e0f2fe'], [1, '#38bdf8']]); c.beginPath(); c.arc(-6, -4, 2.4, 0, 6.28); c.fill();
      hl(c, -7, -5.2, 1, 0.6, 0.9);
      rivets(c, [-13, -3, -13, 3, 6, -9, 10, -7, 13, -4, 2, 3, 8, 2]);
    },
  },
  thruster: {
    size: 34, rots: TINY,
    pal: [['#94a3b8', '#fb923c'], ['#a5b4fc', '#22d3ee'], ['#d6d3d1', '#f472b6']],
    draw(c, [col, fire]) {
      shadowOn(c, 1.3);
      // nozzle bell lying sideways (opening to the right)
      const bell = () => { c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(2, -5, 12, -10); c.lineTo(12, 10); c.quadraticCurveTo(2, 5, -12, 4); c.closePath(); };
      cel(c, bell, col, 0.32, 1.6);
      bell(); ink(c, 1);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.6;
      for (const k of [-4, 3]) { c.beginPath(); c.moveTo(k, -6 - (k + 4) * 0.25); c.lineTo(k, 6 + (k + 4) * 0.25); c.stroke(); }
      // opening
      c.fillStyle = '#1e1b2e'; c.beginPath(); c.ellipse(12, 0, 3.2, 10, 0, 0, 6.28); c.fill(); ink(c, 0.9);
      c.fillStyle = rad(c, 12, 0, 0, 8, [[0, shade(fire, 0.5, 0.9)], [0.5, shade(fire, 0, 0.5)], [1, shade(fire, 0, 0)]]);
      c.beginPath(); c.ellipse(12, 0, 2.4, 8, 0, 0, 6.28); c.fill();
      // back mount
      cel(c, () => rrect(c, -16, -5, 5, 10, 1.4), '#475569', 0.3, 0.8);
      rrect(c, -16, -5, 5, 10, 1.4); ink(c, 0.8);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-9, -3.6, 14, 1);
    },
  },
  wreck: {
    size: 46, rots: TINY,
    pal: [['#f1f5f9', '#f97316', '#38bdf8'], ['#fef3c7', '#14b8a6', '#f472b6'], ['#e0e7ff', '#8b5cf6', '#fde047']],
    draw(c, [col, stripe, glass]) {
      shadowOn(c, 1.6);
      // broken wing
      const wing = () => poly(c, [-2, 4, 10, 15, 15, 14, 9, 4]);
      cel(c, wing, shade(col, -0.08), 0.3, 1.2); wing(); ink(c, 0.9);
      shadowOn(c, 1.6);
      const body = () => { c.beginPath(); c.moveTo(-20, 2); c.quadraticCurveTo(-20, -8, -6, -9); c.lineTo(14, -7); c.quadraticCurveTo(21, -2, 16, 5); c.lineTo(-14, 8); c.quadraticCurveTo(-20, 7, -20, 2); c.closePath(); };
      cel(c, body, col, 0.26, 2);
      c.save(); body(); c.clip();
      c.fillStyle = stripe; poly(c, [-22, 1, 22, -2, 22, 2, -22, 5]); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(-6, -10, 1, 20); c.fillRect(6, -10, 1, 20);
      c.restore();
      body(); ink(c, 1);
      // cracked cockpit
      c.fillStyle = rad(c, 10, -5, 0, 7, [[0, '#ffffff'], [0.4, shade(glass, 0.3)], [1, glass]]);
      c.beginPath(); c.ellipse(11, -3.5, 5, 3.4, -0.15, 0, 6.28); c.fill(); ink(c, 0.8);
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(8.5, -5.5); c.lineTo(11, -3.4); c.lineTo(10, -1); c.moveTo(11, -3.4); c.lineTo(14, -3); c.stroke();
      // engine with dying glow
      c.fillStyle = '#334155'; rrect(c, -23, -3.5, 4.5, 7, 1.4); c.fill(); ink(c, 0.8);
      glow(c, -23, 0, 6, '#fb923c', 0.5);
      // other wing (behind) stub
      c.fillStyle = shade(col, -0.25); poly(c, [-4, -8, 2, -15, 6, -14, 3, -8]); c.fill(); ink(c, 0.8);
      rivets(c, [-15, -3, -10, -6, -2, -6, 4, -5, -12, 5, 0, 5]);
    },
  },
  droid: {
    size: 34, rots: TINY,
    pal: [['#f8fafc', '#fb923c', '#38bdf8'], ['#bbf7d0', '#0f766e', '#f472b6'], ['#e9d5ff', '#6d28d9', '#fde047']],
    draw(c, [col, trim, eye]) {
      shadowOn(c, 1.3);
      // slumped body
      const body = () => rrect(c, -8, -4, 16, 13, 4);
      cel(c, body, col, 0.25, 1.4); body(); ink(c, 0.9);
      c.fillStyle = trim; rrect(c, -8, 5, 16, 4, 2); c.fill(); ink(c, 0.6);
      c.fillStyle = '#1f2937'; rrect(c, -4, -1, 8, 4, 1); c.fill(); ink(c, 0.6);
      c.fillStyle = '#f87171'; c.fillRect(-3, 0.2, 1.4, 1.4); c.fillStyle = '#4ade80'; c.fillRect(-0.6, 0.2, 1.4, 1.4);
      // arm hanging
      c.strokeStyle = INK; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(8, -1); c.quadraticCurveTo(13, 2, 12, 8); c.stroke();
      c.strokeStyle = '#94a3b8'; c.lineWidth = 1.4; c.stroke();
      // tilted head
      shadowOn(c, 1);
      c.save(); c.translate(-2, -9); c.rotate(-0.35);
      cel(c, () => { c.beginPath(); c.ellipse(0, 0, 7, 5.6, 0, 0, 6.28); }, col, 0.22, 1);
      c.beginPath(); c.ellipse(0, 0, 7, 5.6, 0, 0, 6.28); ink(c, 0.9);
      c.fillStyle = '#0f172a'; rrect(c, -4.8, -2.4, 9.6, 4.6, 2.2); c.fill(); ink(c, 0.6);
      c.fillStyle = shade(eye, 0, 0.55); c.beginPath(); c.arc(-1.8, 0, 1.2, 0, 6.28); c.arc(1.8, 0, 1.2, 0, 6.28); c.fill();
      c.strokeStyle = INK; c.lineWidth = 0.7; c.beginPath(); c.moveTo(3, -5); c.lineTo(5, -8.5); c.stroke();
      c.restore();
      hl(c, -5.5, -12, 1.8, 0.8, 0.75);
    },
  },
  satellite: {
    size: 42, rots: TINY,
    pal: [['#e2e8f0', '#1d4ed8', '#fbbf24'], ['#fef3c7', '#0e7490', '#f472b6'], ['#ede9fe', '#4338ca', '#4ade80']],
    draw(c, [col, panel, acc]) {
      shadowOn(c, 1.3);
      const pan = (x: number, w: number, tilt: number) => {
        const path = () => poly(c, [x, -5 + tilt, x + w, -6 + tilt, x + w, 5 + tilt, x, 6 + tilt]);
        path(); c.fillStyle = panel; c.fill();
        shadowOff(c);
        c.save(); path(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.5;
        for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + (w * k) / 4, -8 + tilt); c.lineTo(x + (w * k) / 4, 8 + tilt); c.stroke(); }
        c.beginPath(); c.moveTo(x, tilt); c.lineTo(x + w, tilt - 0.5); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.18)'; poly(c, [x, -5 + tilt, x + w * 0.5, -5.5 + tilt, x + w * 0.2, 6 + tilt, x, 6 + tilt]); c.fill();
        c.restore();
        path(); ink(c, 0.8);
      };
      pan(-19, 12, 1); shadowOn(c, 1.3); pan(7, 12, -1);
      c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke();
      shadowOn(c, 1.2);
      cel(c, () => rrect(c, -5, -6, 10, 12, 2), col, 0.25, 1.2);
      rrect(c, -5, -6, 10, 12, 2); ink(c, 0.9);
      c.fillStyle = acc; rrect(c, -5, -1, 10, 2.4, 0.6); c.fill(); ink(c, 0.5);
      // dish on top
      c.fillStyle = '#f8fafc'; c.beginPath(); c.ellipse(1, -7, 4, 2.4, -0.3, 0, 6.28); c.fill(); ink(c, 0.7);
      c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(1, -7); c.lineTo(0, -11); c.stroke();
      c.fillStyle = '#f87171'; c.beginPath(); c.arc(0, -11, 0.9, 0, 6.28); c.fill();
      hl(c, -3, -4, 1.2, 0.6, 0.8);
    },
  },
  boulder: {
    size: 36, rots: TINY,
    pal: [['#6d5a8a', '#f472b6'], ['#52607e', '#22d3ee'], ['#7c5a5a', '#fbbf24']],
    draw(c, [col, cry], r) {
      shadowOn(c, 1.6);
      const seed = Math.floor(r() * 1e6);
      const sil = () => blobPath(c, 13, 9, mulberry(seed), 10, 0.16);
      cel(c, sil, col, 0.35, 2.4);
      sil(); ink(c, 1);
      c.save(); sil(); c.clip();
      for (let i = 0; i < 5; i++) {
        const x = (r() - 0.5) * 18, y = (r() - 0.5) * 10, s = 1.2 + r() * 1.8;
        c.fillStyle = shade(col, -0.32); ellipse(c, x, y, s, s * 0.7); c.fill();
        c.fillStyle = shade(col, 0.22); ellipse(c, x - 0.4, y - 0.4, s * 0.6, s * 0.4); c.fill();
      }
      c.save(); c.shadowColor = cry; c.shadowBlur = 4 * RS; c.strokeStyle = cry; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-10, 2); c.lineTo(-4, 0); c.lineTo(-1, 3); c.lineTo(5, 1); c.lineTo(9, 4); c.stroke();
      c.restore();
      c.restore();
      // crystals growing out of it
      glow(c, 6, -6, 9, cry, 0.4);
      prism(c, 4, -4, 9, 3.4, -0.3, cry);
      prism(c, 7.5, -3.5, 6.5, 2.8, 0.35, cry);
      prism(c, -6, -6, 5, 2.4, -0.5, cry);
      hl(c, -6, -5, 3, 1.2, 0.3);
    },
  },
  heap: {
    size: 50, rots: [0, 0.04, -0.04, 0.08],
    pal: [
      ['#7c6aa8', '#f472b6', '#67e8f9', '#fde68a', '#86efac'],
      ['#56648f', '#93c5fd', '#f9a8d4', '#fcd34d', '#c4b5fd'],
      ['#8a6a62', '#fb923c', '#cbd5e1', '#fcd34d', '#5eead4'],
    ],
    draw(c, p, r) {
      // a mound of compacted space junk, cel shaded, with colorful bits
      shadowOn(c, 1.6);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, a = Math.PI + t * Math.PI;
        const rr = 1 + (r() - 0.5) * 0.16;
        pts.push([Math.cos(a) * 21 * rr, 6 + Math.sin(a) * 15 * rr]);
      }
      const mound = () => { c.beginPath(); c.moveTo(-21, 8); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(21, 8); c.quadraticCurveTo(0, 13, -21, 8); c.closePath(); };
      cel(c, mound, p[0], 0.35, 3);
      c.save(); mound(); c.clip();
      c.fillStyle = rad(c, -7, -6, 1, 22, [[0, shade(p[0], 0.3, 0.6)], [1, shade(p[0], 0, 0)]]);
      c.fillRect(-24, -12, 48, 26);
      for (let i = 0; i < 46; i++) {
        const x = (r() - 0.5) * 40, y = -8 + r() * 18;
        const col = p[1 + Math.floor(r() * 4)];
        c.save(); c.translate(x, y); c.rotate(r() * 6.28);
        const w = 1.6 + r() * 3.4, h = 1 + r() * 2;
        const kind = r();
        c.fillStyle = shade(col, -0.35);
        if (kind < 0.35) { poly(c, [-w / 2, h / 2, 0, -h, w / 2, h / 2]); c.fill(); c.fillStyle = col; poly(c, [-w / 2, h / 2 - 0.3, 0, -h - 0.3, w * 0.1, h / 2 - 0.3]); c.fill(); }
        else if (kind < 0.7) { rrect(c, -w / 2, -h / 2, w, h, h / 2); c.fill(); c.fillStyle = col; rrect(c, -w / 2, -h / 2 - 0.3, w, h * 0.7, h / 2); c.fill(); }
        else { c.beginPath(); c.arc(0, 0, h * 0.7, 0, 6.28); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(-0.2, -0.2, h * 0.5, 0, 6.28); c.fill(); }
        c.restore();
      }
      c.fillStyle = lin(c, 0, -10, 0, 10, [[0, 'rgba(255,255,255,0.1)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(20,10,40,0.35)']]);
      c.fillRect(-24, -12, 48, 26);
      c.restore();
      mound(); ink(c, 1.1);
      // a crystal and a pipe sticking out
      glow(c, -7, -9, 6, p[2], 0.45);
      prism(c, -7, -6, 7, 2.6, -0.25, p[2]);
      c.strokeStyle = INK; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(7, -2); c.lineTo(12, -11); c.stroke();
      c.strokeStyle = p[1]; c.lineWidth = 1.1; c.stroke();
      c.fillStyle = p[4]; rrect(c, 0, -10, 6, 4, 1.4); c.fill(); ink(c, 0.6);
    },
  },
};

export const KINDS = Object.keys(KIND_DEFS) as ItemKind[];
export const KIND_INDEX: Record<string, number> = Object.fromEntries(KINDS.map((k, i) => [k, i]));
export const VARIANTS = 3;
export const ROTS = 4;

export interface ItemSprites { atlas: Atlas; sprites: Sprite[]; RS: number }

/** sprite index = kind*VARIANTS*ROTS + variant*ROTS + rot */
export function buildItemSprites(scale: number): ItemSprites {
  RS = scale;
  const atlas = new Atlas(2048);
  const sprites: Sprite[] = [];
  KINDS.forEach((kind, ki) => {
    const def = KIND_DEFS[kind];
    for (let v = 0; v < VARIANTS; v++) {
      const pal = def.pal[v % def.pal.length];
      for (let ro = 0; ro < ROTS; ro++) {
        const pad = 4;
        const S = Math.ceil((def.size + pad * 2) * scale);
        const cv = makeCanvas(S, S);
        const c = ctx2d(cv);
        c.translate(S / 2, S / 2);
        c.scale(scale, scale);
        c.rotate(def.rots[ro]);
        const rnd = mulberry(ki * 1000 + v * 10 + ro + 1);
        c.lineJoin = 'round';
        def.draw(c, pal, rnd);
        sprites[ki * VARIANTS * ROTS + v * ROTS + ro] = atlas.add(cv, S / 2 / scale, S / 2 / scale, scale);
      }
    }
  });
  atlas.finalize();
  return { atlas, sprites, RS: scale };
}
