import { ItemKind } from '../data/regions';
import { mulberry } from '../core/rng';
import { ctx2d, ellipse, lin, makeCanvas, poly, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;
type R = () => number;

export interface Sprite { page: number; sx: number; sy: number; sw: number; sh: number; ax: number; ay: number; w: number; h: number }

/** Simple shelf-packing atlas. */
export class Atlas {
  pages: HTMLCanvasElement[] = [];
  private x = 0; private y = 0; private rowH = 0;
  constructor(public size = 2048) { this.newPage(); }
  private newPage() { this.pages.push(makeCanvas(this.size, this.size)); this.x = 0; this.y = 0; this.rowH = 0; }
  add(src: HTMLCanvasElement, ax: number, ay: number, scale: number): Sprite {
    const w = src.width, h = src.height;
    if (this.x + w + 1 > this.size) { this.x = 0; this.y += this.rowH + 1; this.rowH = 0; }
    if (this.y + h + 1 > this.size) this.newPage();
    const page = this.pages.length - 1;
    ctx2d(this.pages[page]).drawImage(src, this.x, this.y);
    const s: Sprite = { page, sx: this.x, sy: this.y, sw: w, sh: h, ax, ay, w: w / scale, h: h / scale };
    this.x += w + 1;
    this.rowH = Math.max(this.rowH, h);
    return s;
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
function outline(c: C, col: string, w = 0.6) { c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
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
/** 3/4 box: top face and front face. */
function box34(c: C, x: number, y: number, w: number, h: number, depth: number, top: string | CanvasGradient, front: string | CanvasGradient, line = 'rgba(0,0,0,0.5)') {
  c.fillStyle = front;
  c.fillRect(x, y + h - depth, w, depth);
  c.fillStyle = top;
  c.fillRect(x, y, w, h - depth);
  c.strokeStyle = line; c.lineWidth = 0.6;
  c.strokeRect(x, y, w, h);
  c.beginPath(); c.moveTo(x, y + h - depth); c.lineTo(x + w, y + h - depth); c.stroke();
}

interface KindDef { size: number; pal: string[][]; rots: number[]; draw: (c: C, p: string[], r: R) => void }

const FULL = [0, 1.57, 3.14, 4.71].map((a) => a + 0.3);
const SOFT = [-0.5, -0.15, 0.2, 0.55];
const TINY = [-0.18, -0.06, 0.06, 0.18];

export const KIND_DEFS: Record<ItemKind, KindDef> = {
  bag: {
    size: 18, rots: SOFT,
    pal: [['#2a2d33'], ['#2f5d3a'], ['#2c4f86'], ['#cfd3d6'], ['#d9b43c'], ['#7a3b2e']],
    draw(c, [col], r) {
      shadowOn(c);
      blobPath(c, 7, 6, r, 9, 0.14);
      c.fillStyle = rad(c, 0, 0, 0, 8, [[0, shade(col, 0.32)], [0.55, col], [1, shade(col, -0.5)]], -2.5, -2.5);
      c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.65), 0.7);
      c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        const a = r() * 6.28, l = 2 + r() * 3;
        const x = Math.cos(a) * 3, y = Math.sin(a) * 2.5;
        c.moveTo(x, y); c.quadraticCurveTo(x + l * 0.6, y - 1, x + l, y + (r() - 0.5) * 2);
        c.strokeStyle = shade(col, -0.45, 0.7); c.lineWidth = 0.6; c.stroke();
      }
      c.beginPath(); c.ellipse(-2.5, -2.5, 2.2, 1.2, -0.6, 0, 6.28);
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fill();
      // knot
      c.fillStyle = shade(col, -0.2);
      poly(c, [-1, -5.5, -3.2, -8.5, -0.2, -7, 0.6, -8.8, 1.4, -5.5]); c.fill(); outline(c, shade(col, -0.65), 0.5);
    },
  },
  bottle: {
    size: 14, rots: FULL,
    pal: [['#8fd3ff', '#1e88e5'], ['#b9f6ca', '#2e7d32'], ['#ffffff', '#d32f2f'], ['#ffe082', '#f57c00']],
    draw(c, [col, cap]) {
      shadowOn(c, 0.7);
      rrect(c, -2.4, -5, 4.8, 10, 2);
      c.fillStyle = lin(c, -2.4, 0, 2.4, 0, [[0, shade(col, 0.5, 0.95)], [0.5, shade(col, 0, 0.85)], [1, shade(col, -0.35, 0.95)]]);
      c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.55), 0.5);
      c.fillStyle = shade(col, -0.1, 0.9); rrect(c, -1.3, -7.2, 2.6, 2.6, 0.8); c.fill();
      c.fillStyle = cap; rrect(c, -1.5, -8.6, 3, 1.7, 0.5); c.fill(); outline(c, shade(cap, -0.5), 0.4);
      c.fillStyle = shade(cap, 0.1); c.fillRect(-2.4, -1.2, 4.8, 3);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-1.6, -4, 0.7, 7.5);
    },
  },
  glassbottle: {
    size: 16, rots: FULL,
    pal: [['#2e7d32'], ['#6d3b12'], ['#b3e5fc'], ['#1b5e20']],
    draw(c, [col]) {
      shadowOn(c, 0.7);
      c.beginPath();
      c.moveTo(-2.6, 6); c.lineTo(-2.6, -1.5); c.quadraticCurveTo(-2.6, -3.5, -1, -4.5); c.lineTo(-1, -8); c.lineTo(1, -8); c.lineTo(1, -4.5);
      c.quadraticCurveTo(2.6, -3.5, 2.6, -1.5); c.lineTo(2.6, 6); c.closePath();
      c.fillStyle = lin(c, -2.6, 0, 2.6, 0, [[0, shade(col, 0.45, 0.95)], [0.4, shade(col, 0.05, 0.9)], [1, shade(col, -0.5, 0.95)]]);
      c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.6), 0.5);
      c.fillStyle = '#e8dcc0'; c.fillRect(-2.6, 0, 5.2, 3.2);
      c.fillStyle = '#b71c1c'; c.fillRect(-2.6, 1, 5.2, 1);
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(-1.7, -3, 0.6, 8);
      c.fillStyle = '#c9a227'; c.fillRect(-1.2, -8.6, 2.4, 1.2);
    },
  },
  can: {
    size: 12, rots: FULL,
    pal: [['#d32f2f'], ['#1565c0'], ['#2e7d32'], ['#fbc02d'], ['#6a1b9a']],
    draw(c, [col]) {
      shadowOn(c, 0.7);
      rrect(c, -2.8, -4.5, 5.6, 9, 1.2);
      c.fillStyle = lin(c, -2.8, 0, 2.8, 0, [[0, shade(col, 0.35)], [0.35, shade(col, 0.1)], [0.7, col], [1, shade(col, -0.5)]]);
      c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.6), 0.5);
      c.fillStyle = lin(c, -2.8, 0, 2.8, 0, [[0, '#f5f5f5'], [0.5, '#9e9e9e'], [1, '#616161']]);
      c.fillRect(-2.8, -4.5, 5.6, 1.4); c.fillRect(-2.8, 3.3, 5.6, 1.2);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(-1.6, -2.5, 4, 1.2);
      c.beginPath(); c.moveTo(-2.8, 1); c.lineTo(-0.5, 0); c.lineTo(1.5, 1.6); c.lineTo(2.8, 0.6);
      c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.5; c.stroke();
    },
  },
  paper: {
    size: 12, rots: FULL,
    pal: [['#f2efe6'], ['#e8dcc0'], ['#dfe8f0'], ['#f6e7a8']],
    draw(c, [col], r) {
      shadowOn(c, 0.6);
      c.beginPath();
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28, k = 3.2 + r() * 1.6;
        const x = Math.cos(a) * k, y = Math.sin(a) * k * 0.9;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.fillStyle = rad(c, -1, -1, 0, 5, [[0, '#fff'], [0.6, col], [1, shade(col, -0.25)]]);
      c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.45), 0.4);
      c.strokeStyle = shade(col, -0.3, 0.8); c.lineWidth = 0.4;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo((r() - 0.5) * 6, (r() - 0.5) * 6); c.lineTo((r() - 0.5) * 6, (r() - 0.5) * 6); c.stroke(); }
    },
  },
  newspaper: {
    size: 16, rots: SOFT,
    pal: [['#ece6d6'], ['#d9cfb4'], ['#f4f1ea']],
    draw(c, [col], r) {
      shadowOn(c, 0.5);
      poly(c, [-6, -4.5, 5.5, -5, 6.2, 4.2, -5.5, 4.8]);
      c.fillStyle = lin(c, -6, -5, 6, 5, [[0, '#fff'], [1, col]]);
      c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.45), 0.4);
      c.fillStyle = '#333'; c.fillRect(-4.5, -3.6, 6, 1.3);
      c.fillStyle = 'rgba(40,40,40,0.55)';
      for (let i = 0; i < 5; i++) c.fillRect(-4.5, -1.4 + i * 1.1, 4 + r() * 4.5, 0.45);
      c.fillStyle = 'rgba(80,80,80,0.5)'; c.fillRect(1.6, -1.6, 3, 2.6);
      c.beginPath(); c.moveTo(0.2, -5); c.lineTo(0.4, 4.6); c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.4; c.stroke();
    },
  },
  box: {
    size: 20, rots: TINY,
    pal: [['#b98a52'], ['#a87c45'], ['#c79b62'], ['#8f6a3c']],
    draw(c, [col], r) {
      shadowOn(c);
      c.fillStyle = col; c.fillRect(-7, -6, 14, 12);
      shadowOff(c);
      box34(c, -7, -6, 14, 12, 4, lin(c, 0, -6, 0, 2, [[0, shade(col, 0.2)], [1, shade(col, 0.05)]]), lin(c, 0, 2, 0, 6, [[0, shade(col, -0.25)], [1, shade(col, -0.45)]]), shade(col, -0.6));
      c.fillStyle = 'rgba(230,220,180,0.7)'; c.fillRect(-1.2, -6, 2.4, 8);
      // open flaps
      if (r() < 0.6) {
        c.fillStyle = shade(col, 0.28);
        poly(c, [-7, -6, -10, -9, -4, -8.5, -1, -6]); c.fill(); outline(c, shade(col, -0.6), 0.5);
        poly(c, [7, -6, 9.5, -9.5, 4, -8.8, 1, -6]); c.fill(); outline(c, shade(col, -0.6), 0.5);
      }
      c.fillStyle = 'rgba(40,20,0,0.45)'; c.font = '3px sans-serif'; c.fillText('↑↑', -5.5, 5.2);
    },
  },
  tire: {
    size: 20, rots: SOFT,
    pal: [['#2b2b2e'], ['#1f2022'], ['#34302c']],
    draw(c, [col], r) {
      shadowOn(c);
      c.beginPath(); c.arc(0, 0, 7.4, 0, 6.28);
      c.fillStyle = rad(c, 0, 0, 2.5, 7.6, [[0, shade(col, 0.3)], [0.55, shade(col, 0.18)], [1, shade(col, -0.4)]], -2, -2);
      c.fill();
      shadowOff(c);
      outline(c, '#0c0c0c', 0.7);
      // tread
      c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.9;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * 6.28;
        c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a + 0.12) * 7.3, Math.sin(a + 0.12) * 7.3); c.stroke();
      }
      // hole
      c.beginPath(); c.arc(0.3, 0.4, 3.3, 0, 6.28);
      c.fillStyle = rad(c, 0.3, 0.4, 0, 3.4, [[0, '#0d0b09'], [0.8, '#1a1714'], [1, '#3a3632']]);
      c.fill();
      c.beginPath(); c.arc(0, 0, 3.4, 3.4, 5.2); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.8; c.stroke();
      c.beginPath(); c.arc(0, 0, 6.6, 3.5, 4.6); c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1; c.stroke();
      if (r() < 0.3) { c.fillStyle = '#e0e0e0'; c.font = 'bold 1.6px sans-serif'; c.fillText('PNEU', -2, -4.6); }
    },
  },
  chair: {
    size: 20, rots: SOFT,
    pal: [['#eeeeee'], ['#2e7d32'], ['#c62828'], ['#1565c0']],
    draw(c, [col]) {
      shadowOn(c);
      rrect(c, -5.5, -3, 11, 9, 2); c.fillStyle = col; c.fill();
      shadowOff(c);
      c.fillStyle = lin(c, 0, -3, 0, 6, [[0, shade(col, 0.25)], [1, shade(col, -0.2)]]); c.fill(); outline(c, shade(col, -0.55));
      rrect(c, -6, -8, 12, 4.2, 1.6); c.fillStyle = lin(c, 0, -8, 0, -4, [[0, shade(col, 0.3)], [1, shade(col, -0.3)]]); c.fill(); outline(c, shade(col, -0.55));
      c.fillStyle = shade(col, -0.35);
      for (let i = 0; i < 3; i++) c.fillRect(-3.5 + i * 3, -7.2, 1.5, 2.6);
      c.fillStyle = shade(col, -0.4); c.fillRect(-5.3, 5.5, 1.6, 2.2); c.fillRect(3.7, 5.5, 1.6, 2.2);
    },
  },
  fridge: {
    size: 30, rots: TINY,
    pal: [['#f1efe6'], ['#a7dcc4'], ['#f2c6b4'], ['#d8d8d8']],
    draw(c, [col], r) {
      shadowOn(c, 1.2);
      c.fillStyle = col; c.fillRect(-7, -12, 14, 22);
      shadowOff(c);
      // top face
      c.fillStyle = lin(c, 0, -12, 0, -7, [[0, shade(col, 0.4)], [1, shade(col, 0.15)]]); c.fillRect(-7, -12, 14, 5);
      // front
      c.fillStyle = lin(c, -7, 0, 7, 0, [[0, shade(col, 0.05)], [0.7, shade(col, -0.08)], [1, shade(col, -0.3)]]); c.fillRect(-7, -7, 14, 17);
      c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.7; c.strokeRect(-7, -12, 14, 22);
      c.beginPath(); c.moveTo(-7, -7); c.lineTo(7, -7); c.moveTo(-7, -1); c.lineTo(7, -1); c.strokeStyle = shade(col, -0.45); c.stroke();
      c.fillStyle = '#9e9e9e'; rrect(c, 4.6, -6, 1.2, 4, 0.5); c.fill(); rrect(c, 4.6, 0.5, 1.2, 6, 0.5); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-6, -6.5, 1.2, 15);
      // rust & stickers
      c.fillStyle = 'rgba(140,70,20,0.45)'; ellipse(c, -2 + r() * 4, 6 + r() * 2, 2.2, 1.2); c.fill();
      if (r() < 0.6) { c.fillStyle = ['#ff7043', '#ffd54f', '#4fc3f7'][Math.floor(r() * 3)]; c.beginPath(); c.arc(-2, 3, 1.4, 0, 6.28); c.fill(); }
    },
  },
  washer: {
    size: 26, rots: TINY,
    pal: [['#f5f5f5'], ['#e3e7ea'], ['#efe7d3']],
    draw(c, [col]) {
      shadowOn(c, 1.1);
      c.fillStyle = col; c.fillRect(-7, -9, 14, 17);
      shadowOff(c);
      c.fillStyle = lin(c, 0, -9, 0, -5, [[0, shade(col, 0.3)], [1, shade(col, 0.05)]]); c.fillRect(-7, -9, 14, 4);
      c.fillStyle = lin(c, -7, 0, 7, 0, [[0, col], [1, shade(col, -0.3)]]); c.fillRect(-7, -5, 14, 13);
      c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.7; c.strokeRect(-7, -9, 14, 17);
      c.fillStyle = '#90a4ae'; c.fillRect(-6, -4.4, 12, 1.6);
      c.fillStyle = '#ef5350'; c.beginPath(); c.arc(4.6, -3.6, 0.6, 0, 6.28); c.fill();
      c.beginPath(); c.arc(0, 2.6, 4.3, 0, 6.28); c.fillStyle = '#b0bec5'; c.fill(); outline(c, '#546e7a', 0.6);
      c.beginPath(); c.arc(0, 2.6, 3.2, 0, 6.28); c.fillStyle = rad(c, -1, 1.5, 0, 3.5, [[0, '#cfe8f5'], [1, '#2b4a5a']]); c.fill();
      c.beginPath(); c.arc(0, 2.6, 2.6, 3.6, 4.8); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.6; c.stroke();
    },
  },
  crt: {
    size: 22, rots: TINY,
    pal: [['#d8ccb0'], ['#c7c2b8'], ['#3a3a3a']],
    draw(c, [col], r) {
      shadowOn(c);
      c.fillStyle = col; c.fillRect(-7, -8, 14, 14);
      shadowOff(c);
      c.fillStyle = lin(c, 0, -8, 0, -3, [[0, shade(col, 0.3)], [1, shade(col, 0.1)]]); c.fillRect(-6, -8, 12, 4);
      c.fillStyle = lin(c, 0, -4, 0, 6, [[0, col], [1, shade(col, -0.3)]]); c.fillRect(-7, -4, 14, 10);
      c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.6; c.strokeRect(-7, -4, 14, 10); c.strokeRect(-6, -8, 12, 4);
      rrect(c, -5.3, -2.8, 10.6, 7.2, 1.6);
      c.fillStyle = rad(c, -1, 0, 0, 7, [[0, '#3c5a4a'], [0.7, '#14241d'], [1, '#050806']]); c.fill();
      if (r() < 0.5) { c.beginPath(); c.moveTo(-3, -2); c.lineTo(0, 1); c.lineTo(-1, 3); c.moveTo(0, 1); c.lineTo(3, 0); c.strokeStyle = 'rgba(220,240,230,0.7)'; c.lineWidth = 0.35; c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.3)'; ellipse(c, -2.5, -1.5, 2, 0.8, -0.4); c.fill();
      c.fillStyle = '#7cb342'; c.fillRect(4.5, 5, 1, 0.6);
    },
  },
  monitor: {
    size: 22, rots: SOFT,
    pal: [['#2b2d30'], ['#e0e0e0'], ['#37474f']],
    draw(c, [col], r) {
      shadowOn(c);
      rrect(c, -8, -5.5, 16, 10, 1); c.fillStyle = col; c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.6), 0.6);
      c.fillStyle = lin(c, -7, -4.5, 7, 4, [[0, '#4a6a8a'], [0.5, '#16222e'], [1, '#0a0f14']]); c.fillRect(-7, -4.6, 14, 8.2);
      c.strokeStyle = 'rgba(230,240,255,0.65)'; c.lineWidth = 0.35;
      const cx = (r() - 0.5) * 6, cy = (r() - 0.5) * 4;
      for (let i = 0; i < 6; i++) { const a = r() * 6.28; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 4); c.stroke(); }
      c.fillStyle = shade(col, -0.2); c.fillRect(-1.5, 4.5, 3, 2); c.fillRect(-4, 6.2, 8, 1.4);
    },
  },
  wires: {
    size: 20, rots: FULL,
    pal: [['#e53935', '#1e88e5', '#fdd835'], ['#212121', '#43a047', '#fb8c00'], ['#8e24aa', '#eeeeee', '#00897b']],
    draw(c, p, r) {
      c.lineCap = 'round';
      shadowOn(c, 0.5);
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        let x = (r() - 0.5) * 10, y = (r() - 0.5) * 10;
        c.moveTo(x, y);
        for (let i = 0; i < 4; i++) {
          const nx = (r() - 0.5) * 13, ny = (r() - 0.5) * 13;
          c.bezierCurveTo(x + (r() - 0.5) * 12, y + (r() - 0.5) * 12, nx + (r() - 0.5) * 8, ny + (r() - 0.5) * 8, nx, ny);
          x = nx; y = ny;
        }
        c.strokeStyle = p[k]; c.lineWidth = 1.2; c.stroke();
      }
      shadowOff(c);
      c.fillStyle = '#e0c060'; c.fillRect(-1, -1, 2, 1.2);
    },
  },
  brick: {
    size: 20, rots: SOFT,
    pal: [['#b5502f'], ['#a8442a'], ['#c46a3e']],
    draw(c, [col], r) {
      const bricks: [number, number, number][] = [[-5, -2, 0.1], [1, -3, -0.2], [-2, 3, 0.3], [4, 2, 0.05]];
      for (const [x, y, a] of bricks) {
        if (r() < 0.15) continue;
        c.save(); c.translate(x, y); c.rotate(a + (r() - 0.5) * 0.4);
        shadowOn(c, 0.8);
        c.fillStyle = col; c.fillRect(-3.6, -1.8, 7.2, 3.6);
        shadowOff(c);
        c.fillStyle = lin(c, 0, -1.8, 0, 1.8, [[0, shade(col, 0.2)], [1, shade(col, -0.3)]]); c.fillRect(-3.6, -1.8, 7.2, 3.6);
        c.strokeStyle = shade(col, -0.55); c.lineWidth = 0.5; c.strokeRect(-3.6, -1.8, 7.2, 3.6);
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(-3.4, -1.6, 6.8, 0.6);
        c.restore();
      }
    },
  },
  rubble: {
    size: 22, rots: FULL,
    pal: [['#9a9a94'], ['#8a8780'], ['#b0aca2']],
    draw(c, [col], r) {
      for (let k = 0; k < 4; k++) {
        c.save(); c.translate((r() - 0.5) * 9, (r() - 0.5) * 8);
        const s = 2.5 + r() * 3;
        shadowOn(c, 0.8);
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + r() * 0.5, rr = s * (0.7 + r() * 0.5); if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        c.closePath();
        c.fillStyle = lin(c, -s, -s, s, s, [[0, shade(col, 0.3)], [1, shade(col, -0.35)]]); c.fill();
        shadowOff(c);
        outline(c, shade(col, -0.55), 0.5);
        c.restore();
      }
      c.beginPath(); c.moveTo(-6, 3); c.quadraticCurveTo(0, -1, 7, -4); c.strokeStyle = '#7a4a2a'; c.lineWidth = 0.8; c.stroke();
    },
  },
  scrap: {
    size: 22, rots: FULL,
    pal: [['#8d9aa3'], ['#9c6b44'], ['#6f7d86'], ['#b0855a']],
    draw(c, [col], r) {
      shadowOn(c);
      const pts: number[] = [];
      for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28, k = 5 + r() * 3.5; pts.push(Math.cos(a) * k, Math.sin(a) * k * 0.75); }
      poly(c, pts);
      c.fillStyle = lin(c, -7, -5, 7, 5, [[0, shade(col, 0.35)], [0.5, col], [1, shade(col, -0.4)]]); c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.6), 0.6);
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.5;
      for (let i = -3; i <= 3; i += 2) { c.beginPath(); c.moveTo(-6, i); c.lineTo(6, i - 1); c.stroke(); }
      c.fillStyle = 'rgba(150,70,20,0.55)';
      for (let i = 0; i < 3; i++) { ellipse(c, (r() - 0.5) * 8, (r() - 0.5) * 5, 1 + r() * 2, 0.8 + r()); c.fill(); }
      c.fillStyle = '#555'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-4 + i * 4, -3, 0.45, 0, 6.28); c.fill(); }
    },
  },
  barrel: {
    size: 20, rots: TINY,
    pal: [['#1565c0'], ['#c62828'], ['#9a5b2a'], ['#f9a825']],
    draw(c, [col], r) {
      shadowOn(c);
      c.fillStyle = col; c.fillRect(-5.5, -5, 11, 11);
      shadowOff(c);
      c.fillStyle = lin(c, -5.5, 0, 5.5, 0, [[0, shade(col, 0.25)], [0.4, col], [1, shade(col, -0.5)]]); c.fillRect(-5.5, -4, 11, 10);
      c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.6; c.strokeRect(-5.5, -4, 11, 10);
      c.fillStyle = shade(col, -0.3); c.fillRect(-5.5, -0.2, 11, 1); c.fillRect(-5.5, 3.4, 11, 1);
      ellipse(c, 0, -4.2, 5.5, 2.3); c.fillStyle = lin(c, -5, -6, 5, -2, [[0, shade(col, 0.35)], [1, shade(col, -0.2)]]); c.fill(); outline(c, shade(col, -0.6), 0.6);
      ellipse(c, 0, -4.2, 4.3, 1.6); outline(c, shade(col, -0.35), 0.5);
      c.beginPath(); c.arc(2, -4.3, 0.7, 0, 6.28); c.fillStyle = shade(col, -0.5); c.fill();
      if (col === '#f9a825') { c.fillStyle = '#222'; poly(c, [0, 0.2, -1.6, 2.8, 1.6, 2.8]); c.fill(); }
      c.fillStyle = 'rgba(120,60,10,0.5)'; ellipse(c, (r() - 0.5) * 6, 2 + r() * 2, 1.5, 1); c.fill();
    },
  },
  cardoor: {
    size: 24, rots: SOFT,
    pal: [['#b71c1c'], ['#1a237e'], ['#2e7d32'], ['#9e9e9e'], ['#f9a825']],
    draw(c, [col]) {
      shadowOn(c);
      c.beginPath(); c.moveTo(-9, -3); c.lineTo(-4, -6); c.lineTo(8, -6); c.lineTo(9, 5); c.lineTo(-9, 5); c.closePath();
      c.fillStyle = lin(c, 0, -6, 0, 5, [[0, shade(col, 0.3)], [0.5, col], [1, shade(col, -0.4)]]); c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.65), 0.7);
      c.beginPath(); c.moveTo(-7, -2.6); c.lineTo(-3.6, -4.8); c.lineTo(7, -4.8); c.lineTo(7.2, -0.6); c.lineTo(-7, -0.6); c.closePath();
      c.fillStyle = lin(c, -7, -5, 7, 0, [[0, '#9fc7de'], [0.5, '#3d5a6c'], [1, '#1d2b33']]); c.fill(); outline(c, '#222', 0.5);
      c.fillStyle = '#ccc'; c.fillRect(3.5, 1.2, 3, 0.9);
      c.fillStyle = 'rgba(140,70,20,0.5)'; ellipse(c, -5, 3.2, 2.5, 1); c.fill();
    },
  },
  carwreck: {
    size: 40, rots: TINY,
    pal: [['#b23a2e'], ['#2f5f8f'], ['#d2b04c'], ['#5c7a4a'], ['#7d7d7d']],
    draw(c, [col], r) {
      shadowOn(c, 1.4);
      rrect(c, -16, -8, 32, 17, 5); c.fillStyle = col; c.fill();
      shadowOff(c);
      rrect(c, -16, -8, 32, 17, 5);
      c.fillStyle = lin(c, 0, -8, 0, 9, [[0, shade(col, 0.25)], [0.6, col], [1, shade(col, -0.45)]]); c.fill(); outline(c, shade(col, -0.7), 0.8);
      // cabin
      rrect(c, -7, -6.5, 15, 13, 3); c.fillStyle = shade(col, -0.15); c.fill(); outline(c, shade(col, -0.6), 0.6);
      // windshields
      c.fillStyle = lin(c, 0, -6, 0, 6, [[0, '#a8cfe0'], [1, '#2a3f4c']]);
      poly(c, [8, -5.5, 11, -4.5, 11, 4.5, 8, 5.5]); c.fill();
      poly(c, [-7, -5.5, -9.5, -4.5, -9.5, 4.5, -7, 5.5]); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; poly(c, [8.6, -4, 10.3, -3.6, 10.3, -1, 8.6, -1.2]); c.fill();
      // roof shading + rust
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-6, -5.5, 13, 3);
      c.fillStyle = 'rgba(120,55,15,0.55)';
      for (let i = 0; i < 5; i++) { ellipse(c, (r() - 0.5) * 28, (r() - 0.5) * 14, 1.2 + r() * 2.8, 0.8 + r() * 1.6); c.fill(); }
      // lights
      c.fillStyle = '#fff7c2'; c.fillRect(14.5, -6, 1.2, 2.6); c.fillRect(14.5, 3.4, 1.2, 2.6);
      c.fillStyle = '#c62828'; c.fillRect(-15.7, -6, 1.1, 2.4); c.fillRect(-15.7, 3.6, 1.1, 2.4);
      // wheels sticking out
      c.fillStyle = '#1a1a1a';
      const wh: [number, number][] = [[-10, -9], [9, -9], [-10, 8.5], [9, 8.5]];
      for (const [x, y] of wh) if (r() > 0.25) rrect(c, x - 3, y - 1, 6, 2, 0.8), c.fill();
      // broken glass bits
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.3;
      c.beginPath(); c.moveTo(9, -2); c.lineTo(10.5, 1); c.lineTo(9.2, 3); c.stroke();
    },
  },
  pallet: {
    size: 22, rots: SOFT,
    pal: [['#b88b56'], ['#a07444'], ['#c9a06a']],
    draw(c, [col], r) {
      shadowOn(c);
      c.fillStyle = shade(col, -0.3); c.fillRect(-8, -6.5, 16, 13);
      shadowOff(c);
      for (let i = 0; i < 5; i++) {
        if (r() < 0.1) continue;
        const y = -6.5 + i * 2.8;
        c.fillStyle = lin(c, 0, y, 0, y + 2.2, [[0, shade(col, 0.2)], [1, shade(col, -0.2)]]);
        c.fillRect(-8, y, 16, 2.2);
        c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.4; c.strokeRect(-8, y, 16, 2.2);
        c.fillStyle = '#555'; c.fillRect(-6.5, y + 0.8, 0.6, 0.6); c.fillRect(6, y + 0.8, 0.6, 0.6);
      }
    },
  },
  sofa: {
    size: 34, rots: TINY,
    pal: [['#7b4a8c'], ['#8c5a3c'], ['#3f6e5e'], ['#a33b3b']],
    draw(c, [col], r) {
      shadowOn(c, 1.3);
      rrect(c, -13, -7, 26, 14, 3); c.fillStyle = col; c.fill();
      shadowOff(c);
      rrect(c, -13, -8, 26, 6, 2.5); c.fillStyle = lin(c, 0, -8, 0, -2, [[0, shade(col, 0.25)], [1, shade(col, -0.2)]]); c.fill(); outline(c, shade(col, -0.6), 0.6);
      rrect(c, -13, -4, 4, 11, 2); c.fillStyle = shade(col, -0.1); c.fill(); outline(c, shade(col, -0.6), 0.6);
      rrect(c, 9, -4, 4, 11, 2); c.fill(); outline(c, shade(col, -0.6), 0.6);
      for (let i = 0; i < 2; i++) {
        rrect(c, -9 + i * 9, -2.5, 8.8, 8.5, 2);
        c.fillStyle = lin(c, 0, -2, 0, 6, [[0, shade(col, 0.3)], [1, shade(col, -0.15)]]); c.fill(); outline(c, shade(col, -0.55), 0.5);
      }
      // tear with stuffing
      c.fillStyle = '#f0ead6'; ellipse(c, -4 + r() * 8, 1 + r() * 3, 2, 1.1, r()); c.fill();
      c.fillStyle = 'rgba(80,60,20,0.35)'; ellipse(c, 4, 3, 3, 1.5); c.fill();
    },
  },
  pipe: {
    size: 24, rots: FULL,
    pal: [['#8a8f94'], ['#a35d2c'], ['#cfcfcf'], ['#3d6e9e']],
    draw(c, [col]) {
      shadowOn(c, 0.8);
      rrect(c, -10, -2.2, 20, 4.4, 2); c.fillStyle = col; c.fill();
      shadowOff(c);
      c.fillStyle = lin(c, 0, -2.2, 0, 2.2, [[0, shade(col, 0.45)], [0.4, col], [1, shade(col, -0.5)]]); c.fill();
      outline(c, shade(col, -0.6), 0.5);
      ellipse(c, 10, 0, 1.1, 2.2); c.fillStyle = '#1b1b1b'; c.fill();
      c.fillStyle = shade(col, -0.25); c.fillRect(-4, -2.4, 1.4, 4.8);
    },
  },
  keyboard: {
    size: 20, rots: FULL,
    pal: [['#e6e2d8'], ['#2a2a2a'], ['#bdbdbd']],
    draw(c, [col], r) {
      shadowOn(c, 0.7);
      rrect(c, -8, -3, 16, 6, 1); c.fillStyle = col; c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.55), 0.5);
      const k = col === '#2a2a2a' ? '#555' : shade(col, -0.18);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 9; x++) {
        if (r() < 0.12) continue;
        c.fillStyle = k; c.fillRect(-7.3 + x * 1.62, -2.4 + y * 1.6, 1.3, 1.25);
      }
    },
  },
  circuit: {
    size: 16, rots: FULL,
    pal: [['#1b7a3a'], ['#1e5f8a'], ['#6b4a1e']],
    draw(c, [col], r) {
      shadowOn(c, 0.6);
      c.fillStyle = col; c.fillRect(-6, -4, 12, 8);
      shadowOff(c);
      c.fillStyle = lin(c, -6, -4, 6, 4, [[0, shade(col, 0.3)], [1, shade(col, -0.25)]]); c.fillRect(-6, -4, 12, 8);
      c.strokeStyle = '#d4b24c'; c.lineWidth = 0.35;
      for (let i = 0; i < 6; i++) { c.beginPath(); const y = -3.5 + r() * 7; c.moveTo(-6, y); c.lineTo(-2 + r() * 4, y); c.lineTo(-2 + r() * 4, -3.5 + r() * 7); c.stroke(); }
      c.fillStyle = '#1a1a1a'; c.fillRect(-2, -2, 4, 3); c.fillRect(2.8, 0.5, 2.2, 2.2);
      c.fillStyle = '#9e9e9e'; for (let i = 0; i < 4; i++) c.fillRect(-1.8 + i, -2.6, 0.4, 0.6);
      c.fillStyle = '#e53935'; c.beginPath(); c.arc(-4, 2, 0.7, 0, 6.28); c.fill();
    },
  },
  hubcap: {
    size: 16, rots: FULL,
    pal: [['#cfd8dc'], ['#b0bec5'], ['#e0c27a']],
    draw(c, [col]) {
      shadowOn(c, 0.7);
      c.beginPath(); c.arc(0, 0, 5.5, 0, 6.28);
      c.fillStyle = rad(c, 0, 0, 0, 5.5, [[0, '#fff'], [0.5, col], [1, shade(col, -0.45)]], -2, -2); c.fill();
      shadowOff(c);
      outline(c, shade(col, -0.6), 0.5);
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.6;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.beginPath(); c.moveTo(Math.cos(a) * 1.5, Math.sin(a) * 1.5); c.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); c.stroke(); }
      c.beginPath(); c.arc(0, 0, 1.5, 0, 6.28); c.fillStyle = shade(col, -0.2); c.fill();
    },
  },
  engine: {
    size: 26, rots: TINY,
    pal: [['#5d6166'], ['#6b5544'], ['#4a5560']],
    draw(c, [col], r) {
      shadowOn(c, 1.1);
      c.fillStyle = col; c.fillRect(-9, -7, 18, 14);
      shadowOff(c);
      c.fillStyle = lin(c, 0, -7, 0, 7, [[0, shade(col, 0.25)], [1, shade(col, -0.45)]]); c.fillRect(-9, -7, 18, 14);
      c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.6; c.strokeRect(-9, -7, 18, 14);
      for (let i = 0; i < 4; i++) {
        c.beginPath(); c.arc(-5.5 + i * 3.7, -2.5, 1.5, 0, 6.28);
        c.fillStyle = rad(c, -5.5 + i * 3.7, -2.5, 0, 1.6, [[0, '#9aa'], [1, '#333']]); c.fill();
      }
      c.fillStyle = '#c62828'; c.fillRect(-8, 2.5, 16, 1.4);
      c.fillStyle = '#222'; c.fillRect(-7, 4.5, 4, 2); c.fillRect(4, 4.5, 3, 2);
      c.fillStyle = 'rgba(20,10,0,0.5)'; ellipse(c, (r() - 0.5) * 8, 5, 3, 1.2); c.fill();
    },
  },
  cone: {
    size: 16, rots: TINY,
    pal: [['#ff6d00'], ['#ff8f00'], ['#f4511e']],
    draw(c, [col]) {
      shadowOn(c, 0.8);
      c.fillStyle = '#222'; c.fillRect(-5, 3, 10, 2.5);
      shadowOff(c);
      c.beginPath(); c.moveTo(-3.8, 3.5); c.lineTo(-0.9, -7); c.lineTo(0.9, -7); c.lineTo(3.8, 3.5); c.closePath();
      c.fillStyle = lin(c, -3.8, 0, 3.8, 0, [[0, shade(col, 0.3)], [0.5, col], [1, shade(col, -0.4)]]); c.fill(); outline(c, shade(col, -0.6), 0.5);
      c.fillStyle = '#f5f5f5'; poly(c, [-2.5, -0.8, 2.5, -0.8, 2.9, 0.8, -2.9, 0.8]); c.fill(); poly(c, [-1.6, -4.4, 1.6, -4.4, 1.9, -3.2, -1.9, -3.2]); c.fill();
    },
  },
  mattress: {
    size: 34, rots: TINY,
    pal: [['#e8e0d0'], ['#d6e4ec'], ['#efd9d9']],
    draw(c, [col], r) {
      shadowOn(c, 1.2);
      rrect(c, -13, -7.5, 26, 15, 3); c.fillStyle = col; c.fill();
      shadowOff(c);
      c.fillStyle = lin(c, 0, -7.5, 0, 7.5, [[0, shade(col, 0.2)], [1, shade(col, -0.2)]]); c.fill(); outline(c, shade(col, -0.5), 0.6);
      c.strokeStyle = shade(col, -0.18); c.lineWidth = 0.9;
      for (let i = -11; i <= 11; i += 3.2) { c.beginPath(); c.moveTo(i, -7); c.lineTo(i, 7); c.stroke(); }
      c.fillStyle = shade(col, -0.35); for (let x = -9; x <= 9; x += 6) for (let y = -4; y <= 4; y += 4) { c.beginPath(); c.arc(x, y, 0.5, 0, 6.28); c.fill(); }
      c.fillStyle = 'rgba(160,120,40,0.35)'; ellipse(c, (r() - 0.5) * 12, (r() - 0.5) * 6, 4, 2.6, r()); c.fill();
      c.strokeStyle = '#8d8d8d'; c.lineWidth = 0.6; c.beginPath(); c.arc(9, 4, 1.4, 0, 5); c.stroke();
    },
  },
  tvset: {
    size: 22, rots: TINY,
    pal: [['#6d4c2f'], ['#4e4e4e'], ['#8a6a3a']],
    draw(c, [col]) {
      shadowOn(c);
      rrect(c, -7.5, -6, 15, 12, 2); c.fillStyle = col; c.fill();
      shadowOff(c);
      c.fillStyle = lin(c, 0, -6, 0, 6, [[0, shade(col, 0.3)], [1, shade(col, -0.35)]]); c.fill(); outline(c, shade(col, -0.65), 0.6);
      rrect(c, -6, -4.5, 9, 8, 2); c.fillStyle = rad(c, -2, -1, 0, 6, [[0, '#4d5b56'], [1, '#101413']]); c.fill(); outline(c, '#111', 0.5);
      c.fillStyle = 'rgba(255,255,255,0.25)'; ellipse(c, -3.5, -2.5, 1.6, 0.8, -0.5); c.fill();
      c.fillStyle = '#c9b48a'; c.beginPath(); c.arc(5, -2.5, 1, 0, 6.28); c.fill(); c.beginPath(); c.arc(5, 0.5, 1, 0, 6.28); c.fill();
      c.strokeStyle = '#999'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-1, -6); c.lineTo(-4, -10); c.moveTo(1, -6); c.lineTo(4, -9.5); c.stroke();
    },
  },
  duck: {
    size: 12, rots: SOFT,
    pal: [['#ffd600'], ['#ffca28']],
    draw(c, [col]) {
      shadowOn(c, 0.7);
      ellipse(c, 0, 1, 4.5, 3.2); c.fillStyle = col; c.fill();
      shadowOff(c);
      ellipse(c, 0, 1, 4.5, 3.2); c.fillStyle = rad(c, -1, 0, 0, 5, [[0, shade(col, 0.4)], [1, shade(col, -0.3)]]); c.fill(); outline(c, shade(col, -0.55), 0.4);
      c.beginPath(); c.arc(-2, -2.2, 2.3, 0, 6.28); c.fillStyle = col; c.fill(); outline(c, shade(col, -0.55), 0.4);
      c.fillStyle = '#ff7043'; ellipse(c, -4.2, -1.8, 1.3, 0.7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(-2.6, -2.8, 0.45, 0, 6.28); c.fill();
    },
  },
  shoe: {
    size: 14, rots: FULL,
    pal: [['#3e2723'], ['#eceff1'], ['#c62828'], ['#1565c0']],
    draw(c, [col]) {
      shadowOn(c, 0.7);
      c.beginPath(); c.moveTo(-5, -1.8); c.quadraticCurveTo(-5, -3, -2, -3); c.lineTo(1, -2.6); c.quadraticCurveTo(5.5, -2.5, 5.5, 0.5); c.quadraticCurveTo(5.5, 2.6, 2, 2.6); c.lineTo(-4, 2.6); c.quadraticCurveTo(-5.5, 2.6, -5, -1.8); c.closePath();
      c.fillStyle = col; c.fill();
      shadowOff(c);
      c.fillStyle = lin(c, 0, -3, 0, 3, [[0, shade(col, 0.3)], [1, shade(col, -0.3)]]); c.fill(); outline(c, shade(col, -0.6), 0.5);
      c.fillStyle = '#f5f5f5'; c.fillRect(-5, 1.6, 10.5, 1);
      ellipse(c, -2.5, -0.5, 1.8, 1.2); c.fillStyle = '#1a1a1a'; c.fill();
      c.strokeStyle = '#eee'; c.lineWidth = 0.3; c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(0 + i, -2.2); c.lineTo(0.6 + i, -0.8); } c.stroke();
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
  return { atlas, sprites, RS: scale };
}
