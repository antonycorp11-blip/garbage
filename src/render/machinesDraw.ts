import { DX, DY, TILE, WORLD_TILES } from '../core/constants';
import { MATERIALS } from '../data/materials';
import { MACHINES } from '../data/machines';
import { Game } from '../game/Game';
import { BOT_GO, BOT_RETURN, BOT_WORK, Bot, Machine, machineBufferCap } from '../game/Machines';
import {
  blit, bolt, box34, cable, cachedLayer, contactShadow, corrugated, cylinder34, gauge, glow, hazardStripes, lamp,
  levelStars, pipe, plate, rivet, rivetRow, stencil, vent, weather, windowGlass,
} from './detail';
import { Effects } from './Effects';
import { ellipse, groundShadow, lin, poly, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const LEVEL_COLORS = ['#5f8f3e', '#3f74a8', '#2c8a86', '#c0702a', '#c9a227'];
const statusColor = (m: Machine) => (m.status === 'working' ? '#4ade80' : m.status === 'full' ? '#f87171' : '#facc15');

function bufferBar(c: C, x: number, y: number, w: number, frac: number) {
  rrect(c, x, y, w, 3.4, 1.7); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fill();
  if (frac > 0) {
    rrect(c, x + 0.6, y + 0.6, Math.max(1, (w - 1.2) * Math.min(1, frac)), 2.2, 1.1);
    c.fillStyle = frac >= 1 ? '#f87171' : frac > 0.75 ? '#fbbf24' : '#4ade80'; c.fill();
  }
}

function statusBubble(c: C, m: Machine, x: number, y: number, time: number) {
  if (m.status === 'working') return;
  const bob = Math.sin(time * 3 + m.id) * 1.5;
  c.save();
  c.translate(x, y + bob);
  c.beginPath(); c.arc(0, 0, 5.5, 0, 6.28);
  c.fillStyle = m.status === 'full' ? '#ef4444' : 'rgba(30,30,30,0.8)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(m.status === 'full' ? '!' : 'z', 0, 0.5);
  c.restore();
}

function targetPos(m: Machine): [number, number] | null {
  if (m.lastTarget < 0) return null;
  return [((m.lastTarget % WORLD_TILES) + 0.5) * TILE, (Math.floor(m.lastTarget / WORLD_TILES) + 0.5) * TILE];
}

// =====================================================================================================
// CONVEYORS
// =====================================================================================================
const beltFrame = () => cachedLayer('belt-frame', -16, -16, 34, 34, (c) => {
  const H = 16;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-H + 1.5, -H + 7, 32, 22);
  // support legs
  for (const lx of [-11, 9]) { c.fillStyle = '#3b3f43'; c.fillRect(lx, H - 5, 2.4, 5); c.fillStyle = '#23262a'; c.fillRect(lx - 1, H - 1.4, 4.4, 1.4); }
  // side plates
  plate(c, -H, -H + 2, 32, 4.4, '#8a939a', { r: 0.6 });
  plate(c, -H, H - 6.4, 32, 4.4, '#7a8389', { r: 0.6 });
  rivetRow(c, -H + 3, -H + 4.2, H - 3, -H + 4.2, 5, 0.55);
  rivetRow(c, -H + 3, H - 4.2, H - 3, H - 4.2, 5, 0.55);
  // bed
  c.fillStyle = '#1d1f22'; c.fillRect(-H, -H + 6.4, 32, 19.2);
  // end rollers
  for (const rx of [-H + 1.2, H - 1.2]) {
    c.fillStyle = lin(c, 0, -H + 6.4, 0, H - 6.4, [[0, '#9aa3a8'], [0.5, '#e1e6e8'], [1, '#5d666c']]);
    c.fillRect(rx - 1.2, -H + 6.4, 2.4, 19.2);
  }
});

const sepHood = () => cachedLayer('sep-hood', -16, -22, 34, 40, (c) => {
  contactShadow(c, -10, -12, 20, 26, 0.35);
  box34(c, -10, -20, 20, 10, 24, '#2f9e5d', 2);
  vent(c, -7, -16, 14, 3, 3);
  // camera
  c.fillStyle = '#111'; rrect(c, -4, -8, 8, 6, 1.5); c.fill();
  c.fillStyle = rad(c, -0.8, -5.8, 0, 2.8, [[0, '#9be7ff'], [0.5, '#1565c0'], [1, '#05101e']]); c.beginPath(); c.arc(0, -5, 2.4, 0, 6.28); c.fill();
  // chutes
  ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'].forEach((col, i) => { c.fillStyle = col; rrect(c, -9 + i * 3.8, 8, 3, 3.4, 0.6); c.fill(); });
  stencil(c, 'SEPARADOR', 0, 1.8, 3.2, 'rgba(0,30,10,0.75)');
  rivetRow(c, -8, -18.5, 8, -18.5, 4, 0.55);
  weather(c, -10, -10, 20, 24, 0.5, 4);
});

export function drawBelt(c: C, m: Machine, g: Game, time: number) {
  const x = m.tx * TILE, y = m.ty * TILE;
  const cx = x + TILE / 2, cy = y + TILE / 2;
  c.save();
  c.translate(cx, cy);
  c.rotate((m.dir * Math.PI) / 2);
  blit(c, beltFrame(), 0, 0);
  const H = TILE / 2;
  const speed = g.d.beltSpeed * TILE;
  c.save();
  c.beginPath(); c.rect(-H + 2.4, -H + 6.4, TILE - 4.8, 19.2); c.clip();
  const off = (time * speed) % 6;
  c.fillStyle = '#2e3135';
  for (let i = -H - 6; i < H + 6; i += 6) c.fillRect(i + off, -H + 6.4, 1.4, 19.2);
  c.fillStyle = m.linked ? 'rgba(250,204,21,0.75)' : 'rgba(248,113,113,0.65)';
  for (let i = -H - 16; i < H + 16; i += 16) {
    const px = i + ((time * speed) % 16);
    c.beginPath(); c.moveTo(px - 3, -4); c.lineTo(px + 2, 0); c.lineTo(px - 3, 4); c.lineTo(px - 1, 0); c.closePath(); c.fill();
  }
  c.restore();
  if (m.type === 'separator') {
    // hood is drawn upright (unrotated) so its 3/4 perspective stays correct
    c.rotate(-(m.dir * Math.PI) / 2);
    blit(c, sepHood(), 0, 0);
    const sc = Math.sin(time * 5) * 3.5;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,60,60,0.95)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-6, 6 + sc * 0.3); c.lineTo(6, 6 + sc * 0.3); c.stroke();
    glow(c, 0, -5, 5, '#38bdf8', 0.35 + Math.sin(time * 8) * 0.15);
    c.restore();
    ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'].forEach((col, i) => lamp(c, -7.6 + i * 3.8, -12, col, Math.sin(time * 6 + i) > 0.2, 0.6));
  }
  c.restore();
  // packets
  for (const p of m.belt) {
    const t = p.t - 0.5;
    const px = cx + DX[m.dir] * t * TILE, py = cy + DY[m.dir] * t * TILE;
    drawPacket(c, px, py, p.mat, p.sorted);
  }
}

function drawPacket(c: C, px: number, py: number, mat: number, sorted: boolean) {
  const col = MATERIALS[mat].color;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(px - 4, py - 1.5, 9.5, 6.5);
  box34(c, px - 5, py - 6, 10, 4, 6, col, 1.2);
  c.fillStyle = 'rgba(60,40,20,0.7)'; c.fillRect(px - 0.6, py - 6, 1.2, 10); c.fillRect(px - 5, py - 3.6, 10, 0.9);
  if (sorted) { c.fillStyle = '#22c55e'; c.beginPath(); c.arc(px + 3.2, py - 4, 1.6, 0, 6.28); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 0.5; c.stroke(); }
}

// =====================================================================================================
// MACHINE DISPATCH
// =====================================================================================================
export function drawMachine(c: C, m: Machine, g: Game, time: number, fx: Effects, onScreen: boolean) {
  const def = MACHINES[m.type];
  const s = def.size * TILE;
  const x = m.tx * TILE, y = m.ty * TILE;
  const cx = x + s / 2;
  const working = m.status === 'working';
  c.save();
  if (m.built < 1) {
    const k = 1 - Math.pow(1 - m.built, 3);
    c.translate(cx, y + s);
    c.scale(0.6 + k * 0.4, k);
    c.translate(-cx, -(y + s));
    c.globalAlpha *= 0.4 + k * 0.6;
  }
  switch (m.type) {
    case 'depot': drawDepot(c, x, y, time, g); break;
    case 'collector': drawCollector(c, m, x, y, time, working, fx, onScreen); break;
    case 'arm': drawArm(c, m, x, y, time, working, fx, onScreen); break;
    case 'crusher': drawCrusher(c, m, x, y, time, working, fx, onScreen); break;
    case 'robots': drawStation(c, m, x, y, time); break;
    case 'excavator': drawGarage(c, m, x, y, time); break;
    case 'recycler': drawRecycler(c, x, y, time, fx, onScreen); break;
    case 'ancient': drawAncient(c, m, x, y, time, working, fx, onScreen); break;
    default: break;
  }
  c.restore();
  if (def.buffer > 0) {
    const cap = machineBufferCap(m, g.d);
    if (m.bufferTotal > 0 || m.status === 'full') bufferBar(c, x + 4, y + s + 1, s - 8, m.bufferTotal / cap);
  }
  if (m.type !== 'depot' && m.type !== 'recycler') statusBubble(c, m, x + s - 2, y - (s > 32 ? 30 : 22), time);
}

// =====================================================================================================
// COLLECTOR
// =====================================================================================================
function collectorBase(level: number) {
  return cachedLayer(`collector-${level}`, -8, -30, 48, 66, (c) => {
    const col = LEVEL_COLORS[level - 1];
    groundShadow(c, 18, 27, 18, 7, 0.45);
    // legs
    for (const [lx, ly] of [[4, 25], [28, 25], [6, 17], [26, 17]]) {
      pipe(c, [16 + (lx - 16) * 0.5, ly - 6, lx, ly], 2, '#4b5257');
      c.fillStyle = '#2b2f33'; ellipse(c, lx, ly + 0.6, 2.6, 1.2); c.fill();
      bolt(c, lx, ly, 0.7);
    }
    // plinth
    box34(c, 3, 12, 26, 6, 9, '#6f787e', 1.5);
    hazardStripes(c, 3.6, 22, 24.8, 2.4);
    rivetRow(c, 5, 19.5, 27, 19.5, 6, 0.55);
    weather(c, 3, 12, 26, 15, 0.6, level * 3 + 1);
    // drum
    cylinder34(c, 16, -6, 11, 18, col, 2);
    weather(c, 5, -6, 22, 20, 0.45, level * 5 + 2);
    stencil(c, `C-0${level}`, 16, 6.5, 3.6, 'rgba(255,255,255,0.75)');
    // control box (left)
    box34(c, -4, 2, 8, 3, 9, '#46505a', 1);
    vent(c, -3, 6.5, 6, 2.8, 3);
    gauge(c, 0, 12.2, 1.6, -0.5);
    cable(c, 0, 14, 6, 26, 3);
    // hopper (right)
    box34(c, 25, 4, 10, 4, 10, '#4a4f54', 1);
    c.fillStyle = '#121416'; rrect(c, 27, 9, 6, 3.4, 0.6); c.fill();
    // exhaust
    pipe(c, [24, 0, 24, -14, 26.5, -17], 2.4, '#6b7378');
    c.fillStyle = '#222'; ellipse(c, 26.8, -17.3, 1.4, 0.7); c.fill();
    // intake ring + grate
    ellipse(c, 16, -6, 9.6, 4.1); c.fillStyle = '#0f1112'; c.fill();
    c.strokeStyle = '#8b959b'; c.lineWidth = 1.1; ellipse(c, 16, -6, 9.8, 4.2); c.stroke();
    rivetRow(c, 7.5, -4.5, 24.5, -4.5, 6, 0.45);
    if (level >= 3) { pipe(c, [9, -6, 7, -22], 0.9, '#444'); }
    if (level >= 5) { c.strokeStyle = '#f2c94c'; c.lineWidth = 0.9; ellipse(c, 16, 12, 11, 4.6); c.stroke(); }
    levelStars(c, 16, 30.5, level);
  });
}

function drawCollector(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  blit(c, collectorBase(m.level), x, y);
  const cx = x + 16, cy = y - 6;
  // spinning fan
  c.save(); c.translate(cx, cy); c.scale(1, 0.43); c.rotate(working ? time * 16 : time * 0.4);
  for (let i = 0; i < 6; i++) {
    c.rotate(1.047);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(5, -2.6, 8.5, 1); c.lineTo(1.4, 1.6); c.closePath();
    c.fillStyle = i % 2 ? '#aab3b9' : '#8a949a'; c.fill();
  }
  c.fillStyle = rad(c, -0.5, -0.5, 0, 2.2, [[0, '#fff'], [1, '#6b757b']]); c.beginPath(); c.arc(0, 0, 2, 0, 6.28); c.fill();
  c.restore();
  if (working) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(180,220,255,0.12)'; ellipse(c, cx, cy, 8.6, 3.6); c.fill(); c.restore(); }
  // hopper fill
  const fill = Math.min(1, m.bufferTotal / Math.max(1, MACHINES.collector.buffer * (1 + 0.3 * (m.level - 1))));
  if (fill > 0) { c.fillStyle = fill >= 1 ? '#f87171' : '#a3e635'; c.fillRect(x + 27.4, y + 9.4 + 3 * (1 - fill), 5.2, 3 * fill); }
  lamp(c, x - 2, y + 4, statusColor(m), !working || Math.sin(time * 5) > -0.4, 1);
  if (m.level >= 3) lamp(c, x + 7, y - 22.5, '#f87171', Math.sin(time * 2.5 + m.id) > 0.3, 1);
  if (working && onScreen) {
    const tp = targetPos(m);
    if (tp && Math.random() < 0.55) fx.suck(tp[0] + (Math.random() - 0.5) * 22, tp[1] + (Math.random() - 0.5) * 22, cx, cy, Math.floor(Math.random() * 3), 0.5);
    if (Math.random() < 0.05) fx.smoke(x + 26.8, y - 18);
  }
}

// =====================================================================================================
// MECHANICAL ARM
// =====================================================================================================
function armBase(level: number) {
  return cachedLayer(`arm-${level}`, -6, -16, 44, 52, (c) => {
    groundShadow(c, 17, 26, 17, 7, 0.4);
    // base plate
    box34(c, 1, 8, 30, 14, 6, '#5d666c', 2);
    hazardStripes(c, 1.6, 23, 28.8, 2.2);
    for (const [bx, by] of [[4, 11], [28, 11], [4, 19.5], [28, 19.5]]) bolt(c, bx, by, 1.1);
    weather(c, 1, 8, 30, 20, 0.7, level + 11);
    // hydraulic power unit at the back
    box34(c, 3, -6, 12, 4, 10, '#c26a17', 1.2);
    vent(c, 5, -1, 8, 3, 3);
    gauge(c, 11.5, 5.5, 1.4, 0.4 + level * 0.3);
    box34(c, 18, -3, 9, 3, 8, '#3f474d', 1);
    stencil(c, 'HID', 22.5, 3.5, 2.6, 'rgba(255,255,255,0.6)');
    // hoses to turret
    cable(c, 9, 4, 15, 13, 2, '#1c1c1e', 1.3);
    cable(c, 22, 4, 18, 13, 2, '#27272a', 1.3);
    // turret ring
    ellipse(c, 16, 15, 8.5, 4.5); c.fillStyle = '#2b3034'; c.fill();
    ellipse(c, 16, 14.2, 8.5, 4.5); c.fillStyle = lin(c, 8, 10, 24, 18, [[0, '#a7b0b5'], [1, '#4a5257']]); c.fill();
    c.strokeStyle = '#1e2224'; c.lineWidth = 0.6; c.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; rivet(c, 16 + Math.cos(a) * 6.8, 14.2 + Math.sin(a) * 3.5, 0.45); }
    levelStars(c, 16, 30, level);
  });
}

function drawArm(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  blit(c, armBase(m.level), x, y);
  const cx = x + 16, cy = y + 13;
  const tp = targetPos(m);
  let ang = Math.sin(time * 0.6 + m.id) * 1.2 - 1.2;
  let reach = 18;
  if (tp) { ang = Math.atan2(tp[1] - cy, tp[0] - cx); reach = Math.min(50, Math.hypot(tp[0] - cx, tp[1] - cy)); }
  const pump = working ? (Math.sin(time * 9) + 1) / 2 : 0.25;
  // turret housing (rotates)
  c.save(); c.translate(cx, cy);
  const hx = Math.cos(ang) * 3, hy = Math.sin(ang) * 1.6;
  rrect(c, -6 + hx * 0.3, -9 + hy, 12, 9, 2.5);
  c.fillStyle = lin(c, -6, -9, 6, 0, [[0, '#ffbf5a'], [1, '#b85f00']]); c.fill();
  c.strokeStyle = '#4a2600'; c.lineWidth = 0.7; c.stroke();
  windowGlass(c, -3 + hx * 0.4, -7.5 + hy, 6, 2.6);
  c.restore();
  const L1 = 17, L2 = Math.max(9, reach - L1 * 0.65) * (0.82 + pump * 0.18);
  const sx = cx, sy = cy - 8;
  const jx = sx + Math.cos(ang - 0.45) * L1, jy = sy + Math.sin(ang - 0.45) * L1 - 9;
  const ex = jx + Math.cos(ang + 0.3) * L2, ey = jy + Math.sin(ang + 0.3) * L2 + 9;
  // shadows of the arm on the ground
  c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx + 3, cy + 5); c.lineTo(jx + 6, jy + 14); c.lineTo(ex + 4, ey + 8); c.stroke();
  // boom segments
  const seg = (x0: number, y0: number, x1: number, y1: number, w: number, col: string) => {
    const a = Math.atan2(y1 - y0, x1 - x0), l = Math.hypot(x1 - x0, y1 - y0);
    c.save(); c.translate(x0, y0); c.rotate(a);
    rrect(c, -w / 2, -w / 2, l + w, w, w / 2);
    c.fillStyle = lin(c, 0, -w / 2, 0, w / 2, [[0, shade(col, 0.4)], [0.5, col], [1, shade(col, -0.45)]]); c.fill();
    c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.6; c.stroke();
    hazardStripes(c, l * 0.55, -w / 2 + 0.4, l * 0.18, w - 0.8);
    c.restore();
  };
  seg(sx, sy, jx, jy, 5, '#f0a63a');
  // hydraulic piston parallel to the first segment
  const pa = Math.atan2(jy - sy, jx - sx);
  const px0 = sx + Math.cos(pa + 1.57) * 3.2, py0 = sy + Math.sin(pa + 1.57) * 3.2;
  const plen = Math.hypot(jx - sx, jy - sy) * (0.55 + pump * 0.15);
  pipe(c, [px0, py0, px0 + Math.cos(pa) * plen * 0.6, py0 + Math.sin(pa) * plen * 0.6], 2.2, '#5d666c');
  pipe(c, [px0 + Math.cos(pa) * plen * 0.6, py0 + Math.sin(pa) * plen * 0.6, px0 + Math.cos(pa) * plen, py0 + Math.sin(pa) * plen], 1.2, '#e4e8ea');
  seg(jx, jy, ex, ey, 3.8, '#f5b94f');
  cable(c, sx + 2, sy, jx + 1, jy + 1, 3, '#1e1e20', 0.8);
  // joints
  for (const [jxx, jyy] of [[sx, sy], [jx, jy]]) {
    c.fillStyle = rad(c, jxx - 0.8, jyy - 0.8, 0, 3.2, [[0, '#cfd8dc'], [1, '#37474f']]); c.beginPath(); c.arc(jxx, jyy, 2.8, 0, 6.28); c.fill();
    bolt(c, jxx, jyy, 0.9);
  }
  // claw with three fingers
  const open = working ? 0.25 + pump * 0.7 : 0.5;
  c.save(); c.translate(ex, ey); c.rotate(ang + 0.3);
  c.fillStyle = '#37474f'; rrect(c, -1.5, -2.4, 4, 4.8, 1); c.fill();
  c.strokeStyle = '#263238'; c.lineWidth = 1.5; c.lineCap = 'round';
  for (const k of [-1, 0, 1]) {
    const a = k * (0.35 + open * 0.55);
    c.beginPath(); c.moveTo(2, k * 1.2); c.lineTo(2 + Math.cos(a) * 4.5, k * 1.2 + Math.sin(a) * 4.5); c.lineTo(2 + Math.cos(a * 0.3) * 7.5, k * 1.2 + Math.sin(a) * 4.5 + Math.sin(a * 0.3) * 2); c.stroke();
  }
  c.restore();
  lamp(c, x + 24.5, y + 0.5, statusColor(m), true, 0.9);
  if (working && onScreen && tp && Math.random() < 0.1) fx.burst(tp[0], tp[1], 'dust', 1);
}

// =====================================================================================================
// INDUSTRIAL CRUSHER (2x2)
// =====================================================================================================
function crusherBase(level: number) {
  return cachedLayer(`crusher-${level}`, -12, -44, 92, 116, (c) => {
    const body = level >= 4 ? '#e0a422' : '#f2b01e';
    groundShadow(c, 34, 62, 36, 11, 0.5);
    // output chute at the front
    poly(c, [22, 50, 42, 50, 46, 66, 18, 66]);
    c.fillStyle = lin(c, 0, 50, 0, 66, [[0, '#5f686e'], [1, '#2e3337']]); c.fill(); c.strokeStyle = '#1b1e20'; c.lineWidth = 0.7; c.stroke();
    // main chassis
    box34(c, 2, 4, 60, 24, 34, body, 3);
    weather(c, 2, 26, 60, 36, 0.8, level * 13 + 3);
    hazardStripes(c, 2.6, 54, 58.8, 5);
    rivetRow(c, 5, 31, 59, 31, 12, 0.6);
    rivetRow(c, 5, 51, 59, 51, 12, 0.6);
    // side motor housings
    for (const mx of [-6, 58]) {
      box34(c, mx, 22, 10, 5, 16, '#4b5359', 1.2);
      vent(c, mx + 1.6, 30, 6.8, 6, 4);
    }
    // control cabin (front right)
    box34(c, 40, 12, 18, 6, 16, '#d6dadc', 1.5);
    windowGlass(c, 43, 20, 12, 5.5);
    stencil(c, 'CTRL', 49, 29.5, 2.8, 'rgba(0,0,0,0.6)');
    // big front panel with stencil and warning sign
    stencil(c, 'TRITURA-TUDO', 22, 37, 5, 'rgba(40,24,0,0.8)');
    poly(c, [10, 48, 15, 40, 20, 48]); c.fillStyle = '#ffd54f'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 0.8; c.stroke();
    stencil(c, '!', 15, 45.5, 5, '#111');
    gauge(c, 30, 46, 2.4, -0.4);
    gauge(c, 36, 46, 2.4, 0.6);
    // hopper opening on the top face
    poly(c, [7, 6, 57, 6, 52, 24, 12, 24]);
    c.fillStyle = lin(c, 0, 6, 0, 24, [[0, '#2a2e31'], [1, '#0d0f10']]); c.fill();
    c.strokeStyle = '#8b959b'; c.lineWidth = 1.4; c.stroke();
    // railing on the top edge
    c.strokeStyle = '#c62828'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(3, 2); c.lineTo(61, 2); c.stroke();
    for (let i = 3; i <= 61; i += 7) { c.beginPath(); c.moveTo(i, 2); c.lineTo(i, 6); c.stroke(); }
    // ladder on the left
    c.strokeStyle = '#90979b'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-1, 6); c.lineTo(-1, 50); c.moveTo(3, 6); c.lineTo(3, 50); c.stroke();
    for (let i = 9; i < 50; i += 4) { c.beginPath(); c.moveTo(-1, i); c.lineTo(3, i); c.stroke(); }
    // chimney
    cylinder34(c, 54, -34, 4.2, 38, '#59626a', 3);
    c.fillStyle = '#c62828'; c.fillRect(49.8, -28, 8.4, 2.4);
    ellipse(c, 54, -34, 3.2, 1.3); c.fillStyle = '#0d0d0d'; c.fill();
    // pipes
    pipe(c, [44, 12, 44, 4, 50, 0], 2.4, '#7c868c');
    if (level >= 3) { box34(c, 20, -6, 10, 4, 6, '#3f474d', 1); cable(c, 25, 0, 40, 14, 3); }
    levelStars(c, 32, 69, level);
  });
}

function drawCrusher(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  const shake = working ? Math.sin(time * 55) * 0.5 : 0;
  c.save(); c.translate(shake, 0);
  blit(c, crusherBase(m.level), x, y);
  // rollers with teeth inside the hopper
  for (let r = 0; r < 2; r++) {
    const ry = y + 11 + r * 6.5;
    const x0 = x + 13 + r * 1.5, x1 = x + 51 - r * 1.5;
    c.fillStyle = lin(c, 0, ry - 2.6, 0, ry + 2.6, [[0, '#9aa3a8'], [0.5, '#5b646a'], [1, '#2a2f33']]);
    c.fillRect(x0, ry - 2.6, x1 - x0, 5.2);
    const rot = ((working ? time * 22 : 0) * (r ? -1 : 1)) % 4;
    c.fillStyle = '#e5e8ea';
    for (let tx = x0 + ((rot + 4) % 4); tx < x1 - 1; tx += 4) { poly(c, [tx, ry - 2.6, tx + 1.6, ry - 4, tx + 2.2, ry - 2.6]); c.fill(); c.fillRect(tx, ry - 0.4, 1.8, 0.8); }
  }
  if (working) {
    // debris bouncing in the hopper
    for (let i = 0; i < 5; i++) {
      const t = (time * 2.3 + i * 0.37) % 1;
      const bx = x + 16 + ((i * 37) % 32), by = y + 10 - Math.sin(t * Math.PI) * 5;
      c.fillStyle = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#8d6e63'][i]; c.fillRect(bx, by, 2.2, 1.6);
    }
  }
  lamp(c, x + 44, y + 16, statusColor(m), true, 1.2);
  lamp(c, x + 52, y + 16, '#f87171', working && Math.sin(time * 10) > 0, 1.2);
  if (m.level >= 3) lamp(c, x + 25, y - 6, '#fbbf24', Math.sin(time * 4) > 0, 1);
  c.restore();
  if (working && onScreen) {
    if (Math.random() < 0.18) fx.smoke(x + 54, y - 36);
    if (Math.random() < 0.3) fx.burst(x + 32 + (Math.random() - 0.5) * 30, y + 12, 'spark', 1);
    if (Math.random() < 0.12) fx.burst(x + 32, y + 64, 'dust', 1);
    const tp = targetPos(m);
    if (tp && Math.random() < 0.6) fx.suck(tp[0] + (Math.random() - 0.5) * 24, tp[1] + (Math.random() - 0.5) * 24, x + 32, y + 12, Math.floor(Math.random() * 3), 0.6);
  }
}

// =====================================================================================================
// ROBOT STATION
// =====================================================================================================
function stationBase(level: number) {
  return cachedLayer(`station-${level}`, -8, -30, 48, 66, (c) => {
    groundShadow(c, 17, 25, 18, 7, 0.35);
    // hexagonal pad
    const hex = (r: number, oy: number) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.PI / 6; c.lineTo(16 + Math.cos(a) * r, 18 + oy + Math.sin(a) * r * 0.55); } c.closePath(); };
    hex(16, 2.5); c.fillStyle = '#2e3338'; c.fill();
    hex(16, 0); c.fillStyle = lin(c, 0, 9, 0, 27, [[0, '#8e979d'], [1, '#535b61']]); c.fill(); c.strokeStyle = '#22272a'; c.lineWidth = 0.8; c.stroke();
    hex(12.5, 0); c.fillStyle = '#1f2428'; c.fill();
    c.strokeStyle = '#facc15'; c.lineWidth = 1.2; ellipse(c, 16, 18, 8.5, 4.6); c.stroke();
    stencil(c, 'R', 16, 18.3, 6, '#facc15');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.PI / 6; hazardStripes(c, 16 + Math.cos(a) * 14 - 1.5, 18 + Math.sin(a) * 7.7 - 0.8, 3, 1.6); }
    // charging pylon at the back
    box34(c, 24, -12, 8, 3, 18, '#3c4a57', 1.2);
    vent(c, 25.5, -6, 5, 6, 4);
    cable(c, 28, 8, 22, 18, 3, '#111', 1.1);
    // antenna mast + dish base
    pipe(c, [6, 12, 6, -18], 1.2, '#4b5563');
    c.strokeStyle = '#4b5563'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(6, -10); c.lineTo(2, 12); c.moveTo(6, -10); c.lineTo(10, 12); c.stroke();
    levelStars(c, 16, 31, level);
  });
}

function drawStation(c: C, m: Machine, x: number, y: number, time: number) {
  blit(c, stationBase(m.level), x, y);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + Math.PI / 6;
    lamp(c, x + 16 + Math.cos(a) * 10.5, y + 18 + Math.sin(a) * 5.8, '#38bdf8', Math.floor(time * 6) % 6 === i, 0.7);
  }
  // rotating dish
  const a = time * 0.8;
  c.save(); c.translate(x + 6, y - 19);
  c.scale(Math.cos(a) * 0.6 + 0.4 * Math.sign(Math.cos(a) || 1), 1);
  c.fillStyle = lin(c, -5, -3, 5, 3, [[0, '#f5f5f5'], [1, '#9e9e9e']]); ellipse(c, 0, 0, 5, 3.2); c.fill();
  c.strokeStyle = '#555'; c.lineWidth = 0.5; c.stroke();
  c.beginPath(); c.moveTo(0, 0); c.lineTo(3, -2.5); c.stroke();
  c.restore();
  lamp(c, x + 28, y - 13.5, statusColor(m), true, 1);
}

export function drawBots(c: C, m: Machine, time: number, fx: Effects, onScreen: boolean) {
  for (const b of m.bots) {
    if (m.type === 'excavator') drawExcavatorVehicle(c, b, time, fx, onScreen);
    else drawBot(c, b, time, fx, onScreen);
  }
}

function drawBot(c: C, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const hover = Math.sin(time * 5 + b.anim * 3) * 1.4;
  const working = b.state === BOT_WORK;
  groundShadow(c, x, y + 4, 7, 2.8, 0.35);
  const by = y - 12 + hover;
  // tractor beam
  if (working) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(c, 0, by + 4, 0, y + 6, [[0, 'rgba(56,189,248,0.45)'], [1, 'rgba(56,189,248,0)']]);
    c.beginPath(); c.moveTo(x - 2.5, by + 5); c.lineTo(x + 2.5, by + 5); c.lineTo(x + 8, y + 6); c.lineTo(x - 8, y + 6); c.closePath(); c.fill();
    c.restore();
  }
  // arms and rotors
  c.strokeStyle = '#3f4a55'; c.lineWidth = 1.2;
  const rotors = [[-7, -3], [7, -3], [-6, 3], [6, 3]];
  for (const [rx, ry] of rotors) { c.beginPath(); c.moveTo(x, by); c.lineTo(x + rx, by + ry * 0.7 - 2); c.stroke(); }
  for (const [rx, ry] of rotors) {
    const px = x + rx, py = by + ry * 0.7 - 2.5;
    c.fillStyle = '#1f2933'; c.beginPath(); c.arc(px, py + 0.6, 1, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(210,225,235,0.32)'; ellipse(c, px, py, 4.2, 1.4 + Math.abs(Math.sin(time * 60 + rx)) * 0.5); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.4; c.beginPath(); const a = time * 70 + rx; c.moveTo(px - Math.cos(a) * 4, py - Math.sin(a) * 1.2); c.lineTo(px + Math.cos(a) * 4, py + Math.sin(a) * 1.2); c.stroke();
  }
  // basket underneath
  rrect(c, x - 4, by + 2, 8, 4.5, 1.4); c.fillStyle = '#263238'; c.fill();
  const fill = Math.min(1, b.carryTotal / 30);
  if (fill > 0) {
    const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'];
    for (let i = 0; i < Math.ceil(fill * 5); i++) { c.fillStyle = cols[i]; c.fillRect(x - 3.4 + i * 1.4, by + 2.6 - Math.sin(i) * 0.6, 1.4, 1.6); }
  }
  // body shell
  c.beginPath(); c.ellipse(x, by, 5.4, 4.4, 0, 0, 6.28);
  c.fillStyle = rad(c, x - 1.8, by - 2, 0, 6.5, [[0, '#ffffff'], [0.45, '#cbd5e1'], [1, '#475569']]); c.fill();
  c.strokeStyle = '#1e293b'; c.lineWidth = 0.7; c.stroke();
  c.fillStyle = '#facc15'; c.fillRect(x - 5, by + 0.6, 10, 1);
  // visor and eye
  rrect(c, x - 3.4, by - 2.6, 6.8, 2.8, 1.4); c.fillStyle = '#0b1220'; c.fill();
  const ex = Math.cos(b.angle) * 1.5;
  lamp(c, x + ex, by - 1.2, working ? '#f97316' : b.state === BOT_RETURN ? '#a3e635' : '#38bdf8', true, 0.9);
  if (working && onScreen && Math.random() < 0.35) fx.suck(x + (Math.random() - 0.5) * 22, y + 6 + (Math.random() - 0.5) * 14, x, by + 5, Math.floor(Math.random() * 3), 0.35);
}

// =====================================================================================================
// EXCAVATOR GARAGE + VEHICLE
// =====================================================================================================
function garageBase(level: number) {
  return cachedLayer(`garage-${level}`, -14, -40, 94, 112, (c) => {
    groundShadow(c, 34, 60, 38, 11, 0.45);
    // concrete apron with tire tracks
    rrect(c, -4, 22, 72, 44, 3); c.fillStyle = lin(c, 0, 22, 0, 66, [[0, '#8d8a82'], [1, '#6f6c65']]); c.fill();
    c.strokeStyle = 'rgba(30,25,20,0.25)'; c.lineWidth = 4;
    for (const tx of [22, 42]) { c.setLineDash([3, 2]); c.beginPath(); c.moveTo(tx, 30); c.lineTo(tx, 66); c.stroke(); }
    c.setLineDash([]);
    // building walls (front) + brick base
    corrugated(c, 4, -2, 56, 36, '#7c8791');
    c.strokeStyle = '#2d3439'; c.lineWidth = 0.8; c.strokeRect(4, -2, 56, 36);
    for (let by = 26; by < 34; by += 2.6) for (let bx = 4 + ((by / 2.6) % 2) * 2.5; bx < 60; bx += 5) { c.fillStyle = (bx * by) % 3 < 1.5 ? '#9b4a32' : '#8a3f2a'; c.fillRect(bx, by, 4.6, 2.2); }
    // roof
    poly(c, [0, -2, 6, -18, 58, -18, 64, -2]);
    c.fillStyle = lin(c, 0, -18, 0, -2, [[0, '#c9d1d6'], [1, '#86929b']]); c.fill(); c.strokeStyle = '#3a4248'; c.lineWidth = 0.8; c.stroke();
    corrugated(c, 8, -17, 48, 14, 'rgba(0,0,0,0)', 4, true);
    windowGlass(c, 26, -15, 12, 6);
    vent(c, 46, -14, 7, 4, 3);
    // door frame
    c.fillStyle = '#2b3136'; c.fillRect(13, 4, 38, 30);
    hazardStripes(c, 13, 1.6, 38, 2.6);
    // sign board
    rrect(c, 18, -9, 28, 7, 1.2); c.fillStyle = '#fde047'; c.fill(); c.strokeStyle = '#3b2c00'; c.lineWidth = 0.7; c.stroke();
    stencil(c, 'ESCAVADEIRA', 32, -5.4, 3.4, '#3b2c00');
    // fuel tank on the side
    cylinder34(c, 66, 16, 4.5, 16, '#c62828', 1);
    stencil(c, 'DIESEL', 66, 26, 2.2, 'rgba(255,255,255,0.8)');
    // tire stack
    for (let i = 0; i < 3; i++) { c.fillStyle = '#1d1d1f'; ellipse(c, -4, 30 - i * 3.6, 6, 2.8); c.fill(); c.strokeStyle = '#3a3a3d'; c.lineWidth = 0.6; c.stroke(); c.fillStyle = '#0c0c0c'; ellipse(c, -4, 30 - i * 3.6, 2.4, 1.1); c.fill(); }
    weather(c, 4, -2, 56, 36, 0.4, level * 7 + 9);
    levelStars(c, 32, 69, level);
  });
}

function drawGarage(c: C, m: Machine, x: number, y: number, time: number) {
  blit(c, garageBase(m.level), x, y);
  const b = m.bots[0];
  const away = b ? Math.hypot(b.x - (m.tx + 1), b.y - (m.ty + 1)) : 0;
  const open = Math.min(1, away / 1.5);
  // roller door
  const dh = 30 * (1 - open * 0.85);
  c.fillStyle = lin(c, 0, y + 4, 0, y + 4 + dh, [[0, '#e2e8f0'], [1, '#94a3b8']]);
  c.fillRect(x + 13, y + 4, 38, dh);
  c.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = y + 6; i < y + 4 + dh; i += 2.4) c.fillRect(x + 13, i, 38, 0.6);
  lamp(c, x + 32, y + 0.2, '#fef08a', true, 1.1);
  lamp(c, x + 8, y + 2, statusColor(m), true, 1.1);
  lamp(c, x + 56, y + 2, '#f59e0b', m.status === 'working' && Math.sin(time * 7) > 0, 1.1);
}

function drawExcavatorVehicle(c: C, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const working = b.state === BOT_WORK;
  const moving = b.state === BOT_GO || b.state === BOT_RETURN;
  const ang = b.angle;
  groundShadow(c, x + 3, y + 6, 24, 13, 0.45);
  c.save();
  c.translate(x, y);
  // tracks
  c.save(); c.rotate(ang);
  for (const ty of [-12, 6.5]) {
    rrect(c, -16, ty, 32, 6.5, 3.2); c.fillStyle = '#1a1d21'; c.fill();
    const off = moving ? (time * 34) % 4 : 0;
    c.fillStyle = '#4b5258';
    for (let i = -15; i < 15; i += 4) c.fillRect(i + off, ty + 0.6, 1.6, 5.3);
    for (const wx of [-12, -4, 4, 12]) { c.fillStyle = '#6b7378'; c.beginPath(); c.arc(wx, ty + 3.25, 1.8, 0, 6.28); c.fill(); }
  }
  c.restore();
  const bodyAng = working ? ang + Math.sin(time * 2) * 0.45 : ang;
  c.save(); c.rotate(bodyAng);
  // counterweight with stripes
  rrect(c, -15, -8, 7, 16, 2.5); c.fillStyle = '#ca8a04'; c.fill();
  hazardStripes(c, -14.5, -7, 2.5, 14);
  // main body
  rrect(c, -10, -9.5, 20, 19, 3.5);
  c.fillStyle = lin(c, -10, -9, 10, 9, [[0, '#fff27a'], [0.5, '#facc15'], [1, '#a16207']]); c.fill(); c.strokeStyle = '#5a3a00'; c.lineWidth = 0.9; c.stroke();
  vent(c, -8, 2.5, 6, 4.5, 4);
  // cab
  rrect(c, -8, -8.5, 9, 9.5, 2); c.fillStyle = '#2b3136'; c.fill();
  windowGlass(c, -7, -7.5, 7, 7.5);
  // exhaust stack
  c.fillStyle = '#333'; c.beginPath(); c.arc(4, -6, 1.5, 0, 6.28); c.fill();
  // boom with hydraulic cylinders
  const dig = working ? (Math.sin(time * 5) + 1) / 2 : 0.3;
  const L = 16 + dig * 9;
  rrect(c, 6, -2.6, L, 5.2, 2); c.fillStyle = lin(c, 0, -2.6, 0, 2.6, [[0, '#fde047'], [1, '#a16207']]); c.fill(); c.strokeStyle = '#5a3a00'; c.lineWidth = 0.7; c.stroke();
  pipe(c, [7, -3.6, 6 + L * 0.65, -3.6], 1.4, '#9ca3af');
  pipe(c, [6 + L * 0.65, -3.6, 6 + L * 0.85, -3], 0.8, '#e5e7eb');
  c.save(); c.translate(6 + L, 0); c.rotate(dig * 1.2 - 0.4);
  poly(c, [0, -6.5, 7.5, -5.5, 9, 5.5, 0, 6.5]);
  c.fillStyle = lin(c, 0, -6, 9, 6, [[0, '#a3a9ae'], [1, '#30363b']]); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 0.7; c.stroke();
  c.fillStyle = '#e5e7eb'; for (let i = -5; i <= 4; i += 2.4) poly(c, [9, i, 11, i + 0.7, 9, i + 1.4]), c.fill();
  if (b.carryTotal > 0) { c.fillStyle = '#8b6b4a'; ellipse(c, 4, 0, 3.4, 4.5); c.fill(); c.fillStyle = '#4fc3f7'; c.fillRect(3, -2, 1.6, 1.4); c.fillStyle = '#e0c08f'; c.fillRect(4.6, 1, 1.6, 1.4); }
  c.restore();
  lamp(c, -3, -10, '#f59e0b', Math.sin(time * 8) > 0, 1.1);
  c.restore();
  c.restore();
  if (onScreen) {
    if (working) {
      const hx = x + Math.cos(bodyAng) * (6 + L), hy = y + Math.sin(bodyAng) * (6 + L);
      if (Math.random() < 0.5) fx.burst(hx, hy, 'dust', 1);
      if (Math.random() < 0.08) fx.shake(0.12);
    }
    if ((moving || working) && Math.random() < 0.08) fx.smoke(x + Math.cos(bodyAng) * 4 - Math.sin(bodyAng) * 6, y + Math.sin(bodyAng) * 4 - 10);
    if (moving && Math.random() < 0.18) fx.burst(x - Math.cos(ang) * 15, y - Math.sin(ang) * 15 + 6, 'dust', 1);
  }
}

// =====================================================================================================
// RECYCLING CENTER (3x3)
// =====================================================================================================
const recyclerBase = () => cachedLayer('recycler', -16, -64, 130, 176, (c) => {
  groundShadow(c, 50, 94, 54, 14, 0.5);
  // yard
  rrect(c, -6, 30, 108, 70, 4); c.fillStyle = lin(c, 0, 30, 0, 100, [[0, '#8a8a80'], [1, '#6c6c63']]); c.fill();
  c.strokeStyle = 'rgba(250,204,21,0.6)'; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.strokeRect(-3, 33, 102, 64); c.setLineDash([]);
  // silos at the back left
  for (const [sx, h] of [[6, 46], [18, 40]] as [number, number][]) { cylinder34(c, sx, -38 + (46 - h), 6.5, h, '#d7dde0', 3); stencil(c, '♻', sx, -10, 6, '#16a34a'); }
  pipe(c, [12, -30, 30, -30, 30, -8], 2, '#9aa3a8');
  // main hall
  box34(c, 24, -22, 74, 30, 50, '#3f9a6a', 3);
  corrugated(c, 25, 9, 72, 38, '#55b07f', 3.2);
  c.strokeStyle = '#14532d'; c.lineWidth = 1; c.strokeRect(24, 8, 74, 50);
  // roof details: skylights, units, catwalk railing
  for (let i = 0; i < 4; i++) windowGlass(c, 30 + i * 16, -17, 11, 6);
  box34(c, 74, -14, 16, 4, 7, '#9aa3a8', 1); vent(c, 76, -9, 12, 2.6, 2);
  c.strokeStyle = '#facc15'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(25, -21); c.lineTo(97, -21); c.stroke();
  for (let i = 26; i < 98; i += 6) { c.beginPath(); c.moveTo(i, -21); c.lineTo(i, -18); c.stroke(); }
  // windows row
  for (let i = 0; i < 5; i++) windowGlass(c, 30 + i * 13.5, 14, 9, 7);
  // big logo plate
  c.fillStyle = '#ecfdf5'; c.beginPath(); c.arc(42, 38, 10, 0, 6.28); c.fill(); c.strokeStyle = '#065f46'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = '#16a34a'; c.lineWidth = 2.4;
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * 6.28 - 1.2;
    c.beginPath(); c.arc(42, 38, 6, a0, a0 + 1.5); c.stroke();
    const ax = 42 + Math.cos(a0 + 1.5) * 6, ay = 38 + Math.sin(a0 + 1.5) * 6;
    c.fillStyle = '#16a34a'; c.beginPath(); c.arc(ax, ay, 1.8, 0, 6.28); c.fill();
  }
  // door + intake conveyor
  c.fillStyle = '#052e1a'; c.fillRect(60, 34, 26, 24);
  hazardStripes(c, 60, 31.5, 26, 2.6);
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#2d3135' : '#1b1e21'; c.fillRect(64 + i * 3, 58, 3, 16); }
  plate(c, 62, 58, 2, 16, '#8a939a', { r: 0.4 }); plate(c, 82, 58, 2, 16, '#8a939a', { r: 0.4 });
  // sign
  rrect(c, 30, -1, 60, 9, 1.5); c.fillStyle = '#064e3b'; c.fill(); c.strokeStyle = '#a7f3d0'; c.lineWidth = 0.6; c.stroke();
  stencil(c, 'CENTRAL DE RECICLAGEM', 60, 3.6, 3.7, '#d1fae5');
  // chimney
  cylinder34(c, 92, -58, 4.6, 46, '#cbd5e1', 4);
  c.fillStyle = '#ef4444'; c.fillRect(87.4, -52, 9.2, 3);
  ellipse(c, 92, -58, 3.4, 1.4); c.fillStyle = '#111'; c.fill();
  // bins outside
  ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'].forEach((col, i) => box34(c, 2 + i * 9, 74, 8, 3, 9, col, 1));
  weather(c, 24, 8, 74, 50, 0.2, 77);
});

function drawRecycler(c: C, x: number, y: number, time: number, fx: Effects, onScreen: boolean) {
  blit(c, recyclerBase(), x, y);
  // rooftop fans
  c.save(); c.translate(x + 82, y - 12); c.scale(1, 0.45); c.rotate(time * 6);
  c.fillStyle = '#4b5563'; for (let i = 0; i < 4; i++) { c.rotate(1.57); c.fillRect(-1, 0, 2, 5); }
  c.restore();
  // windows flicker
  for (let i = 0; i < 5; i++) if (Math.sin(time * 0.9 + i * 1.7) > 0.2) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,230,140,0.35)'; c.fillRect(x + 30 + i * 13.5, y + 14, 9, 7); c.restore(); }
  for (let i = 0; i < 4; i++) lamp(c, x + 2 + i * 32, y + 31, '#facc15', Math.floor(time * 2) % 4 === i, 0.9);
  if (onScreen) {
    if (Math.random() < 0.15) fx.smoke(x + 92, y - 60);
    if (Math.random() < 0.05) fx.smoke(x + 6, y - 40);
  }
}

// =====================================================================================================
// DEPOT (3x3) — grows with the "Depósito Ampliado" upgrade
// =====================================================================================================
function depotBase(stage: number) {
  return cachedLayer(`depot-${stage}`, -24, -54, 146, 166, (c) => {
    groundShadow(c, 50, 96, 58, 14, 0.4);
    // concrete pad
    rrect(c, -6, 14, 108, 88, 4); c.fillStyle = lin(c, 0, 14, 0, 102, [[0, '#a5a196'], [1, '#7f7b72']]); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.12)'; for (let i = 20; i < 100; i += 16) { c.beginPath(); c.moveTo(-6, i); c.lineTo(102, i); c.stroke(); }
    for (const [ox, oy, rx] of [[20, 40, 9], [60, 55, 6], [30, 88, 7], [85, 30, 5]]) { c.fillStyle = rad(c, ox, oy, 0, rx, [[0, 'rgba(25,20,15,0.3)'], [1, 'rgba(25,20,15,0)']]); ellipse(c, ox, oy, rx, rx * 0.6); c.fill(); }
    // office container (back left)
    box34(c, -2, -14, 40, 12, 26, '#2f6f9e', 2);
    corrugated(c, -1, -1, 38, 24, '#3a7fb3', 2.4);
    c.strokeStyle = '#14324a'; c.lineWidth = 0.8; c.strokeRect(-2, -2, 40, 26);
    windowGlass(c, 4, 3, 12, 8, true);
    c.fillStyle = '#1f3a52'; c.fillRect(22, 4, 9, 19); c.fillStyle = '#d4a017'; c.fillRect(29, 13, 1.2, 1.6);
    box34(c, 8, -20, 12, 3, 6, '#cfd8dc', 1); vent(c, 9.5, -16, 9, 2.6, 2); // AC unit
    stencil(c, 'ESCRITÓRIO', 18, -8, 3.6, 'rgba(255,255,255,0.75)');
    // scale platform
    box34(c, 70, 66, 26, 12, 4, '#6b7378', 1);
    rivetRow(c, 72, 72, 94, 72, 6, 0.5);
    box34(c, 88, 52, 8, 4, 12, '#37474f', 1);
    gauge(c, 92, 61, 2.4, 0.3);
    // shed posts
    for (const px of [42, 96]) { pipe(c, [px, 4, px, 46], 2.2, '#6d4c33'); }
    // pallets and crates
    for (let i = 0; i < 2; i++) { box34(c, 76 + i * 2, 80 - i * 6, 18, 6, 4, '#b88b56', 0.8); }
    box34(c, 80, 72, 10, 5, 7, '#9c6b3a', 0.8);
    c.strokeStyle = '#5c3a1a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(80, 75); c.lineTo(90, 80); c.moveTo(90, 75); c.lineTo(80, 80); c.stroke();
    // sorted bins
    const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'];
    const binCount = stage >= 2 ? 5 : 5;
    for (let i = 0; i < binCount; i++) {
      const bx = 2 + i * 13.5, by = 66;
      box34(c, bx, by, 12, 5, 13, cols[i], 1.4);
      c.fillStyle = shade(cols[i], -0.45); c.fillRect(bx + 1, by + 0.8, 10, 2.6);
      stencil(c, '♻', bx + 6, by + 11.5, 6, 'rgba(255,255,255,0.75)');
      weather(c, bx, by + 5, 12, 13, 0.4, i + 3);
    }
    // lamp post
    pipe(c, [-10, 96, -10, 30, -4, 26], 1.6, '#3a3f44');
    c.fillStyle = '#2b2f33'; poly(c, [-7, 24, -1, 24, -2, 28, -6, 28]); c.fill();
    // fence pieces
    c.strokeStyle = '#8d9396'; c.lineWidth = 0.6;
    for (let fx0 = 100; fx0 < 116; fx0 += 3) { c.beginPath(); c.moveTo(fx0, 40); c.lineTo(fx0, 60); c.stroke(); }
    c.beginPath(); c.moveTo(100, 40); c.lineTo(116, 40); c.moveTo(100, 50); c.lineTo(116, 50); c.moveTo(100, 60); c.lineTo(116, 60); c.stroke();
    // shed roof (corrugated, 3/4)
    poly(c, [36, 10, 42, -12, 100, -12, 104, 10]);
    c.save(); c.clip();
    corrugated(c, 34, -14, 72, 26, '#a9b4bb', 3.4);
    c.fillStyle = lin(c, 0, -12, 0, 10, [[0, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0.25)']]); c.fillRect(34, -14, 72, 26);
    weather(c, 34, -14, 72, 26, 0.5, 21);
    c.restore();
    poly(c, [36, 10, 42, -12, 100, -12, 104, 10]); c.strokeStyle = '#3f474c'; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(38, 10, 64, 6);
    // sign with bulbs
    rrect(c, 46, -32, 50, 16, 2); c.fillStyle = lin(c, 0, -32, 0, -16, [[0, '#f8d77e'], [1, '#c9932e']]); c.fill();
    c.strokeStyle = '#5a3d10'; c.lineWidth = 1; c.stroke();
    pipe(c, [52, -16, 52, -10], 1, '#3b3b3b'); pipe(c, [90, -16, 90, -10], 1, '#3b3b3b');
    stencil(c, 'DEPÓSITO', 71, -24, 8, '#3b2306');
    // extensions with the upgrade
    if (stage >= 1) {
      // tarp extension over a second sorting area
      poly(c, [104, 22, 108, 6, 124, 6, 126, 22]); c.fillStyle = '#2f7d4f'; c.fill(); c.strokeStyle = '#173d27'; c.stroke();
      for (let i = 108; i < 126; i += 4) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(i, 6, 1.5, 16); }
      box34(c, 108, 26, 14, 5, 10, '#86efac', 1);
    }
    if (stage >= 2) {
      // forklift
      box34(c, 54, 82, 12, 6, 8, '#f59e0b', 1.2);
      pipe(c, [66, 76, 66, 92], 1, '#333'); c.fillStyle = '#333'; c.fillRect(66, 90, 6, 1.2);
      c.fillStyle = '#111'; c.beginPath(); c.arc(56, 96, 2, 0, 6.28); c.arc(64, 96, 2, 0, 6.28); c.fill();
    }
    if (stage >= 3) {
      // second container on top of the office (stacked)
      box34(c, 0, -40, 32, 9, 18, '#b23b2e', 2);
      corrugated(c, 1, -30, 30, 16, '#c94c3c', 2.4);
      stencil(c, 'ARQUIVO', 16, -22, 3.6, 'rgba(255,255,255,0.8)');
    }
  });
}

function drawDepot(c: C, x: number, y: number, time: number, g: Game) {
  const lvl = g.upgrades.r_depot || 0;
  const stage = lvl >= 5 ? 3 : lvl >= 3 ? 2 : lvl >= 1 ? 1 : 0;
  blit(c, depotBase(stage), x, y);
  // sign bulbs chasing
  for (let i = 0; i < 12; i++) {
    const bx = x + 48 + i * 4.2;
    lamp(c, bx, y - 31, '#fff3b0', (Math.floor(time * 6) + i) % 3 === 0, 0.55);
    lamp(c, bx, y - 17, '#fff3b0', (Math.floor(time * 6) + i) % 3 === 1, 0.55);
  }
  // lamp glow
  glow(c, x - 4, y + 28, 18, '#ffe9a8', 0.25 + Math.sin(time * 1.3) * 0.05);
  // flag
  const fx0 = x + 100, fy0 = y - 40;
  c.fillStyle = '#4a4a4a'; c.fillRect(fx0, fy0, 1.6, 52);
  c.fillStyle = '#e53935';
  c.beginPath(); c.moveTo(fx0 + 1.6, fy0);
  for (let i = 0; i <= 14; i += 2) c.lineTo(fx0 + 1.6 + i, fy0 + Math.sin(time * 5 + i * 0.5) * 1.6);
  for (let i = 14; i >= 0; i -= 2) c.lineTo(fx0 + 1.6 + i, fy0 + 8 + Math.sin(time * 5 + i * 0.5) * 1.6);
  c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.font = 'bold 5px system-ui'; c.fillText('♻', fx0 + 6, fy0 + 6 + Math.sin(time * 5 + 3) * 1.6);
}

// =====================================================================================================
// ANCIENT MACHINE
// =====================================================================================================
const ancientBase = () => cachedLayer('ancient', -10, -34, 52, 70, (c) => {
  groundShadow(c, 16, 27, 17, 7, 0.45);
  box34(c, 2, 6, 28, 8, 16, '#8a6b3a', 4);
  weather(c, 2, 6, 28, 24, 1, 8);
  for (let i = 0; i < 3; i++) { rrect(c, 7 + i * 7, -18, 5, 24, 2.5); c.fillStyle = 'rgba(180,255,190,0.18)'; c.fill(); c.strokeStyle = '#4a3a18'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = '#c9a227'; c.fillRect(6.5 + i * 7, -19, 6, 2); c.fillRect(6.5 + i * 7, 5, 6, 2); }
  pipe(c, [0, 20, -6, 20, -6, 28], 2, '#b08d4a');
  pipe(c, [32, 14, 37, 14, 37, 26], 2, '#b08d4a');
  gauge(c, 9, 22, 2.6, 2.3); gauge(c, 23, 22, 2.6, 0.2);
  rivetRow(c, 4, 15, 28, 15, 7, 0.6, '#d4b06a');
});

function drawAncient(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  blit(c, ancientBase(), x, y);
  for (let i = 0; i < 3; i++) {
    const lvl = (Math.sin(time * 3 + i * 2) + 1) / 2;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(74,222,128,${0.5 + lvl * 0.5})`; c.fillRect(x + 8 + i * 7, y + 4 - lvl * 18, 3, lvl * 18 + 1);
    c.restore();
  }
  glow(c, x + 16, y - 4, 22, '#4ade80', 0.2 + Math.sin(time * 2) * 0.08);
  c.save(); c.translate(x + 16, y + 11); c.rotate(time * (working ? 3 : 0.3));
  c.strokeStyle = '#ffe08a'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 3.4, 0, 6.28); c.stroke();
  for (let i = 0; i < 6; i++) { c.rotate(1.047); c.fillStyle = '#ffe08a'; c.fillRect(-0.5, 3.2, 1, 1.4); }
  c.restore();
  if (onScreen && working) {
    const tp = targetPos(m);
    if (tp && Math.random() < 0.5) fx.suck(tp[0] + (Math.random() - 0.5) * 24, tp[1] + (Math.random() - 0.5) * 24, x + 16, y - 6, 8, 0.6);
  }
}

export function drawRange(c: C, cx: number, cy: number, r: number, color: string, time: number) {
  c.save();
  c.fillStyle = shade(color, 0, 0.1);
  c.strokeStyle = shade(color, 0, 0.85);
  c.lineWidth = 1.5;
  c.setLineDash([7, 5]);
  c.lineDashOffset = -time * 20;
  c.beginPath(); c.arc(cx, cy, r, 0, 6.28); c.fill(); c.stroke();
  c.restore();
}

export { rivet };
