import { TILE, inWorld, tileIndex } from '../core/constants';
import { hash2 } from '../core/rng';
import { G_ASPHALT, G_CONCRETE, G_DIRT, G_EARTH, G_GRAVEL, G_RUINFLOOR, R_CARS, R_CONSTRUCTION, R_INDUSTRIAL } from '../data/regions';
import { World } from '../world/World';
import { blit, cachedLayer } from './detail';
import { ellipse, groundShadow, lin, poly, rad, rrect, shade } from './paint';

const INK = '#2a1a10';

type C = CanvasRenderingContext2D;

export type PropKind = 'tree' | 'bush' | 'lamp' | 'sign' | 'hydrant' | 'manhole' | 'puddle' | 'bench' | 'fence' | 'rocks' | 'pillar' | 'barrier' | 'tracks' | 'stump' | 'flowers';

const SIGNS = ['PROIBIDO\nDESPEJO', 'VENDE-SE\n1 CRÉDITO', 'ZONA DE\nPOUSO', 'CUIDADO\nGLUBS', 'BEM-VINDO\nNÉBULA-7', 'PARE', 'NÃO ALIMENTE\nO METEORO', 'VELOC.\nMÁX 5 MACH'];

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

function txt(c: C, text: string, x: number, y: number, size: number, col: string) {
  c.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = col; c.fillText(text, x, y);
}
function ink(c: C, w = 0.8) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function glowAt(c: C, x: number, y: number, r: number, col: string, a = 0.45) {
  c.fillStyle = rad(c, x, y, 0, r, [[0, shade(col, 0.2, a)], [1, shade(col, 0, 0)]]);
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
}
function post(c: C, x: number, y0: number, y1: number, w: number, col: string) {
  c.fillStyle = col; rrect(c, x - w / 2, y1, w, y0 - y1, w / 2); c.fill(); ink(c, 0.6);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - w / 2 + 0.4, y1 + 1, w * 0.3, y0 - y1 - 2);
}

const BULB = ['#67e8f9', '#f0abfc', '#a3e635', '#fdba74'];

function drawPropShape(c: C, kind: PropKind, variant: number, v: number) {
  const cx = 16, by = 24;
  switch (kind) {
    case 'tree': {
      // bulb tree: a curvy trunk ending in glowing seed bulbs
      groundShadow(c, cx + 8, by + 2, 18, 6, 0.35);
      const lean = (variant - 1.5) * 2.2;
      const trunk = () => { c.beginPath(); c.moveTo(cx - 3.5, by + 1); c.bezierCurveTo(cx - 3, by - 14, cx + lean - 4, by - 22, cx + lean - 1.6, by - 34); c.lineTo(cx + lean + 1.6, by - 34); c.bezierCurveTo(cx + lean, by - 22, cx + 3, by - 14, cx + 3.5, by + 1); c.closePath(); };
      trunk(); c.fillStyle = '#5b3f8a'; c.fill();
      c.save(); trunk(); c.clip(); c.fillStyle = '#7c5cb8'; c.fillRect(cx - 6, by - 40, 6.2, 44);
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.6;
      for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(cx - 4, by - k * 6); c.lineTo(cx + 4, by - k * 6 - 2); c.stroke(); }
      c.restore();
      trunk(); ink(c, 0.8);
      const col = BULB[variant % BULB.length];
      const tops: [number, number, number][] = [[cx + lean, by - 38, 6], [cx + lean - 8, by - 31, 4.2], [cx + lean + 8, by - 30, 4.6], [cx + lean - 3, by - 46, 3.4]];
      for (const [bx, byy, r] of tops) {
        c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx + lean, by - 33); c.quadraticCurveTo((cx + lean + bx) / 2, byy + 3, bx, byy + r * 0.6); c.stroke();
        c.strokeStyle = '#7c5cb8'; c.lineWidth = 0.7; c.stroke();
      }
      for (const [bx, byy, r] of tops) {
        glowAt(c, bx, byy, r * 2.4, col, 0.4);
        c.fillStyle = rad(c, bx - r * 0.3, byy - r * 0.4, 0, r * 1.2, [[0, '#ffffff'], [0.35, shade(col, 0.3)], [1, col]]);
        c.beginPath(); c.arc(bx, byy, r, 0, 6.28); c.fill(); ink(c, 0.7);
        c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(bx - r * 0.35, byy - r * 0.4, r * 0.25, 0, 6.28); c.fill();
      }
      break;
    }
    case 'stump': {
      // pink coral
      groundShadow(c, cx + 3, by - 1, 9, 3, 0.3);
      const col = ['#f472b6', '#fb7185', '#c084fc', '#fb923c'][variant];
      const br = (x0: number, y0: number, a: number, l: number, w: number, d: number) => {
        const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
        c.lineCap = 'round';
        c.strokeStyle = INK; c.lineWidth = w + 1.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.strokeStyle = col; c.lineWidth = w; c.stroke();
        if (d > 0) { br(x1, y1, a - 0.55, l * 0.7, w * 0.75, d - 1); br(x1, y1, a + 0.5, l * 0.7, w * 0.75, d - 1); }
        else { c.fillStyle = shade(col, 0.5); c.beginPath(); c.arc(x1, y1, w * 0.7, 0, 6.28); c.fill(); }
      };
      br(cx, by - 1, -Math.PI / 2, 6, 2.6, 2);
      break;
    }
    case 'bush': {
      // curled tentacle fronds
      groundShadow(c, cx + 3, by - 1, 12, 4, 0.3);
      const col = variant % 2 ? '#2dd4bf' : '#a78bfa';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.42;
        const l = 10 + ((v + i * 5) % 5);
        const x1 = cx + Math.cos(a) * l, y1 = by - 2 + Math.sin(a) * l;
        c.lineCap = 'round';
        c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath(); c.moveTo(cx, by - 1); c.quadraticCurveTo(cx + Math.cos(a) * l * 0.4, by - 2 + Math.sin(a) * l * 0.8, x1, y1); c.stroke();
        c.strokeStyle = col; c.lineWidth = 2.2; c.stroke();
        c.strokeStyle = shade(col, 0.45); c.lineWidth = 0.6; c.stroke();
        // curl
        c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.arc(x1 + (i < 3 ? -1.4 : 1.4), y1, 1.4, 0, 5); c.stroke();
        c.strokeStyle = col; c.lineWidth = 1.4; c.stroke();
      }
      if (variant === 3) for (let i = 0; i < 4; i++) glowAt(c, cx - 5 + i * 3.4, by - 9 - (i % 2) * 3, 2.2, '#fde047', 0.9);
      break;
    }
    case 'flowers': {
      for (let i = 0; i < 6; i++) {
        const fx = cx - 8 + (i * 37 + v) % 16, fy = by - 7 + (i * 13) % 8;
        c.strokeStyle = '#2dd4bf'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(fx, fy + 4); c.quadraticCurveTo(fx + 1, fy + 2, fx, fy); c.stroke();
        const col = ['#f472b6', '#67e8f9', '#fde047', '#c084fc'][(i + v) % 4];
        glowAt(c, fx, fy, 4, col, 0.35);
        c.fillStyle = col;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; ellipse(c, fx + Math.cos(a) * 1.3, fy + Math.sin(a) * 1.1, 1, 0.7, a); c.fill(); }
        c.fillStyle = '#fff'; c.beginPath(); c.arc(fx, fy, 0.6, 0, 6.28); c.fill();
      }
      break;
    }
    case 'lamp': {
      // guide beacon pylon
      groundShadow(c, cx + 8, by + 1, 10, 3, 0.25);
      c.fillStyle = '#3b3a66'; ellipse(c, cx, by, 3.6, 1.6); c.fill(); ink(c, 0.6);
      post(c, cx, by, by - 30, 2.6, '#a5a8d6');
      const col = variant % 2 ? '#67e8f9' : '#f472b6';
      glowAt(c, cx, by - 33, 9, col, 0.5);
      c.fillStyle = '#334155'; rrect(c, cx - 3, by - 32, 6, 3, 1); c.fill(); ink(c, 0.6);
      c.fillStyle = col; c.beginPath(); c.arc(cx, by - 34, 2.6, Math.PI, 0); c.fill(); ink(c, 0.6);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(cx - 0.8, by - 35, 0.7, 0, 6.28); c.fill();
      break;
    }
    case 'sign': {
      const text = SIGNS[variant];
      groundShadow(c, cx + 6, by + 1, 12, 3, 0.3);
      post(c, cx - 7, by, by - 20, 1.8, '#8b8fc0');
      post(c, cx + 7, by, by - 20, 1.8, '#8b8fc0');
      const red = text === 'PARE';
      if (red) {
        c.fillStyle = '#e11d48';
        c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + 0.39; c.lineTo(cx + Math.cos(a) * 9, by - 26 + Math.sin(a) * 9); } c.closePath(); c.fill();
        ink(c, 0.8);
        txt(c, 'PARE', cx, by - 26, 5, '#fff');
      } else {
        // holographic board
        c.save(); c.translate(cx, by - 27); c.rotate((variant - 3) * 0.03);
        const col = ['#22d3ee', '#f472b6', '#a3e635'][variant % 3];
        c.fillStyle = shade(col, 0, 0.18); rrect(c, -15, -10, 30, 18, 3); c.fill();
        c.fillStyle = '#1e1b3a'; rrect(c, -13.5, -8.5, 27, 15, 2); c.fill();
        c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
        c.strokeStyle = col; c.lineWidth = 0.6; rrect(c, -12.5, -7.5, 25, 13, 1.6); c.stroke();
        const lines = text.split('\n');
        lines.forEach((ln, i) => txt(c, ln, 0, -1 + (i - (lines.length - 1) / 2) * 5.2, ln.length > 10 ? 3.3 : 4, shade(col, 0.4)));
        c.fillStyle = 'rgba(255,255,255,0.07)'; for (let y = -7; y < 6; y += 1.6) c.fillRect(-12.5, y, 25, 0.5);
        c.restore();
      }
      break;
    }
    case 'hydrant': {
      // coolant valve
      groundShadow(c, cx + 3, by - 1, 6, 2.4, 0.3);
      c.fillStyle = '#0f766e'; rrect(c, cx - 3.4, by - 12, 6.8, 12, 2); c.fill(); ink(c, 0.7);
      c.fillStyle = '#2dd4bf'; rrect(c, cx - 3.4, by - 12, 3.4, 12, 2); c.fill();
      c.fillStyle = '#e2e8f0'; c.beginPath(); c.ellipse(cx, by - 12.5, 3.6, 1.6, 0, 0, 6.28); c.fill(); ink(c, 0.6);
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - 4, by - 15); c.lineTo(cx + 4, by - 15); c.moveTo(cx, by - 13); c.lineTo(cx, by - 15); c.stroke();
      c.strokeStyle = '#f472b6'; c.lineWidth = 0.8; c.stroke();
      glowAt(c, cx, by - 6, 3, '#a5f3fc', 0.8);
      break;
    }
    case 'manhole': {
      // round service hatch with a glyph
      c.fillStyle = 'rgba(20,10,40,0.35)'; ellipse(c, cx + 0.6, by - 7.5, 8, 5); c.fill();
      ellipse(c, cx, by - 8, 8, 5); c.fillStyle = lin(c, cx - 8, by - 13, cx + 8, by - 3, [[0, '#8b8fc0'], [1, '#3b3a66']]); c.fill();
      ink(c, 0.7);
      c.strokeStyle = 'rgba(103,232,249,0.7)'; c.lineWidth = 0.6;
      ellipse(c, cx, by - 8, 5.4, 3.3); c.stroke();
      c.beginPath(); c.moveTo(cx - 2, by - 9); c.lineTo(cx, by - 11); c.lineTo(cx + 2, by - 9); c.moveTo(cx, by - 11); c.lineTo(cx, by - 5.5); c.stroke();
      break;
    }
    case 'puddle': {
      // bioluminescent pool
      c.save();
      c.beginPath();
      const n = 9;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28, r = 9 + ((v + i * 7) % 5); c.lineTo(cx + Math.cos(a) * r * 1.2, by - 8 + Math.sin(a) * r * 0.6); }
      c.closePath();
      c.fillStyle = 'rgba(20,10,40,0.4)'; c.fill();
      c.clip();
      c.fillStyle = rad(c, cx, by - 9, 1, 14, [[0, 'rgba(165,243,252,0.85)'], [0.6, 'rgba(45,212,191,0.6)'], [1, 'rgba(76,29,149,0.5)']]); c.fillRect(cx - 20, by - 20, 40, 24);
      c.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(c, cx - 4, by - 10, 4, 1, -0.2); c.fill(); ellipse(c, cx + 5, by - 6, 2.4, 0.7, -0.2); c.fill();
      for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(cx - 8 + ((v + k * 9) % 16), by - 11 + ((v + k * 5) % 6), 0.6, 0, 6.28); c.fill(); }
      c.restore();
      break;
    }
    case 'bench': {
      // little supply cache with a blinking light
      groundShadow(c, cx + 4, by - 1, 12, 4, 0.35);
      const col = ['#2dd4bf', '#fb923c', '#a78bfa', '#f472b6'][variant];
      c.fillStyle = shade(col, -0.35); rrect(c, cx - 9, by - 10, 18, 10, 2); c.fill();
      c.fillStyle = shade(col, 0.1); rrect(c, cx - 9, by - 15, 18, 6.5, 2); c.fill();
      rrect(c, cx - 9, by - 15, 18, 15, 2); ink(c, 0.8);
      c.strokeStyle = INK; c.lineWidth = 0.5; c.beginPath(); c.moveTo(cx - 9, by - 8.6); c.lineTo(cx + 9, by - 8.6); c.stroke();
      c.fillStyle = '#1e1b3a'; rrect(c, cx - 5, by - 7, 10, 4, 1); c.fill();
      txt(c, 'SUPRIMENTOS', cx, by - 5, 1.8, shade(col, 0.5));
      glowAt(c, cx + 6, by - 13, 3, '#fde047', 0.9);
      break;
    }
    case 'fence': {
      // energy fence: posts linked by a glowing beam
      groundShadow(c, cx + 2, by, 18, 3, 0.25);
      const col = variant % 2 ? '#67e8f9' : '#f0abfc';
      const xs = [cx - 14, cx, cx + 14];
      for (const y of [by - 13, by - 7]) {
        c.strokeStyle = shade(col, 0, 0.35); c.lineWidth = 2.4; c.beginPath(); c.moveTo(xs[0], y); c.lineTo(xs[2], y); c.stroke();
        c.strokeStyle = shade(col, 0.5); c.lineWidth = 0.7; c.stroke();
      }
      for (const x of xs) {
        if ((v + x) % 7 === 3) continue;
        post(c, x, by, by - 17, 3, '#8b8fc0');
        c.fillStyle = col; c.beginPath(); c.arc(x, by - 17.5, 1.5, 0, 6.28); c.fill(); ink(c, 0.5);
      }
      break;
    }
    case 'rocks': {
      for (let i = 0; i < 4; i++) {
        const rx = cx - 8 + ((v + i * 11) % 16), ry = by - 6 + ((v + i * 5) % 6), s = 2.6 + ((v + i) % 3) * 1.4;
        c.fillStyle = 'rgba(20,10,40,0.3)'; ellipse(c, rx + 1, ry + 1, s, s * 0.6); c.fill();
        c.fillStyle = rad(c, rx - s * 0.3, ry - s * 0.4, 0, s * 1.3, [[0, '#b9a6d6'], [1, '#5b4a7a']]); ellipse(c, rx, ry, s, s * 0.7); c.fill();
        ink(c, 0.5);
      }
      const col = ['#f9a8d4', '#a5f3fc', '#c4b5fd', '#fde68a'][variant];
      glowAt(c, cx + 2, by - 9, 6, col, 0.4);
      c.fillStyle = col; poly(c, [cx, by - 6, cx + 1, by - 13, cx + 3, by - 6]); c.fill(); ink(c, 0.5);
      break;
    }
    case 'pillar': {
      // ancient jade monolith with a glowing glyph
      groundShadow(c, cx + 6, by, 12, 4, 0.35);
      const h = 18 + (v % 14);
      const path = () => poly(c, [cx - 6, by - 2, cx - 6, by - h, cx - 2, by - h - 3, cx + 1, by - h + 1, cx + 6, by - h - 2, cx + 6, by - 2]);
      path(); c.fillStyle = '#2f6f6a'; c.fill();
      c.save(); path(); c.clip(); c.fillStyle = '#5fa69c'; c.fillRect(cx - 8, by - h - 6, 8.5, h + 6); c.restore();
      path(); ink(c, 0.8);
      c.save(); c.shadowColor = '#5eead4'; c.shadowBlur = 4;
      c.strokeStyle = '#a7f3d0'; c.lineWidth = 0.8;
      const gy = by - h / 2 - 2;
      c.beginPath(); c.arc(cx, gy, 2.6, 0.4, 5.6); c.moveTo(cx, gy - 4); c.lineTo(cx, gy + 4); c.stroke();
      c.restore();
      c.fillStyle = '#86c2b8'; c.fillRect(cx - 7.5, by - 4, 15, 3); c.strokeStyle = INK; c.lineWidth = 0.6; c.strokeRect(cx - 7.5, by - 4, 15, 3);
      c.fillStyle = '#c084fc'; c.beginPath(); c.arc(cx - 4, by - h + 6, 1.6, 0, 6.28); c.arc(cx + 3, by - 8, 1.3, 0, 6.28); c.fill();
      break;
    }
    case 'barrier': {
      groundShadow(c, cx + 4, by - 1, 16, 4, 0.35);
      poly(c, [cx - 14, by - 1, cx - 12, by - 6, cx - 10, by - 14, cx + 10, by - 14, cx + 12, by - 6, cx + 14, by - 1]);
      c.fillStyle = lin(c, 0, by - 14, 0, by, [[0, '#c7c9ea'], [1, '#6e6fa0']]); c.fill(); ink(c, 0.7);
      c.save(); c.beginPath(); c.rect(cx - 10, by - 13, 20, 3); c.clip();
      for (let x = -12; x < 12; x += 4) { c.fillStyle = (x / 4) % 2 === 0 ? '#fde047' : '#7c3aed'; poly(c, [cx + x, by - 10, cx + x + 2, by - 13, cx + x + 4, by - 13, cx + x + 2, by - 10]); c.fill(); }
      c.restore();
      break;
    }
    case 'tracks': {
      c.strokeStyle = 'rgba(30,15,55,0.22)'; c.lineWidth = 3;
      c.setLineDash([2, 1.5]);
      const a = (v % 4) * 0.4 - 0.6;
      for (const off of [-4, 4]) { c.beginPath(); c.moveTo(cx - Math.cos(a) * 18 + off * Math.sin(a), by - 8 - Math.sin(a) * 18 - off * Math.cos(a)); c.lineTo(cx + Math.cos(a) * 18 + off * Math.sin(a), by - 8 + Math.sin(a) * 18 - off * Math.cos(a)); c.stroke(); }
      c.setLineDash([]);
      break;
    }
  }
}
