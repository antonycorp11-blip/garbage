import { INK } from './detail';
import { ellipse, lin, makeCanvas, poly, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

/**
 * Procedural icons for the six materials (index order fixed):
 * 0 Cristal, 1 Liga Estelar, 2 Biogel, 3 Âmbar, 4 Plasma, 5 Relíquias.
 * Drawn in a 32×32 box centered on the origin, ink outline + cel shading.
 */
function ink(c: C, w = 1.6) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }

function sparkle(c: C, x: number, y: number, r: number, a = 0.95) {
  c.fillStyle = `rgba(255,255,255,${a})`;
  c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
}

function prism(c: C, cx: number, base: number, w: number, h: number, tilt: number, col: string) {
  // a hexagonal crystal point: left face, right face, tip
  c.save(); c.translate(cx, base); c.rotate(tilt);
  const hw = w / 2, tipH = w * 0.9;
  const outline = () => { c.beginPath(); c.moveTo(-hw, 0); c.lineTo(-hw, -h); c.lineTo(0, -h - tipH); c.lineTo(hw, -h); c.lineTo(hw, 0); c.closePath(); };
  outline(); c.fillStyle = col; c.fill();
  // right face shade
  c.beginPath(); c.moveTo(0, 0.5); c.lineTo(0, -h); c.lineTo(hw, -h); c.lineTo(hw, 0); c.closePath(); c.fillStyle = shade(col, -0.22); c.fill();
  // tip facets
  c.beginPath(); c.moveTo(-hw, -h); c.lineTo(0, -h - tipH); c.lineTo(0, -h); c.closePath(); c.fillStyle = shade(col, 0.4); c.fill();
  c.beginPath(); c.moveTo(0, -h); c.lineTo(0, -h - tipH); c.lineTo(hw, -h); c.closePath(); c.fillStyle = shade(col, 0.1); c.fill();
  // highlight streak
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-hw + w * 0.18, -h + 1, w * 0.14, h * 0.75);
  outline(); ink(c, 1.4);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h); c.strokeStyle = shade(col, -0.45, 0.6); c.lineWidth = 0.7; c.stroke();
  c.restore();
}

function crystal(c: C) {
  c.fillStyle = 'rgba(40,15,40,0.28)'; ellipse(c, 0, 11.5, 12, 3); c.fill();
  prism(c, -7, 11, 7, 9, -0.38, '#f9a8d4');
  prism(c, 7.5, 11, 7, 8, 0.4, '#e879f9');
  prism(c, 0, 12, 9, 13, 0, '#f472b6');
  sparkle(c, 5, -9, 3.2);
  sparkle(c, -9.5, -1, 1.8, 0.8);
}

function alloy(c: C) {
  c.fillStyle = 'rgba(15,20,45,0.3)'; ellipse(c, 0, 11, 14, 3.4); c.fill();
  // 3/4 ingot: top trapezoid + front + side
  const top = [-9, -4, 9, -4, 13, 1, -13, 1];
  const front = [-13, 1, 13, 1, 13, 9, -13, 9];
  poly(c, front); c.fillStyle = lin(c, 0, 1, 0, 9, [[0, '#7aa7e8'], [1, '#4c74b8']]); c.fill(); ink(c);
  poly(c, top); c.fillStyle = lin(c, -10, -4, 10, 1, [[0, '#dbeafe'], [1, '#93c5fd']]); c.fill(); ink(c);
  // bevel side shading
  poly(c, [9, -4, 13, 1, 13, 9]); c.fillStyle = 'rgba(30,50,110,0.35)'; c.fill();
  // stamped star
  c.save(); c.translate(0, -1.5); c.scale(1, 0.55);
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 2.4 : 5.4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fillStyle = '#5b86cf'; c.fill(); c.strokeStyle = '#eaf2ff'; c.lineWidth = 0.9; c.stroke();
  c.restore();
  // rim light + rivets on the front
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8, -3); c.lineTo(5, -3); c.stroke();
  c.fillStyle = '#c7dbff'; for (const x of [-9, 9]) { c.beginPath(); c.arc(x, 5, 1, 0, 6.28); c.fill(); }
  sparkle(c, 10, -7, 2.4);
}

function biogel(c: C) {
  c.fillStyle = 'rgba(10,40,20,0.3)'; ellipse(c, 0, 13, 10, 2.6); c.fill();
  const drop = () => { c.beginPath(); c.moveTo(0, -13); c.bezierCurveTo(4, -6, 11, -1, 11, 5); c.arc(0, 5, 11, 0, Math.PI); c.bezierCurveTo(-11, -1, -4, -6, 0, -13); c.closePath(); };
  // glow
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rad(c, 0, 4, 0, 16, [[0, 'rgba(134,239,172,0.45)'], [1, 'rgba(134,239,172,0)']]); c.beginPath(); c.arc(0, 4, 16, 0, 6.28); c.fill(); c.restore();
  // glass droplet
  drop(); c.fillStyle = 'rgba(220,255,235,0.35)'; c.fill();
  c.save(); drop(); c.clip();
  // gel inside with a wobbly meniscus
  c.beginPath(); c.moveTo(-13, -1); c.quadraticCurveTo(-5, -4, 0, -1); c.quadraticCurveTo(6, 2, 13, -2); c.lineTo(13, 18); c.lineTo(-13, 18); c.closePath();
  c.fillStyle = lin(c, 0, -2, 0, 16, [[0, '#bbf7d0'], [0.4, '#4ade80'], [1, '#15803d']]); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  for (const [bx, by, r] of [[-4, 6, 1.8], [3, 9, 1.2], [5, 3, 0.9], [-1, 12, 0.8]]) { c.beginPath(); c.arc(bx, by, r, 0, 6.28); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-5.5, -2, 2, 5, 0.4, 0, 6.28); c.fill();
  c.restore();
  drop(); ink(c);
  sparkle(c, 7, -6, 2.2);
}

function amber(c: C) {
  c.fillStyle = 'rgba(50,20,5,0.3)'; ellipse(c, 0, 11.5, 12, 3); c.fill();
  const pts = [-11, -3, -6, -11, 4, -12, 11, -5, 12, 4, 6, 11, -5, 11, -12, 5];
  const body = () => { c.beginPath(); for (let i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
  body(); c.fillStyle = rad(c, -2, -3, 1, 16, [[0, '#fed7aa'], [0.35, '#fb923c'], [1, '#c2410c']]); c.fill();
  c.save(); body(); c.clip();
  // tiny fossil: a spiral shell
  c.strokeStyle = 'rgba(80,30,5,0.75)'; c.lineWidth = 1.1;
  c.beginPath();
  for (let a = 0; a < 12; a += 0.3) { const r = 0.45 * a; c.lineTo(2 + Math.cos(a) * r, 3 + Math.sin(a) * r); }
  c.stroke();
  // facets
  c.fillStyle = 'rgba(255,240,210,0.35)'; poly(c, [-11, -3, -6, -11, -1, -4]); c.fill();
  c.fillStyle = 'rgba(120,40,0,0.25)'; poly(c, [12, 4, 6, 11, 3, 4]); c.fill();
  c.restore();
  body(); ink(c);
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-5, -6, 2.6, 1.2, -0.7, 0, 6.28); c.fill();
  sparkle(c, 8, -8, 2.2);
}

function plasma(c: C) {
  c.fillStyle = 'rgba(5,30,40,0.3)'; ellipse(c, 0, 13, 10, 2.6); c.fill();
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = rad(c, 0, 1, 0, 15, [[0, 'rgba(34,211,238,0.55)'], [1, 'rgba(34,211,238,0)']]); c.beginPath(); c.arc(0, 1, 15, 0, 6.28); c.fill();
  c.restore();
  // glass tube
  rrect(c, -7, -8, 14, 18, 3); c.fillStyle = lin(c, -7, 0, 7, 0, [[0, '#0e7490'], [0.5, '#22d3ee'], [1, '#0e7490']]); c.fill();
  // energy bolt inside
  c.save(); rrect(c, -7, -8, 14, 18, 3); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-7, -8, 14, 18);
  c.beginPath(); c.moveTo(1.5, -8); c.lineTo(-3.5, 2); c.lineTo(0.5, 2); c.lineTo(-1.5, 10); c.lineTo(4, -1); c.lineTo(0, -1); c.closePath();
  c.fillStyle = '#ecfeff'; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-5.5, -7, 2, 16);
  c.restore();
  rrect(c, -7, -8, 14, 18, 3); ink(c);
  // cream caps + terminal
  for (const [y, h] of [[-12, 5], [9, 5]]) { rrect(c, -8.5, y, 17, h, 2); c.fillStyle = '#f3ead8'; c.fill(); c.fillStyle = '#ff9a3c'; c.fillRect(-8.5, y + h - 1.8, 17, 1.4); rrect(c, -8.5, y, 17, h, 2); ink(c, 1.3); }
  rrect(c, -3, -15, 6, 3.5, 1); c.fillStyle = '#d8c9ad'; c.fill(); ink(c, 1.1);
  sparkle(c, 9, -9, 2.2);
}

function relic(c: C) {
  c.fillStyle = 'rgba(30,10,45,0.3)'; ellipse(c, 0, 13, 12, 2.8); c.fill();
  // gold medallion rim (slightly 3/4)
  ellipse(c, 0, 1.5, 12.5, 12); c.fillStyle = '#a16207'; c.fill(); ink(c);
  ellipse(c, 0, 0, 12.5, 12); c.fillStyle = rad(c, -3, -4, 1, 14, [[0, '#fff3b0'], [0.5, '#facc15'], [1, '#b45309']]); c.fill(); ink(c);
  // glyph notches around
  c.strokeStyle = 'rgba(120,60,0,0.8)'; c.lineWidth = 1;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; c.beginPath(); c.moveTo(Math.cos(a) * 9, Math.sin(a) * 8.6); c.lineTo(Math.cos(a) * 11, Math.sin(a) * 10.5); c.stroke(); }
  // violet gem in the middle
  c.beginPath(); c.moveTo(0, -7); c.lineTo(6, -1); c.lineTo(0, 7); c.lineTo(-6, -1); c.closePath();
  c.fillStyle = '#a855f7'; c.fill();
  c.beginPath(); c.moveTo(0, -7); c.lineTo(6, -1); c.lineTo(0, -1); c.closePath(); c.fillStyle = '#e9d5ff'; c.fill();
  c.beginPath(); c.moveTo(0, -1); c.lineTo(6, -1); c.lineTo(0, 7); c.closePath(); c.fillStyle = '#6b21a8'; c.fill();
  c.beginPath(); c.moveTo(0, -7); c.lineTo(6, -1); c.lineTo(0, 7); c.lineTo(-6, -1); c.closePath(); ink(c, 1.3);
  sparkle(c, 8, -9, 2.8);
  sparkle(c, -9, 6, 1.6, 0.8);
}

const DRAW = [crystal, alloy, biogel, amber, plasma, relic];

/** Draws material k centered at (x, y) inside a size×size box (vector, for UI/thumbnails). */
export function drawMatIconVector(c: C, k: number, x: number, y: number, size: number) {
  c.save();
  c.translate(x, y);
  c.scale(size / 32, size / 32);
  c.lineJoin = 'round'; c.lineCap = 'round';
  DRAW[Math.max(0, Math.min(DRAW.length - 1, k))](c);
  c.restore();
}

const bitmaps = new Map<string, HTMLCanvasElement>();
function bitmap(k: number, px: number): HTMLCanvasElement {
  const key = `${k}:${px}`;
  let cv = bitmaps.get(key);
  if (!cv) {
    cv = makeCanvas(px, px);
    drawMatIconVector(cv.getContext('2d')!, k, px / 2, px / 2, px);
    bitmaps.set(key, cv);
  }
  return cv;
}

/** Draws material k centered at (x, y), size px wide (uses a cached bitmap: cheap per frame). */
export function drawMatIcon(c: C, k: number, x: number, y: number, size: number) {
  const px = size <= 12 ? 48 : 96;
  c.drawImage(bitmap(k, px), x - size / 2, y - size / 2, size, size);
}

const urls = new Map<string, string>();
/** Cached data URL of material k (for <img> in the UI). */
export function matIconURL(k: number, px = 64): string {
  const key = `${k}:${px}`;
  let u = urls.get(key);
  if (!u) {
    u = bitmap(k, px).toDataURL();
    urls.set(key, u);
  }
  return u;
}
