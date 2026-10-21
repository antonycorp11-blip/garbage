import { fbm, hash2, mulberry } from '../core/rng';
import { GROUND_COUNT, G_ASPHALT, G_CONCRETE, G_DIRT, G_EARTH, G_GRAVEL, G_RUINFLOOR } from '../data/regions';
import { ctx2d, ellipse, makeCanvas, rad, shade } from './paint';

export const GROUND_PERIOD = 512;

interface GroundStyle { base: [number, number, number]; vary: number; specks: string[]; speckN: number }

// Nébula-7 palette. Constant names are historical: DIRT = soil under junk, EARTH = clean soil,
// CONCRETE = alloy deck plates, ASPHALT = old landing strips, GRAVEL = meteor dust, RUINFLOOR = jade temple stone.
const STYLES: Record<number, GroundStyle> = {
  [G_DIRT]: { base: [84, 66, 112], vary: 30, specks: ['#3b2a55', '#6b5590', '#4c3a6a', '#8a6fa8'], speckN: 1400 },
  [G_EARTH]: { base: [128, 110, 166], vary: 26, specks: ['#6f5a99', '#a28cc8', '#8573b0', '#b8a6da'], speckN: 1000 },
  [G_CONCRETE]: { base: [138, 140, 172], vary: 18, specks: ['#6e7096', '#a3a6c8', '#5b5d80'], speckN: 1200 },
  [G_ASPHALT]: { base: [66, 62, 108], vary: 12, specks: ['#2a2848', '#5a5890', '#3c3a66'], speckN: 2400 },
  [G_GRAVEL]: { base: [134, 100, 126], vary: 26, specks: ['#a07898', '#6a4a66', '#c09ab4', '#7e5a78'], speckN: 2400 },
  [G_RUINFLOOR]: { base: [88, 134, 132], vary: 22, specks: ['#4e7e7c', '#9cc8c0', '#6aa29e'], speckN: 700 },
};

/** Builds seamless (periodic) ground textures at the given render scale. */
export function buildGroundTextures(RS: number): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  const P = GROUND_PERIOD;
  const NR = 128; // noise resolution, upscaled smoothly
  for (let g = 0; g < GROUND_COUNT; g++) {
    const st = STYLES[g];
    const noise = makeCanvas(NR, NR);
    const nc = ctx2d(noise);
    const img = nc.createImageData(NR, NR);
    for (let y = 0; y < NR; y++) for (let x = 0; x < NR; x++) {
      const n = fbm((x / NR) * 8, (y / NR) * 8, 300 + g, 4, 8);
      const n2 = fbm((x / NR) * 32, (y / NR) * 32, 400 + g, 2, 32);
      const v = (n - 0.5) * st.vary * 1.6 + (n2 - 0.5) * st.vary * 0.6;
      const i = (y * NR + x) * 4;
      img.data[i] = st.base[0] + v; img.data[i + 1] = st.base[1] + v * 0.95; img.data[i + 2] = st.base[2] + v * 0.85; img.data[i + 3] = 255;
    }
    nc.putImageData(img, 0, 0);
    const cv = makeCanvas(P * RS, P * RS);
    const c = ctx2d(cv);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    // draw 3x3 copies so smoothing wraps at edges
    const n3 = makeCanvas(NR * 3, NR * 3);
    const n3c = ctx2d(n3);
    for (let oy = 0; oy < 3; oy++) for (let ox = 0; ox < 3; ox++) n3c.drawImage(noise, ox * NR, oy * NR);
    c.drawImage(n3, NR, NR, NR, NR, 0, 0, P * RS, P * RS);
    c.scale(RS, RS);
    const r = mulberry(77 + g);
    const wrap = (fn: (ox: number, oy: number) => void) => { for (const ox of [-P, 0, P]) for (const oy of [-P, 0, P]) fn(ox, oy); };
    // specks / pebbles
    for (let i = 0; i < st.speckN; i++) {
      const x = r() * P, y = r() * P, s = 0.4 + r() * (g === G_GRAVEL ? 2.2 : 1.1);
      const col = st.specks[Math.floor(r() * st.specks.length)];
      c.fillStyle = col;
      c.globalAlpha = 0.35 + r() * 0.5;
      wrap((ox, oy) => { if (x + ox > -4 && x + ox < P + 4 && y + oy > -4 && y + oy < P + 4) { ellipse(c, x + ox, y + oy, s, s * 0.75, r() * 3); c.fill(); } });
    }
    c.globalAlpha = 1;
    if (g === G_GRAVEL || g === G_EARTH) {
      for (let i = 0; i < (g === G_GRAVEL ? 260 : 70); i++) {
        const x = r() * P, y = r() * P, s = 1.2 + r() * 2.2;
        const col = st.specks[Math.floor(r() * st.specks.length)];
        wrap((ox, oy) => {
          if (x + ox < -6 || x + ox > P + 6 || y + oy < -6 || y + oy > P + 6) return;
          c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, x + ox + 0.6, y + oy + 0.8, s, s * 0.7); c.fill();
          c.fillStyle = rad(c, x + ox - s * 0.3, y + oy - s * 0.3, 0, s * 1.3, [[0, shade(col, 0.45)], [1, shade(col, -0.2)]]);
          ellipse(c, x + ox, y + oy, s, s * 0.7); c.fill();
        });
      }
    }
    if (g === G_CONCRETE) {
      // alloy deck plates with cyan seams and rivets
      c.strokeStyle = 'rgba(30,28,60,0.5)'; c.lineWidth = 1.2;
      for (let k = 0; k <= P; k += 64) { c.beginPath(); c.moveTo(k + 0.5, 0); c.lineTo(k + 0.5, P); c.moveTo(0, k + 0.5); c.lineTo(P, k + 0.5); c.stroke(); }
      c.strokeStyle = 'rgba(103,232,249,0.22)'; c.lineWidth = 0.8;
      for (let k = 0; k <= P; k += 64) { c.beginPath(); c.moveTo(k + 1.6, 0); c.lineTo(k + 1.6, P); c.moveTo(0, k + 1.6); c.lineTo(P, k + 1.6); c.stroke(); }
      for (let y = 0; y < P; y += 64) for (let x = 0; x < P; x += 64) {
        for (const [dx, dy] of [[6, 6], [58, 6], [6, 58], [58, 58]]) {
          c.fillStyle = 'rgba(30,28,60,0.45)'; c.beginPath(); c.arc(x + dx + 0.4, y + dy + 0.5, 1.4, 0, 6.28); c.fill();
          c.fillStyle = 'rgba(220,224,255,0.5)'; c.beginPath(); c.arc(x + dx, y + dy, 1, 0, 6.28); c.fill();
        }
        if (hash2(x, y, 9) < 0.3) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + 2, y + 2, 60, 60); }
      }
    }
    if (g === G_ASPHALT) {
      // landing-strip panels
      c.strokeStyle = 'rgba(20,18,40,0.6)'; c.lineWidth = 1;
      for (let k = 0; k <= P; k += 32) { c.beginPath(); c.moveTo(k + 0.5, 0); c.lineTo(k + 0.5, P); c.moveTo(0, k + 0.5); c.lineTo(P, k + 0.5); c.stroke(); }
    }
    if (g === G_RUINFLOOR) {
      for (let y = 0; y < P; y += 16) for (let x = 0; x < P; x += 16) {
        const h = hash2(x, y, 5);
        if (h < 0.12) continue;
        c.fillStyle = ((x + y) / 16) % 2 === 0 ? 'rgba(190,240,230,0.28)' : 'rgba(30,70,80,0.25)';
        c.fillRect(x + 0.5, y + 0.5, 15, 15);
        c.strokeStyle = 'rgba(20,50,60,0.4)'; c.lineWidth = 0.6; c.strokeRect(x + 0.5, y + 0.5, 15, 15);
        if (h > 0.9) {
          // etched glyph
          c.strokeStyle = 'rgba(160,255,240,0.35)'; c.lineWidth = 0.7;
          c.beginPath(); c.arc(x + 8, y + 8, 3.5, 0.5, 5.5); c.moveTo(x + 8, y + 4); c.lineTo(x + 8, y + 12); c.stroke();
        }
      }
    }
    // cracks
    if (g === G_CONCRETE || g === G_ASPHALT || g === G_RUINFLOOR) {
      c.strokeStyle = g === G_ASPHALT ? 'rgba(15,12,30,0.6)' : 'rgba(30,25,50,0.4)';
      c.lineWidth = 0.7;
      for (let k = 0; k < 22; k++) {
        let x = r() * P, y = r() * P;
        c.beginPath(); c.moveTo(x, y);
        const segs = 4 + Math.floor(r() * 6);
        let a = r() * 6.28;
        for (let s = 0; s < segs; s++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * (4 + r() * 8); y += Math.sin(a) * (4 + r() * 8); c.lineTo(x, y); }
        c.stroke();
      }
    }
    // stains
    for (let k = 0; k < 14; k++) {
      const x = r() * (P - 60) + 30, y = r() * (P - 60) + 30, s = 8 + r() * 22;
      c.fillStyle = rad(c, x, y, 0, s, [[0, g === G_ASPHALT ? 'rgba(0,0,0,0.25)' : g === G_EARTH ? 'rgba(90,220,210,0.10)' : 'rgba(30,15,50,0.16)'], [1, 'rgba(0,0,0,0)']]);
      ellipse(c, x, y, s, s * 0.7); c.fill();
    }
    out.push(cv);
  }
  return out;
}

/** Soft dark blob used as grime under garbage. */
export function buildGrime(RS: number): HTMLCanvasElement {
  const S = 64;
  const cv = makeCanvas(S * RS, S * RS);
  const c = ctx2d(cv);
  c.scale(RS, RS);
  c.fillStyle = rad(c, S / 2, S / 2, 0, S / 2, [[0, 'rgba(30,16,52,0.85)'], [0.45, 'rgba(36,20,60,0.55)'], [1, 'rgba(36,20,60,0)']]);
  c.fillRect(0, 0, S, S);
  return cv;
}

/** Patches of tiny debris that fill the gaps between bigger items. */
export function buildDebris(RS: number, n = 6): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  const cols = ['#f9a8d4', '#93c5fd', '#86efac', '#fdba74', '#67e8f9', '#c4b5fd', '#e2e8f0', '#fde68a', '#5b4a7a', '#334155'];
  for (let k = 0; k < n; k++) {
    const S = 44;
    const cv = makeCanvas(S * RS, S * RS);
    const c = ctx2d(cv);
    c.scale(RS, RS);
    const r = mulberry(900 + k);
    for (let i = 0; i < 42; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * S * 0.45;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const col = cols[Math.floor(r() * cols.length)];
      c.save(); c.translate(x, y); c.rotate(r() * 6.28);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      const w = 1 + r() * 3.2, h = 0.6 + r() * 1.8;
      c.fillRect(-w / 2 + 0.5, -h / 2 + 0.7, w, h);
      c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-w / 2, -h / 2, w, h * 0.35);
      c.restore();
    }
    out.push(cv);
  }
  return out;
}
