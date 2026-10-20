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

/** Draw a revealed discovery object; also usable for UI thumbnails (x,y = center bottom). */
export function drawDiscovery(c: C, id: string, x: number, y: number, size: number, opened: boolean, time: number) {
  const S = size * TILE;
  switch (id) {
    case 'diary1': case 'diary2': case 'diary3': case 'diary4': {
      groundShadow(c, x, y - 6, 10, 4);
      c.save(); c.translate(x, y - 10); c.rotate(-0.2);
      c.fillStyle = id === 'diary3' ? '#c9a46a' : '#f3ead2';
      c.beginPath(); c.moveTo(-8, -6); c.lineTo(7, -7); c.lineTo(8, 6); c.lineTo(-7, 7); c.closePath(); c.fill();
      c.strokeStyle = '#8a7350'; c.lineWidth = 0.6; c.stroke();
      c.strokeStyle = 'rgba(40,40,90,0.6)'; c.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-6, -4 + i * 2.4); c.lineTo(5, -4.5 + i * 2.4); c.stroke(); }
      if (id === 'diary3') { c.fillStyle = 'rgba(30,20,10,0.6)'; ellipse(c, 5, 4, 3, 2); c.fill(); }
      c.restore();
      if (!opened) glow(c, x, y - 10, 16, '#fff7c2', 0.4 + Math.sin(time * 3) * 0.2);
      break;
    }
    case 'tv': {
      groundShadow(c, x, y - 4, 14, 5);
      rrect(c, x - 11, y - 24, 22, 18, 3);
      c.fillStyle = lin(c, 0, y - 24, 0, y - 6, [[0, '#8a6a3a'], [1, '#4e3b1f']]); c.fill(); c.strokeStyle = '#2b1d0c'; c.lineWidth = 0.8; c.stroke();
      rrect(c, x - 9, y - 22, 14, 13, 3);
      const flick = 0.7 + Math.random() * 0.3;
      c.fillStyle = `hsl(${(time * 60) % 360},60%,${45 * flick}%)`; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = 'bold 4px system-ui'; c.textAlign = 'center'; c.fillText('OFERTA!', x - 2, y - 14);
      glow(c, x - 2, y - 15, 26, '#a5f3fc', 0.35 * flick);
      c.strokeStyle = '#999'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - 2, y - 24); c.lineTo(x - 7, y - 32); c.moveTo(x + 1, y - 24); c.lineTo(x + 6, y - 31); c.stroke();
      break;
    }
    case 'safe': {
      groundShadow(c, x, y - 4, 14, 5);
      c.fillStyle = lin(c, 0, y - 28, 0, y - 4, [[0, '#6b7280'], [1, '#374151']]); c.fillRect(x - 11, y - 28, 22, 24);
      c.fillStyle = '#9ca3af'; c.fillRect(x - 11, y - 28, 22, 4);
      c.strokeStyle = '#111827'; c.lineWidth = 0.8; c.strokeRect(x - 11, y - 28, 22, 24);
      if (opened) {
        c.fillStyle = '#111'; c.fillRect(x - 9, y - 22, 18, 16);
        c.fillStyle = '#4ade80'; c.fillRect(x - 6, y - 12, 5, 3); c.fillRect(x, y - 12, 5, 3);
        c.fillStyle = '#4b5563'; c.beginPath(); c.moveTo(x + 9, y - 22); c.lineTo(x + 18, y - 25); c.lineTo(x + 18, y - 6); c.lineTo(x + 9, y - 6); c.fill();
      } else {
        c.beginPath(); c.arc(x, y - 14, 5, 0, 6.28); c.fillStyle = '#d1d5db'; c.fill(); c.stroke();
        c.save(); c.translate(x, y - 14); c.rotate(time); c.fillStyle = '#111'; c.fillRect(-0.5, -4, 1, 4); c.restore();
        c.fillStyle = '#facc15'; c.fillRect(x + 6, y - 15, 3, 2);
      }
      break;
    }
    case 'robot': {
      groundShadow(c, x, y - 4, 12, 5);
      c.fillStyle = lin(c, 0, y - 20, 0, y - 4, [[0, '#9ca3af'], [1, '#4b5563']]); rrect(c, x - 8, y - 20, 16, 14, 3); c.fill();
      c.strokeStyle = '#1f2937'; c.lineWidth = 0.8; c.stroke();
      rrect(c, x - 6, y - 32, 12, 11, 3); c.fillStyle = '#d1d5db'; c.fill(); c.stroke();
      const on = Math.sin(time * 2) > -0.2;
      c.fillStyle = on ? '#38bdf8' : '#1e3a5f'; c.beginPath(); c.arc(x - 2.5, y - 27, 1.6, 0, 6.28); c.arc(x + 2.5, y - 27, 1.6, 0, 6.28); c.fill();
      c.strokeStyle = '#6b7280'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 32); c.lineTo(x, y - 37); c.stroke();
      c.fillStyle = '#ef4444'; c.beginPath(); c.arc(x, y - 38, 1.4, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(140,70,20,0.5)'; ellipse(c, x + 3, y - 12, 3, 2); c.fill();
      break;
    }
    case 'beetle': {
      groundShadow(c, x, y - 8, S * 0.5, 10, 0.45);
      const cy = y - S / 2;
      c.save(); c.translate(x, cy);
      c.beginPath(); c.ellipse(0, 0, S * 0.45, S * 0.3, 0, 0, 6.28);
      c.fillStyle = lin(c, -20, -20, 20, 20, [[0, '#fff3b0'], [0.4, '#e6b422'], [1, '#8a6508']]); c.fill();
      c.strokeStyle = '#5e4404'; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.ellipse(-2, 0, S * 0.22, S * 0.2, 0, 0, 6.28); c.fillStyle = lin(c, -14, -10, 10, 10, [[0, '#bae6fd'], [1, '#1e3a5f']]); c.fill(); c.stroke();
      c.fillStyle = '#1f2937'; for (const [wx, wy] of [[-16, -17], [14, -17], [-16, 15], [14, 15]]) { rrect(c, wx - 4, wy, 8, 3, 1); c.fill(); }
      const sh = ((time * 0.8) % 2) - 1;
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(sh * 30 - 6, -16); c.lineTo(sh * 30 + 6, 16); c.stroke(); c.restore();
      c.restore();
      if (!opened) glow(c, x, cy, 40, '#ffe082', 0.25);
      break;
    }
    case 'container': {
      groundShadow(c, x, y - 6, S * 0.55, 10, 0.45);
      const top = y - S + 4;
      c.fillStyle = lin(c, 0, top, 0, y - 4, [[0, '#d9480f'], [1, '#7c2d12']]); c.fillRect(x - S / 2 + 2, top, S - 4, S - 8);
      c.strokeStyle = '#431407'; c.lineWidth = 1; c.strokeRect(x - S / 2 + 2, top, S - 4, S - 8);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let i = x - S / 2 + 6; i < x + S / 2 - 2; i += 4) { c.beginPath(); c.moveTo(i, top + 2); c.lineTo(i, y - 6); c.stroke(); }
      if (opened) { c.fillStyle = '#1c1917'; c.fillRect(x - 10, top + 8, 20, S - 18); }
      c.fillStyle = '#fef3c7'; c.fillRect(x - 14, top + 6, 28, 7);
      c.fillStyle = '#7c2d12'; c.font = 'bold 4.5px system-ui'; c.textAlign = 'center'; c.fillText('NÃO ABRIR', x, top + 11);
      if (!opened) glow(c, x, y - S / 2, 30, '#fdba74', 0.2 + Math.sin(time * 3) * 0.1);
      break;
    }
    case 'bunker': {
      const cy = y - S / 2;
      ellipse(c, x, cy, S * 0.45, S * 0.32); c.fillStyle = lin(c, 0, cy - 20, 0, cy + 20, [[0, '#6b7280'], [1, '#374151']]); c.fill();
      c.strokeStyle = '#111827'; c.lineWidth = 1.2; c.stroke();
      ellipse(c, x, cy, S * 0.28, S * 0.2); c.fillStyle = opened ? '#0b0b0b' : '#52525b'; c.fill(); c.stroke();
      if (!opened) {
        c.strokeStyle = '#a1a1aa'; c.lineWidth = 2; c.beginPath(); c.arc(x, cy, 6, 0, 6.28); c.stroke();
        c.beginPath(); c.moveTo(x - 6, cy); c.lineTo(x + 6, cy); c.moveTo(x, cy - 6); c.lineTo(x, cy + 6); c.stroke();
        c.fillStyle = '#facc15'; c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.fillText('☢', x, cy - 14);
      } else {
        c.fillStyle = '#3f3f46'; for (let i = 0; i < 4; i++) c.fillRect(x - 8, cy - 6 + i * 3.5, 16, 1.4);
        glow(c, x, cy, 20, '#4ade80', 0.25);
      }
      break;
    }
    case 'egg': {
      groundShadow(c, x, y - 4, 10, 4);
      c.fillStyle = '#7c3aed'; rrect(c, x - 8, y - 12, 16, 8, 2); c.fill();
      c.beginPath(); c.ellipse(x, y - 22, 7, 9.5, 0, 0, 6.28);
      c.fillStyle = lin(c, x - 7, y - 32, x + 7, y - 12, [[0, '#fffbe0'], [0.35, '#fcd34d'], [1, '#a16207']]); c.fill();
      c.strokeStyle = '#713f12'; c.lineWidth = 0.6; c.stroke();
      c.strokeStyle = '#dc2626'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 6.5, y - 22); c.quadraticCurveTo(x, y - 18, x + 6.5, y - 22); c.stroke();
      glow(c, x, y - 22, 30, '#fde68a', 0.35 + Math.sin(time * 4) * 0.15);
      break;
    }
    case 'statue': {
      groundShadow(c, x, y - 6, S * 0.4, 9, 0.45);
      c.fillStyle = lin(c, 0, y - 20, 0, y - 4, [[0, '#a8a29e'], [1, '#57534e']]); c.fillRect(x - 16, y - 20, 32, 16);
      c.strokeStyle = '#292524'; c.lineWidth = 0.8; c.strokeRect(x - 16, y - 20, 32, 16);
      c.fillStyle = '#292524'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText('ELE TENTOU', x, y - 10);
      const st = lin(c, x - 10, y - 70, x + 10, y - 20, [[0, '#d6d3d1'], [1, '#78716c']]);
      c.fillStyle = st;
      c.beginPath(); c.arc(x, y - 58, 6, 0, 6.28); c.fill();
      rrect(c, x - 8, y - 52, 16, 22, 4); c.fill();
      c.fillRect(x - 7, y - 31, 5, 11); c.fillRect(x + 2, y - 31, 5, 11);
      c.save(); c.translate(x + 9, y - 46); c.rotate(-0.4);
      c.fillRect(-1, -18, 2.4, 34); c.fillRect(-5, 14, 10, 6); c.restore();
      c.strokeStyle = '#57534e'; c.lineWidth = 0.6; c.beginPath(); c.arc(x, y - 58, 6, 0, 6.28); c.stroke();
      break;
    }
    case 'alien': {
      const h = Math.sin(time * 2) * 3;
      groundShadow(c, x, y - 4, 10, 4, 0.5);
      const cy = y - 20 + h;
      glow(c, x, cy, 34, '#c084fc', 0.45 + Math.sin(time * 5) * 0.15);
      c.beginPath(); c.arc(x, cy, 8, 0, 6.28);
      c.fillStyle = rad(c, x - 3, cy - 3, 0, 9, [[0, '#f5d0fe'], [0.5, '#a855f7'], [1, '#3b0764']]); c.fill();
      c.save(); c.translate(x, cy); c.rotate(time * 1.5);
      c.strokeStyle = 'rgba(232,121,249,0.8)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 0, 14, 4, 0, 0, 6.28); c.stroke();
      c.rotate(1.2); c.beginPath(); c.ellipse(0, 0, 13, 3.5, 0, 0, 6.28); c.stroke();
      c.restore();
      break;
    }
    case 'crown': {
      groundShadow(c, x, y - 4, 11, 4);
      c.fillStyle = '#7f1d1d'; rrect(c, x - 9, y - 12, 18, 8, 2); c.fill();
      c.fillStyle = '#b91c1c'; ellipse(c, x, y - 13, 8, 3); c.fill();
      c.fillStyle = lin(c, 0, y - 30, 0, y - 14, [[0, '#fff7b0'], [1, '#ca8a04']]);
      c.beginPath(); c.moveTo(x - 9, y - 14); c.lineTo(x - 10, y - 27); c.lineTo(x - 5, y - 21); c.lineTo(x, y - 30); c.lineTo(x + 5, y - 21); c.lineTo(x + 10, y - 27); c.lineTo(x + 9, y - 14); c.closePath(); c.fill();
      c.strokeStyle = '#713f12'; c.lineWidth = 0.7; c.stroke();
      for (const [gx, col] of [[-5, '#ef4444'], [0, '#22d3ee'], [5, '#4ade80']] as [number, string][]) { c.fillStyle = col; c.beginPath(); c.arc(x + gx, y - 18, 1.6, 0, 6.28); c.fill(); }
      glow(c, x, y - 22, 34, '#fde047', 0.4 + Math.sin(time * 3) * 0.15);
      break;
    }
    default: break;
  }
}

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
    c.strokeStyle = 'rgba(255,230,120,0.8)'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.lineDashOffset = -time * 12;
    c.beginPath(); c.ellipse(x, y - sp.size * TILE * 0.35, r, r * 0.6, 0, 0, 6.28); c.stroke();
    c.setLineDash([]);
    if (st.progress > 0) {
      c.strokeStyle = '#4ade80'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y - sp.size * TILE - 14, 7, -Math.PI / 2, -Math.PI / 2 + st.progress * 6.28); c.stroke();
    }
    c.restore();
  }
}
