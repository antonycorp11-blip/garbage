import { TILE, inWorld, tileIndex } from '../core/constants';
import { hash2 } from '../core/rng';
import { G_ASPHALT, G_CONCRETE, G_DIRT, G_EARTH, G_GRAVEL, G_RUINFLOOR, R_CARS, R_CONSTRUCTION, R_INDUSTRIAL } from '../data/regions';
import { World } from '../world/World';
import { blit, cachedLayer, cylinder34, hazardStripes, pipe, plate, rivetRow, stencil, weather } from './detail';
import { ellipse, groundShadow, lin, poly, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

export type PropKind = 'tree' | 'bush' | 'lamp' | 'sign' | 'hydrant' | 'manhole' | 'puddle' | 'bench' | 'fence' | 'rocks' | 'pillar' | 'barrier' | 'tracks' | 'stump' | 'flowers';

const SIGNS = ['PROIBIDO\nJOGAR LIXO', 'VENDE-SE\nR$ 1,00', 'ÁREA DE\nPRESERVAÇÃO', 'CUIDADO\nRATAZANAS', 'BEM-VINDO\nAO LIXÃO', 'PARE', 'PERIGO\nCHEIRO', 'VELOC.\nMÁX 5'];

/** Deterministic decorative prop for a tile (shown only when the tile is clean). */
export function propAt(w: World, tx: number, ty: number): { kind: PropKind; v: number } | null {
  if (!inWorld(tx, ty)) return null;
  const i = tileIndex(tx, ty);
  if (w.initial[i] === 0 && w.region[i] === 0) {
    // the starting clearing gets a couple of fixed props
    const h = hash2(tx, ty, 404);
    return h < 0.05 ? { kind: 'flowers', v: Math.floor(h * 1000) } : null;
  }
  const g = w.ground[i];
  const h = hash2(tx, ty, 123);
  const v = Math.floor(hash2(tx, ty, 124) * 1000);
  if (g === G_ASPHALT) {
    const edge = (x: number, y: number) => inWorld(x, y) && w.ground[tileIndex(x, y)] !== G_ASPHALT;
    const nearEdge = edge(tx, ty - 1) || edge(tx, ty + 1) || edge(tx - 1, ty) || edge(tx + 1, ty);
    if (nearEdge && (tx + ty) % 11 === 0) return { kind: 'lamp', v };
    if (nearEdge && h < 0.02) return { kind: 'hydrant', v };
    if (nearEdge && h > 0.985) return { kind: 'sign', v };
    if (h > 0.4 && h < 0.43) return { kind: 'manhole', v };
    if (h > 0.6 && h < 0.63) return { kind: 'tracks', v };
    return null;
  }
  if (h > 0.045) return null;
  const k = h / 0.045;
  const reg = w.region[i];
  if (g === G_RUINFLOOR) return { kind: k < 0.45 ? 'pillar' : k < 0.7 ? 'rocks' : 'puddle', v };
  if (g === G_CONCRETE) return { kind: k < 0.35 ? 'puddle' : k < 0.6 ? (reg === R_INDUSTRIAL || reg === R_CARS ? 'barrier' : 'bench') : k < 0.8 ? 'manhole' : 'sign', v };
  if (g === G_GRAVEL) return { kind: k < 0.4 ? 'rocks' : k < 0.65 ? 'tracks' : reg === R_CONSTRUCTION ? 'barrier' : 'stump', v };
  if (g === G_EARTH || g === G_DIRT) return { kind: k < 0.28 ? 'tree' : k < 0.48 ? 'bush' : k < 0.6 ? 'fence' : k < 0.72 ? 'puddle' : k < 0.82 ? 'sign' : k < 0.9 ? 'stump' : 'flowers', v };
  return null;
}

export function drawProp(c: C, kind: PropKind, v: number, tx: number, ty: number) {
  const x = tx * TILE, y = ty * TILE;
  const e = propLayer(kind, v);
  blit(c, e, x, y);
}

function propLayer(kind: PropKind, v: number) {
  const variant = kind === 'sign' ? v % SIGNS.length : v % 4;
  return cachedLayer(`prop-${kind}-${variant}`, -24, -56, 80, 96, (c) => drawPropShape(c, kind, variant, v));
}

function drawPropShape(c: C, kind: PropKind, variant: number, v: number) {
  const cx = 16, by = 24;
  switch (kind) {
    case 'tree': {
      groundShadow(c, cx + 8, by + 2, 20, 7, 0.35);
      // trunk
      c.fillStyle = lin(c, cx - 3, 0, cx + 3, 0, [[0, '#7a5a3a'], [0.5, '#5a3f26'], [1, '#3a2716']]);
      poly(c, [cx - 3.4, by + 1, cx - 2, by - 22, cx + 2, by - 22, cx + 3.6, by + 1]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx - 1.5 + i, by); c.lineTo(cx - 1 + i * 0.6, by - 18); c.stroke(); }
      // roots
      c.strokeStyle = '#4a321e'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx - 3, by); c.quadraticCurveTo(cx - 7, by + 1, cx - 9, by + 3); c.moveTo(cx + 3, by); c.quadraticCurveTo(cx + 7, by, cx + 9, by + 2); c.stroke();
      // branches
      c.strokeStyle = '#4b3420'; c.lineCap = 'round';
      const br = (x0: number, y0: number, a: number, l: number, w: number, d: number) => {
        const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
        c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        if (d > 0) { br(x1, y1, a - 0.5, l * 0.7, w * 0.65, d - 1); br(x1, y1, a + 0.45, l * 0.65, w * 0.65, d - 1); }
      };
      br(cx, by - 21, -Math.PI / 2 - 0.1 + (variant - 1.5) * 0.1, 10, 2.6, 3);
      // sparse leaves on some variants
      if (variant >= 2) {
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7, r = 9 + (i % 3) * 4;
          const lx = cx + Math.cos(a) * r, ly = by - 38 + Math.sin(a) * r * 0.6;
          c.fillStyle = rad(c, lx - 1, ly - 1, 0, 5, [[0, '#8bb35a'], [1, '#4f7a2e']]);
          c.beginPath(); c.arc(lx, ly, 3.5 + (i % 2), 0, 6.28); c.fill();
        }
      }
      break;
    }
    case 'stump': {
      groundShadow(c, cx + 3, by - 2, 8, 3, 0.3);
      cylinder34(c, cx, by - 9, 5, 6, '#6b4a2e', 0);
      c.strokeStyle = '#a07a50'; c.lineWidth = 0.4; for (let r = 1; r < 5; r += 1.3) { c.beginPath(); c.ellipse(cx, by - 9, r, r * 0.42, 0, 0, 6.28); c.stroke(); }
      c.fillStyle = '#c4a271'; c.beginPath(); c.ellipse(cx + 3, by - 4, 1.4, 0.8, 0, 0, 6.28); c.fill();
      break;
    }
    case 'bush': {
      groundShadow(c, cx + 3, by - 2, 12, 4, 0.3);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 6.28, r = 5;
        const lx = cx + Math.cos(a) * r, ly = by - 8 + Math.sin(a) * r * 0.5;
        c.fillStyle = rad(c, lx - 2, ly - 2, 0, 7, [[0, variant % 2 ? '#a3c46c' : '#9bb85d'], [1, variant % 2 ? '#4e7a34' : '#5d6e2a']]);
        c.beginPath(); c.arc(lx, ly, 5, 0, 6.28); c.fill();
      }
      if (variant === 3) for (let i = 0; i < 5; i++) { c.fillStyle = '#e53935'; c.beginPath(); c.arc(cx - 6 + i * 3, by - 10 + (i % 2) * 3, 0.9, 0, 6.28); c.fill(); }
      break;
    }
    case 'flowers': {
      for (let i = 0; i < 6; i++) {
        const fx = cx - 8 + (i * 37 + v) % 16, fy = by - 6 + (i * 13) % 8;
        c.strokeStyle = '#4f7a2e'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(fx, fy + 3); c.lineTo(fx, fy); c.stroke();
        c.fillStyle = ['#ffd54f', '#f48fb1', '#fff', '#ce93d8'][(i + v) % 4];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; c.beginPath(); c.arc(fx + Math.cos(a) * 1.1, fy + Math.sin(a) * 1.1, 0.8, 0, 6.28); c.fill(); }
        c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(fx, fy, 0.6, 0, 6.28); c.fill();
      }
      break;
    }
    case 'lamp': {
      groundShadow(c, cx + 12, by + 2, 14, 3, 0.25);
      c.fillStyle = '#3a3f44'; ellipse(c, cx, by, 3, 1.4); c.fill();
      pipe(c, [cx, by, cx, by - 44, cx + 3, by - 48, cx + 9, by - 48], 1.8, '#5b6268');
      c.fillStyle = '#2b2f33'; poly(c, [cx + 6, by - 49, cx + 14, by - 49, cx + 13, by - 46, cx + 7, by - 46]); c.fill();
      c.fillStyle = variant === 0 ? '#5d5d5d' : '#fff3c4'; c.fillRect(cx + 7.5, by - 46, 5, 0.9);
      break;
    }
    case 'sign': {
      const text = SIGNS[variant];
      groundShadow(c, cx + 6, by + 1, 12, 3, 0.3);
      pipe(c, [cx - 6, by, cx - 6, by - 20], 1.4, '#6b7378');
      pipe(c, [cx + 6, by, cx + 6, by - 20], 1.4, '#6b7378');
      const red = text === 'PARE';
      if (red) {
        c.fillStyle = '#c62828';
        c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + 0.39; c.lineTo(cx + Math.cos(a) * 9, by - 26 + Math.sin(a) * 9); } c.closePath(); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 0.8; c.stroke();
        stencil(c, 'PARE', cx, by - 26, 5, '#fff');
      } else {
        c.save(); c.translate(cx, by - 27); c.rotate((variant - 3) * 0.04);
        rrect(c, -13, -8, 26, 15, 1.5);
        c.fillStyle = variant % 3 === 0 ? '#f2f2e6' : variant % 3 === 1 ? '#ffd54f' : '#2f6f4f'; c.fill();
        c.strokeStyle = '#333'; c.lineWidth = 0.7; c.stroke();
        weather(c, -13, -8, 26, 15, 1, v);
        const lines = text.split('\n');
        lines.forEach((ln, i) => stencil(c, ln, 0, -1 + (i - (lines.length - 1) / 2) * 5.4, 4.2, variant % 3 === 2 ? '#fff' : '#222'));
        c.restore();
      }
      break;
    }
    case 'hydrant': {
      groundShadow(c, cx + 3, by - 1, 6, 2.4, 0.3);
      cylinder34(c, cx, by - 11, 3.4, 10, '#d32f2f', 1);
      c.fillStyle = '#b71c1c'; c.beginPath(); c.arc(cx, by - 11.5, 3.2, Math.PI, 0); c.fill();
      c.fillStyle = '#e0e0e0'; c.fillRect(cx - 5.4, by - 7.5, 2.2, 2); c.fillRect(cx + 3.2, by - 7.5, 2.2, 2);
      c.fillStyle = '#f5f5f5'; c.fillRect(cx - 3.4, by - 4, 6.8, 1.2);
      break;
    }
    case 'manhole': {
      c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, cx + 0.6, by - 7.5, 8, 5); c.fill();
      ellipse(c, cx, by - 8, 8, 5); c.fillStyle = lin(c, cx - 8, by - 13, cx + 8, by - 3, [[0, '#6b6d70'], [1, '#2f3133']]); c.fill();
      c.strokeStyle = '#1b1c1d'; c.lineWidth = 0.6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 0.5;
      for (let i = -6; i <= 6; i += 2) { c.beginPath(); c.moveTo(cx + i, by - 12); c.lineTo(cx + i, by - 4); c.stroke(); }
      stencil(c, 'ESGOTO', cx, by - 8, 2.4, 'rgba(255,255,255,0.35)');
      break;
    }
    case 'puddle': {
      c.save();
      c.beginPath();
      const n = 9;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28, r = 9 + ((v + i * 7) % 5); c.lineTo(cx + Math.cos(a) * r * 1.2, by - 8 + Math.sin(a) * r * 0.6); }
      c.closePath();
      c.fillStyle = 'rgba(30,25,15,0.35)'; c.fill();
      c.clip();
      c.fillStyle = lin(c, 0, by - 16, 0, by, [[0, 'rgba(140,180,210,0.55)'], [1, 'rgba(60,90,120,0.45)']]); c.fillRect(cx - 20, by - 20, 40, 24);
      c.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(c, cx - 4, by - 10, 5, 1.2, -0.2); c.fill(); ellipse(c, cx + 5, by - 6, 3, 0.8, -0.2); c.fill();
      c.restore();
      break;
    }
    case 'bench': {
      groundShadow(c, cx + 4, by - 1, 14, 4, 0.35);
      for (const lx of [cx - 10, cx + 9]) pipe(c, [lx, by - 1, lx, by - 9], 1.4, '#3a3f44');
      for (let i = 0; i < 3; i++) { c.fillStyle = lin(c, 0, by - 12 + i * 2.4, 0, by - 10 + i * 2.4, [[0, '#b0804a'], [1, '#7a5530']]); c.fillRect(cx - 12, by - 12 + i * 2.4, i === 1 && variant % 2 ? 12 : 24, 2); }
      for (let i = 0; i < 2; i++) { c.fillStyle = '#8a6038'; c.fillRect(cx - 12, by - 20 + i * 2.8, 24, 2); }
      weather(c, cx - 12, by - 20, 24, 12, 0.6, v);
      break;
    }
    case 'fence': {
      groundShadow(c, cx + 2, by, 18, 3, 0.25);
      for (let i = 0; i < 5; i++) {
        if ((v + i) % 7 === 3) continue;
        const px = cx - 14 + i * 7, h = 16 + ((v + i * 3) % 4);
        c.fillStyle = lin(c, px, 0, px + 5, 0, [[0, '#b38a5a'], [1, '#7a5732']]);
        poly(c, [px, by, px, by - h, px + 2.5, by - h - 2.5, px + 5, by - h, px + 5, by]); c.fill();
        c.strokeStyle = '#4a321e'; c.lineWidth = 0.4; c.stroke();
      }
      c.fillStyle = '#8a6038'; c.fillRect(cx - 15, by - 13, 34, 2); c.fillRect(cx - 15, by - 6, 34, 2);
      weather(c, cx - 15, by - 20, 34, 20, 0.5, v + 3);
      break;
    }
    case 'rocks': {
      for (let i = 0; i < 4; i++) {
        const rx = cx - 8 + ((v + i * 11) % 16), ry = by - 6 + ((v + i * 5) % 6), s = 2.6 + ((v + i) % 3) * 1.4;
        c.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(c, rx + 1, ry + 1, s, s * 0.6); c.fill();
        c.fillStyle = rad(c, rx - s * 0.3, ry - s * 0.4, 0, s * 1.3, [[0, '#b8b2a6'], [1, '#6b665d']]); ellipse(c, rx, ry, s, s * 0.7); c.fill();
      }
      break;
    }
    case 'pillar': {
      groundShadow(c, cx + 6, by, 12, 4, 0.35);
      const h = 18 + (v % 14);
      c.fillStyle = lin(c, cx - 6, 0, cx + 6, 0, [[0, '#cfc6b2'], [0.5, '#a89f8a'], [1, '#6f675a']]);
      poly(c, [cx - 6, by - 2, cx - 6, by - h, cx - 2, by - h - 3, cx + 1, by - h + 1, cx + 6, by - h - 2, cx + 6, by - 2]); c.fill();
      c.strokeStyle = '#4a4438'; c.lineWidth = 0.5; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.2)'; for (let i = -4; i <= 4; i += 2.6) { c.beginPath(); c.moveTo(cx + i, by - 3); c.lineTo(cx + i, by - h + 2); c.stroke(); }
      c.fillStyle = '#d8d0bc'; c.fillRect(cx - 7.5, by - 4, 15, 3);
      c.fillStyle = '#5d7a3a'; c.beginPath(); c.arc(cx - 4, by - h + 6, 2, 0, 6.28); c.arc(cx + 3, by - 8, 1.6, 0, 6.28); c.fill();
      break;
    }
    case 'barrier': {
      groundShadow(c, cx + 4, by - 1, 16, 4, 0.35);
      poly(c, [cx - 14, by - 1, cx - 12, by - 6, cx - 10, by - 14, cx + 10, by - 14, cx + 12, by - 6, cx + 14, by - 1]);
      c.fillStyle = lin(c, 0, by - 14, 0, by, [[0, '#d6d3cb'], [1, '#8f8b82']]); c.fill(); c.strokeStyle = '#55524b'; c.lineWidth = 0.6; c.stroke();
      hazardStripes(c, cx - 10, by - 13, 20, 3, '#f5f5f5', '#d32f2f');
      weather(c, cx - 14, by - 14, 28, 14, 0.5, v);
      break;
    }
    case 'tracks': {
      c.strokeStyle = 'rgba(30,22,15,0.22)'; c.lineWidth = 3;
      c.setLineDash([2, 1.5]);
      const a = (v % 4) * 0.4 - 0.6;
      for (const off of [-4, 4]) { c.beginPath(); c.moveTo(cx - Math.cos(a) * 18 + off * Math.sin(a), by - 8 - Math.sin(a) * 18 - off * Math.cos(a)); c.lineTo(cx + Math.cos(a) * 18 + off * Math.sin(a), by - 8 + Math.sin(a) * 18 - off * Math.cos(a)); c.stroke(); }
      c.setLineDash([]);
      break;
    }
  }
  void shade; void plate; void rivetRow;
}
