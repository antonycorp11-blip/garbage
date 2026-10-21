import { TILE } from '../core/constants';
import { DISCOVERIES } from '../data/discoveries';
import { Game } from '../game/Game';
import { ellipse, groundShadow, lin, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

function glow(c: C, x: number, y: number, r: number, col: string, a: number) {
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = rad(c, x, y, 0, r, [[0, shade(col, 0, a)], [1, shade(col, 0, 0)]]);
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
  c.restore();
}

const INK = '#2a1a10';
function ink(c: C, w = 0.9) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }

/** Draw a revealed discovery object; also usable for UI thumbnails (x,y = center bottom). */
export function drawDiscovery(c: C, id: string, x: number, y: number, size: number, opened: boolean, time: number) {
  const S = size * TILE;
  switch (id) {
    case 'diary1': case 'diary2': case 'diary3': case 'diary4': {
      // a data-log tablet with a glowing screen
      groundShadow(c, x, y - 6, 10, 4);
      c.save(); c.translate(x, y - 10); c.rotate(-0.2);
      const burnt = id === 'diary3';
      rrect(c, -8.5, -6.5, 17, 13, 2.2); c.fillStyle = burnt ? '#57534e' : '#cbd5e1'; c.fill(); ink(c);
      rrect(c, -6.8, -5, 13.6, 10, 1.2); c.fillStyle = '#0f172a'; c.fill();
      const col = id === 'diary4' ? '#f472b6' : '#67e8f9';
      c.strokeStyle = col; c.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-5.5, -3.2 + i * 2.2); c.lineTo(-5.5 + (i % 2 ? 8 : 10.5), -3.2 + i * 2.2); c.stroke(); }
      if (burnt) { c.fillStyle = 'rgba(20,10,5,0.6)'; ellipse(c, 5, 4, 4, 2.5); c.fill(); }
      c.fillStyle = '#f472b6'; c.beginPath(); c.arc(7, -5, 0.9, 0, 6.28); c.fill();
      c.restore();
      if (!opened) glow(c, x, y - 10, 16, '#a5f3fc', 0.4 + Math.sin(time * 3) * 0.2);
      break;
    }
    case 'tv': {
      // pirate space radio
      groundShadow(c, x, y - 4, 14, 5);
      rrect(c, x - 12, y - 22, 24, 16, 3);
      c.fillStyle = lin(c, 0, y - 22, 0, y - 6, [[0, '#f472b6'], [1, '#9d174d']]); c.fill(); ink(c);
      c.fillStyle = '#1e1b3a'; rrect(c, x - 10, y - 20, 9, 12, 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; for (let k = 0; k < 4; k++) c.fillRect(x - 9, y - 18 + k * 2.8, 7, 1);
      const flick = 0.7 + Math.random() * 0.3;
      c.fillStyle = `rgba(165,243,252,${flick})`; rrect(c, x + 1, y - 19, 9, 5, 1); c.fill();
      c.fillStyle = INK; c.fillRect(x + 2 + ((time * 6) % 7), y - 19, 0.8, 5);
      c.fillStyle = '#fde047'; c.beginPath(); c.arc(x + 5.5, y - 10.5, 2.2, 0, 6.28); c.fill(); ink(c, 0.6);
      c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 8, y - 22); c.lineTo(x + 12, y - 33); c.stroke();
      c.fillStyle = '#67e8f9'; c.beginPath(); c.arc(x + 12, y - 33, 1.6, 0, 6.28); c.fill();
      // sound waves
      c.strokeStyle = `rgba(165,243,252,${0.6 * flick})`; c.lineWidth = 0.8;
      for (let k = 1; k <= 3; k++) { const r = ((time * 10 + k * 5) % 15) + 3; c.beginPath(); c.arc(x + 12, y - 33, r, -1.2, 0.2); c.stroke(); }
      glow(c, x + 5, y - 15, 24, '#f9a8d4', 0.25 * flick);
      break;
    }
    case 'safe': {
      groundShadow(c, x, y - 4, 14, 5);
      c.fillStyle = lin(c, 0, y - 28, 0, y - 4, [[0, '#5eead4'], [1, '#115e59']]); rrect(c, x - 11, y - 28, 22, 24, 3); c.fill(); ink(c);
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - 10, y - 27, 20, 3);
      if (opened) {
        c.fillStyle = '#0b1020'; rrect(c, x - 8, y - 22, 16, 15, 2); c.fill(); ink(c, 0.6);
        c.fillStyle = '#fde047'; c.beginPath(); c.arc(x - 3, y - 11, 2.4, 0, 6.28); c.arc(x + 3, y - 10, 2.4, 0, 6.28); c.fill();
      } else {
        c.beginPath(); c.arc(x, y - 15, 5.5, 0, 6.28); c.fillStyle = '#1e1b3a'; c.fill(); ink(c, 0.7);
        c.save(); c.translate(x, y - 15); c.rotate(time);
        c.strokeStyle = '#67e8f9'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 3.5, 0, 4.5); c.stroke(); c.restore();
        glow(c, x, y - 15, 12, '#67e8f9', 0.3);
      }
      break;
    }
    case 'robot': {
      groundShadow(c, x, y - 4, 12, 5);
      rrect(c, x - 8, y - 19, 16, 14, 4); c.fillStyle = lin(c, 0, y - 19, 0, y - 5, [[0, '#a7f3d0'], [1, '#0f766e']]); c.fill(); ink(c);
      c.beginPath(); c.ellipse(x, y - 26, 7.5, 6.5, 0, 0, 6.28); c.fillStyle = '#ecfeff'; c.fill(); ink(c);
      c.fillStyle = '#0f172a'; rrect(c, x - 5, y - 29, 10, 5.5, 2.4); c.fill();
      const on = Math.sin(time * 2) > -0.2;
      c.fillStyle = on ? '#67e8f9' : '#1e3a5f'; c.beginPath(); c.arc(x - 2.2, y - 26.3, 1.3, 0, 6.28); c.arc(x + 2.2, y - 26.3, 1.3, 0, 6.28); c.fill();
      c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 3, y - 32); c.lineTo(x + 5, y - 37); c.stroke();
      c.fillStyle = '#f472b6'; c.beginPath(); c.arc(x + 5, y - 38, 1.4, 0, 6.28); c.fill(); ink(c, 0.5);
      c.fillStyle = 'rgba(234,88,12,0.45)'; ellipse(c, x + 3, y - 11, 3, 2); c.fill();
      break;
    }
    case 'beetle': {
      // golden racing ship
      groundShadow(c, x, y - 8, S * 0.5, 10, 0.45);
      const cy = y - S / 2;
      c.save(); c.translate(x, cy);
      const body = () => { c.beginPath(); c.moveTo(-S * 0.46, 4); c.quadraticCurveTo(-S * 0.4, -S * 0.22, 0, -S * 0.24); c.quadraticCurveTo(S * 0.46, -S * 0.2, S * 0.48, 0); c.quadraticCurveTo(S * 0.4, S * 0.2, -S * 0.3, S * 0.18); c.closePath(); };
      c.fillStyle = '#a16207'; poly4(c, -6, 4, -20, 22, -6, 22, 6, 6); c.fill(); ink(c, 0.8);
      body(); c.fillStyle = lin(c, -20, -20, 20, 20, [[0, '#fff3b0'], [0.4, '#e6b422'], [1, '#8a6508']]); c.fill(); ink(c, 1.1);
      c.beginPath(); c.ellipse(10, -4, 9, 5, -0.1, 0, 6.28); c.fillStyle = lin(c, 2, -10, 18, 2, [[0, '#e0f2fe'], [1, '#0369a1']]); c.fill(); ink(c, 0.8);
      c.fillStyle = '#f472b6'; c.fillRect(-20, -2, 16, 3);
      const sh = ((time * 0.8) % 2) - 1;
      c.save(); body(); c.clip(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(sh * 30 - 6, -16); c.lineTo(sh * 30 + 6, 16); c.stroke(); c.restore();
      c.restore();
      if (!opened) glow(c, x, cy, 40, '#ffe082', 0.25);
      break;
    }
    case 'container': {
      groundShadow(c, x, y - 6, S * 0.55, 10, 0.45);
      const top = y - S + 4;
      rrect(c, x - S / 2 + 2, top, S - 4, S - 8, 3);
      c.fillStyle = lin(c, 0, top, 0, y - 4, [[0, '#60a5fa'], [1, '#1e3a8a']]); c.fill(); ink(c, 1);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8;
      for (let i = x - S / 2 + 7; i < x + S / 2 - 3; i += 5) { c.beginPath(); c.moveTo(i, top + 3); c.lineTo(i, y - 7); c.stroke(); }
      if (opened) { c.fillStyle = '#0b1020'; rrect(c, x - 10, top + 8, 20, S - 18, 2); c.fill(); glow(c, x, top + 18, 14, '#67e8f9', 0.5); }
      // federation star
      c.save(); c.translate(x, top + 9); c.fillStyle = '#fde047';
      c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.4 : 5.5, a = -Math.PI / 2 + (k / 10) * 6.28; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); ink(c, 0.6);
      c.restore();
      c.fillStyle = '#fef3c7'; c.font = 'bold 4px system-ui'; c.textAlign = 'center'; c.fillText('NÃO ABRIR', x, top + 20);
      if (!opened) glow(c, x, y - S / 2, 30, '#93c5fd', 0.2 + Math.sin(time * 3) * 0.1);
      break;
    }
    case 'bunker': {
      // observatory dome peeking out of the ground
      const cy = y - S / 2 + 4;
      ellipse(c, x, cy + 6, S * 0.45, S * 0.22); c.fillStyle = '#3b3a66'; c.fill(); ink(c, 1);
      c.beginPath(); c.ellipse(x, cy + 4, S * 0.36, S * 0.34, 0, Math.PI, 0); c.closePath();
      c.fillStyle = lin(c, 0, cy - 20, 0, cy + 6, [[0, '#e0e7ff'], [1, '#818cf8']]); c.fill(); ink(c, 1);
      c.fillStyle = opened ? '#0b1020' : '#4338ca'; rrect(c, x - 3, cy - S * 0.3, 6, S * 0.3, 2); c.fill(); ink(c, 0.7);
      if (opened) {
        c.save(); c.translate(x, cy - 8); c.rotate(-0.6 + Math.sin(time) * 0.2);
        c.fillStyle = '#cbd5e1'; rrect(c, -2, -14, 4, 14, 1.5); c.fill(); ink(c, 0.7); c.restore();
        glow(c, x, cy - 6, 20, '#4ade80', 0.25);
      } else {
        c.fillStyle = '#fde047'; c.beginPath(); c.arc(x + 10, cy - 6, 1.5, 0, 6.28); c.fill();
      }
      break;
    }
    case 'egg': {
      groundShadow(c, x, y - 4, 10, 4);
      c.fillStyle = '#6d28d9'; rrect(c, x - 8, y - 12, 16, 8, 2); c.fill(); ink(c, 0.7);
      c.beginPath(); c.ellipse(x, y - 22, 7, 9.5, 0, 0, 6.28);
      const hue = (time * 40) % 360;
      c.fillStyle = lin(c, x - 7, y - 32, x + 7, y - 12, [[0, '#ffffff'], [0.4, `hsl(${hue},90%,80%)`], [1, `hsl(${(hue + 120) % 360},80%,55%)`]]); c.fill();
      ink(c, 0.8);
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(x - 4, y - 28); c.lineTo(x, y - 22); c.lineTo(x + 5, y - 26); c.moveTo(x, y - 22); c.lineTo(x - 1, y - 15); c.stroke();
      glow(c, x, y - 22, 30, '#f0abfc', 0.35 + Math.sin(time * 4) * 0.15);
      break;
    }
    case 'statue': {
      // the Great Glub, in jade, holding a tiny broom
      groundShadow(c, x, y - 6, S * 0.4, 9, 0.45);
      rrect(c, x - 16, y - 20, 32, 16, 2); c.fillStyle = lin(c, 0, y - 20, 0, y - 4, [[0, '#86c2b8'], [1, '#2f5a5c']]); c.fill(); ink(c, 0.9);
      c.fillStyle = '#0f3d3a'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText('ELE TENTOU', x, y - 10);
      const st = lin(c, x - 14, y - 64, x + 14, y - 20, [[0, '#a7f3d0'], [1, '#2f6f6a']]);
      c.beginPath(); c.moveTo(x - 13, y - 20); c.bezierCurveTo(x - 15, y - 44, x - 8, y - 58, x, y - 58); c.bezierCurveTo(x + 8, y - 58, x + 15, y - 44, x + 13, y - 20); c.closePath();
      c.fillStyle = st; c.fill(); ink(c, 1);
      c.fillStyle = '#0f3d3a'; c.beginPath(); c.arc(x - 4, y - 44, 1.6, 0, 6.28); c.arc(x + 4, y - 44, 1.6, 0, 6.28); c.fill();
      c.strokeStyle = '#0f3d3a'; c.lineWidth = 1; c.beginPath(); c.arc(x, y - 40, 2.5, 0.2, Math.PI - 0.2); c.stroke();
      c.save(); c.translate(x + 13, y - 34); c.rotate(-0.4);
      c.fillStyle = '#5fa69c'; c.fillRect(-1, -16, 2.4, 28); c.fillRect(-4, 10, 8.5, 6); c.strokeStyle = INK; c.lineWidth = 0.7; c.strokeRect(-4, 10, 8.5, 6); c.restore();
      c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 1, y - 58); c.quadraticCurveTo(x + 3, y - 64, x + 5, y - 65); c.stroke();
      glow(c, x + 5, y - 66, 8, '#5eead4', 0.4);
      break;
    }
    case 'alien': {
      const h = Math.sin(time * 2) * 3;
      groundShadow(c, x, y - 4, 10, 4, 0.5);
      const cy = y - 20 + h;
      glow(c, x, cy, 34, '#c084fc', 0.45 + Math.sin(time * 5) * 0.15);
      c.beginPath(); c.arc(x, cy, 8, 0, 6.28);
      c.fillStyle = rad(c, x - 3, cy - 3, 0, 9, [[0, '#f5d0fe'], [0.5, '#a855f7'], [1, '#3b0764']]); c.fill(); ink(c, 0.8);
      c.save(); c.translate(x, cy); c.rotate(time * 1.5);
      c.strokeStyle = 'rgba(232,121,249,0.8)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 0, 14, 4, 0, 0, 6.28); c.stroke();
      c.rotate(1.2); c.beginPath(); c.ellipse(0, 0, 13, 3.5, 0, 0, 6.28); c.stroke();
      c.restore();
      break;
    }
    case 'crown': {
      // crown of the Glubs: crystal spikes on an amber band
      groundShadow(c, x, y - 4, 11, 4);
      c.fillStyle = '#4c1d95'; rrect(c, x - 9, y - 12, 18, 8, 2); c.fill(); ink(c, 0.7);
      c.fillStyle = '#7c3aed'; ellipse(c, x, y - 13, 8, 3); c.fill();
      const spikes: [number, number, string][] = [[-7, 12, '#f472b6'], [0, 17, '#67e8f9'], [7, 12, '#fde047']];
      for (const [dx, h, col] of spikes) {
        c.beginPath(); c.moveTo(x + dx - 3, y - 15); c.lineTo(x + dx, y - 15 - h); c.lineTo(x + dx + 3, y - 15); c.closePath();
        c.fillStyle = col; c.fill(); ink(c, 0.6);
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x + dx - 1, y - 14 - h * 0.7, 0.8, h * 0.5);
      }
      rrect(c, x - 9.5, y - 17, 19, 4, 1.4); c.fillStyle = lin(c, 0, y - 17, 0, y - 13, [[0, '#fed7aa'], [1, '#ea580c']]); c.fill(); ink(c, 0.7);
      glow(c, x, y - 22, 34, '#fde047', 0.4 + Math.sin(time * 3) * 0.15);
      break;
    }
    default: break;
  }
}

function poly4(c: C, ...p: number[]) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }

export function drawSpecials(c: C, g: Game, time: number, list: { s: number; y: number }[]) {
  void list;
  for (let s = 0; s < g.specials.length; s++) drawSpecialAt(c, g, s, time);
}

export function drawSpecialAt(c: C, g: Game, s: number, time: number) {
  const st = g.specials[s];
  if (!st.revealed) return;
  const sp = g.world.specials[s];
  const def = DISCOVERIES[sp.index];
  if (def.effect === 'ancientMachine') return;
  if (st.opened && g.discoveryVanishes(s)) return;
  const x = (sp.tx + sp.size / 2) * TILE, y = (sp.ty + sp.size) * TILE;
  drawDiscovery(c, def.id, x, y, sp.size, st.opened, time);
  if (!st.opened) {
    // attention ring + progress
    const r = sp.size * TILE * 0.7 + Math.sin(time * 4) * 2;
    c.save();
    c.strokeStyle = 'rgba(165,243,252,0.85)'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.lineDashOffset = -time * 12;
    c.beginPath(); c.ellipse(x, y - sp.size * TILE * 0.35, r, r * 0.6, 0, 0, 6.28); c.stroke();
    c.setLineDash([]);
    if (st.progress > 0) {
      c.strokeStyle = '#4ade80'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y - sp.size * TILE - 14, 7, -Math.PI / 2, -Math.PI / 2 + st.progress * 6.28); c.stroke();
    }
    c.restore();
  }
}
