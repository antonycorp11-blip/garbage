import { DX, DY, TILE, WORLD_TILES } from '../core/constants';
import { MATERIALS } from '../data/materials';
import { MACHINES } from '../data/machines';
import { Game } from '../game/Game';
import { BOT_GO, BOT_RETURN, BOT_WORK, Bot, Machine, machineBufferCap } from '../game/Machines';
import { Effects } from './Effects';
import { ellipse, groundShadow, lin, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const statusColor = (m: Machine) => (m.status === 'working' ? '#4ade80' : m.status === 'full' ? '#f87171' : '#facc15');

function light(c: C, x: number, y: number, col: string, on: boolean, r = 1.6) {
  c.beginPath(); c.arc(x, y, r, 0, 6.28);
  c.fillStyle = on ? col : shade(col, -0.6); c.fill();
  if (on) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y, 0, r * 4, [[0, shade(col, 0, 0.6)], [1, shade(col, 0, 0)]]);
    c.beginPath(); c.arc(x, y, r * 4, 0, 6.28); c.fill();
    c.restore();
  }
}

function hazard(c: C, x: number, y: number, w: number, h: number) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#f5c518'; c.fillRect(x, y, w, h);
  c.fillStyle = '#1f1f1f';
  for (let i = -h; i < w; i += 6) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 3, y + h); c.lineTo(x + i + 3 + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
  c.restore();
}

function bufferBar(c: C, x: number, y: number, w: number, frac: number) {
  rrect(c, x, y, w, 3, 1.5); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill();
  if (frac > 0) { rrect(c, x + 0.5, y + 0.5, Math.max(1, (w - 1) * Math.min(1, frac)), 2, 1); c.fillStyle = frac >= 1 ? '#f87171' : frac > 0.75 ? '#fbbf24' : '#4ade80'; c.fill(); }
}

function statusBubble(c: C, m: Machine, x: number, y: number, time: number) {
  if (m.status === 'working') return;
  const bob = Math.sin(time * 3 + m.id) * 1.5;
  c.save();
  c.translate(x, y + bob);
  c.beginPath(); c.arc(0, 0, 5.5, 0, 6.28);
  c.fillStyle = m.status === 'full' ? '#ef4444' : 'rgba(30,30,30,0.75)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(m.status === 'full' ? '!' : 'z', 0, 0.5);
  c.restore();
}

function targetPos(m: Machine): [number, number] | null {
  if (m.lastTarget < 0) return null;
  return [((m.lastTarget % WORLD_TILES) + 0.5) * TILE, (Math.floor(m.lastTarget / WORLD_TILES) + 0.5) * TILE];
}

export function drawBelt(c: C, m: Machine, g: Game, time: number) {
  const x = m.tx * TILE, y = m.ty * TILE;
  c.save();
  c.translate(x + TILE / 2, y + TILE / 2);
  c.rotate((m.dir * Math.PI) / 2);
  const H = TILE / 2;
  // frame
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-H + 1, -H + 6, TILE, TILE - 8);
  c.fillStyle = lin(c, 0, -H + 3, 0, H - 3, [[0, '#71777d'], [0.5, '#9aa1a8'], [1, '#5a5f64']]);
  c.fillRect(-H, -H + 3, TILE, TILE - 6);
  // belt
  c.fillStyle = '#26282b'; c.fillRect(-H, -H + 6, TILE, TILE - 12);
  const speed = g.d.beltSpeed * TILE;
  const off = (time * speed) % 8;
  c.save();
  c.beginPath(); c.rect(-H, -H + 6, TILE, TILE - 12); c.clip();
  c.strokeStyle = '#3d4044'; c.lineWidth = 2;
  for (let i = -H - 8; i < H + 8; i += 8) { c.beginPath(); c.moveTo(i + off, -H + 6); c.lineTo(i + off, H - 6); c.stroke(); }
  c.fillStyle = m.linked ? 'rgba(250,204,21,0.7)' : 'rgba(248,113,113,0.6)';
  for (let i = -H - 16; i < H + 16; i += 16) {
    const px = i + ((time * speed) % 16);
    c.beginPath(); c.moveTo(px - 3, -4); c.lineTo(px + 2, 0); c.lineTo(px - 3, 4); c.lineTo(px - 1, 0); c.closePath(); c.fill();
  }
  c.restore();
  // rails
  c.fillStyle = '#c9ced3'; c.fillRect(-H, -H + 3, TILE, 1.4); c.fillRect(-H, H - 4.4, TILE, 1.4);
  c.fillStyle = '#41464b';
  for (const bx of [-H + 3, H - 3]) { c.fillRect(bx - 1, -H + 3, 2, 3); c.fillRect(bx - 1, H - 6, 2, 3); }
  if (m.type === 'separator') {
    // scanning hood
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-8, -H + 1, 18, TILE - 2);
    rrect(c, -9, -H - 1, 18, TILE - 2, 3);
    c.fillStyle = lin(c, 0, -H, 0, H, [[0, '#4ade80'], [1, '#166534']]); c.fill();
    c.strokeStyle = '#0b3d1c'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = '#0f172a'; c.fillRect(-6, -6, 12, 12);
    const sc = Math.sin(time * 5) * 5;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,60,60,0.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sc, -6); c.lineTo(sc, 6); c.stroke();
    c.restore();
    const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'];
    cols.forEach((col, i) => light(c, -7 + i * 3.5, -H + 1.5, col, Math.sin(time * 6 + i) > 0, 0.9));
  }
  c.restore();
  // packets
  for (const p of m.belt) {
    const t = p.t - 0.5;
    const px = x + TILE / 2 + DX[m.dir] * t * TILE, py = y + TILE / 2 + DY[m.dir] * t * TILE;
    const col = MATERIALS[p.mat].color;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(px - 4.5, py - 2.5, 10, 8);
    rrect(c, px - 5, py - 5, 10, 9, 2);
    c.fillStyle = lin(c, 0, py - 5, 0, py + 4, [[0, shade(col, 0.3)], [1, shade(col, -0.35)]]); c.fill();
    c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.6; c.stroke();
    c.fillStyle = 'rgba(60,40,20,0.6)'; c.fillRect(px - 0.6, py - 5, 1.2, 9);
    if (p.sorted) { c.fillStyle = '#22c55e'; c.beginPath(); c.arc(px + 3, py - 3, 1.8, 0, 6.28); c.fill(); }
  }
}

export function drawMachine(c: C, m: Machine, g: Game, time: number, fx: Effects, onScreen: boolean) {
  const def = MACHINES[m.type];
  const s = def.size * TILE;
  const x = m.tx * TILE, y = m.ty * TILE;
  const cx = x + s / 2, cy = y + s / 2;
  const working = m.status === 'working';
  const built = m.built;
  c.save();
  if (built < 1) {
    const k = 1 - Math.pow(1 - built, 3);
    c.translate(cx, y + s);
    c.scale(0.6 + k * 0.4, k);
    c.translate(-cx, -(y + s));
    c.globalAlpha = 0.4 + k * 0.6;
  }
  switch (m.type) {
    case 'depot': drawDepot(c, x, y, s, time, g); break;
    case 'collector': drawCollector(c, m, cx, cy, time, working, fx, onScreen); break;
    case 'arm': drawArm(c, m, cx, cy, time, working, fx, onScreen); break;
    case 'crusher': drawCrusher(c, m, x, y, s, time, working, fx, onScreen); break;
    case 'robots': drawStation(c, m, cx, cy, time); break;
    case 'excavator': drawGarage(c, m, x, y, s, time); break;
    case 'recycler': drawRecycler(c, x, y, s, time, fx, onScreen); break;
    case 'ancient': drawAncient(c, m, cx, cy, time, working, fx, onScreen); break;
    default: break;
  }
  c.restore();
  if (def.buffer > 0) {
    const cap = machineBufferCap(m, g.d);
    if (m.bufferTotal > 0 || m.status === 'full') bufferBar(c, x + 4, y + s - 1, s - 8, m.bufferTotal / cap);
  }
  if (m.type !== 'depot' && m.type !== 'recycler') statusBubble(c, m, x + s - 3, y - 6, time);
}

function drawDepot(c: C, x: number, y: number, s: number, time: number, g: Game) {
  // concrete pad
  groundShadow(c, x + s / 2 + 3, y + s - 4, s * 0.6, 14, 0.4);
  c.fillStyle = lin(c, x, y, x, y + s, [[0, '#a19d93'], [1, '#7f7b72']]);
  rrect(c, x - 4, y + 10, s + 8, s - 6, 4); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; c.stroke();
  // sorted bins in front
  const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'];
  cols.forEach((col, i) => {
    const bx = x + 4 + i * 18, by = y + s - 20;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(bx + 2, by + 14, 15, 4);
    rrect(c, bx, by, 15, 16, 2);
    c.fillStyle = lin(c, bx, 0, bx + 15, 0, [[0, shade(col, 0.15)], [1, shade(col, -0.35)]]); c.fill();
    c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.8; c.stroke();
    c.fillStyle = shade(col, -0.5); c.fillRect(bx + 1, by + 1, 13, 3);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.font = 'bold 6px system-ui'; c.textAlign = 'center'; c.fillText('♻', bx + 7.5, by + 12);
  });
  // shed: posts and corrugated roof
  c.fillStyle = '#5d4630';
  for (const px of [x + 4, x + s - 7]) c.fillRect(px, y + 14, 3, s - 34);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 2, y + 24, s + 4, 10);
  const ry = y - 6;
  c.fillStyle = lin(c, x, ry, x, ry + 32, [[0, '#b9c2c8'], [1, '#6c7880']]);
  c.beginPath(); c.moveTo(x - 6, ry + 32); c.lineTo(x + 2, ry); c.lineTo(x + s - 2, ry); c.lineTo(x + s + 6, ry + 32); c.closePath(); c.fill();
  c.save(); c.clip();
  for (let i = x - 6; i < x + s + 6; i += 5) {
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(i, ry, 1.6, 34);
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(i + 2.5, ry, 1.2, 34);
  }
  c.fillStyle = 'rgba(150,70,20,0.35)'; ellipse(c, x + 22, ry + 20, 10, 5); c.fill(); ellipse(c, x + 70, ry + 8, 7, 3); c.fill();
  c.restore();
  c.strokeStyle = '#3f474c'; c.lineWidth = 1; c.stroke();
  // sign
  rrect(c, x + s / 2 - 26, ry + 8, 52, 14, 2);
  c.fillStyle = lin(c, 0, ry + 8, 0, ry + 22, [[0, '#f3d27a'], [1, '#c9932e']]); c.fill();
  c.strokeStyle = '#5a3d10'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#3b2306'; c.font = '900 8px "Trebuchet MS", system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('DEPÓSITO', x + s / 2, ry + 15.5);
  // flag
  const fx0 = x + s + 2, fy0 = ry - 18;
  c.fillStyle = '#444'; c.fillRect(fx0, fy0, 1.6, 30);
  c.fillStyle = '#e53935';
  c.beginPath(); c.moveTo(fx0 + 1.6, fy0);
  for (let i = 0; i <= 12; i += 2) c.lineTo(fx0 + 1.6 + i, fy0 + Math.sin(time * 5 + i * 0.5) * 1.5);
  for (let i = 12; i >= 0; i -= 2) c.lineTo(fx0 + 1.6 + i, fy0 + 7 + Math.sin(time * 5 + i * 0.5) * 1.5);
  c.closePath(); c.fill();
  void g;
}

function drawCollector(c: C, m: Machine, cx: number, cy: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  groundShadow(c, cx + 2, cy + 10, 15, 6);
  const lv = m.level;
  const body = lv >= 4 ? '#2b7a78' : lv >= 2 ? '#3a6ea5' : '#5b8c3a';
  // legs
  c.fillStyle = '#3d4246';
  for (const [lx, ly] of [[-11, 8], [11, 8], [-9, -3], [9, -3]]) { c.fillRect(cx + lx - 1.5, cy + ly - 2, 3, 6); }
  // body cylinder 3/4
  rrect(c, cx - 12, cy - 6, 24, 16, 5);
  c.fillStyle = lin(c, cx - 12, 0, cx + 12, 0, [[0, shade(body, 0.2)], [0.5, body], [1, shade(body, -0.45)]]); c.fill();
  c.strokeStyle = shade(body, -0.65); c.lineWidth = 0.8; c.stroke();
  hazard(c, cx - 12, cy + 5, 24, 3);
  // top intake
  ellipse(c, cx, cy - 6, 12, 6.5);
  c.fillStyle = lin(c, 0, cy - 12, 0, cy, [[0, shade(body, 0.35)], [1, shade(body, -0.1)]]); c.fill(); c.stroke();
  ellipse(c, cx, cy - 6, 8.5, 4.6); c.fillStyle = '#1a1c1e'; c.fill();
  // spinning fan
  c.save(); c.translate(cx, cy - 6); c.scale(1, 0.54); c.rotate(working ? time * 18 : time * 0.5);
  c.fillStyle = '#9aa3a9';
  for (let i = 0; i < 5; i++) { c.rotate(1.2566); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(5, -2, 7.5, 1.5); c.lineTo(1.5, 1.5); c.closePath(); c.fill(); }
  c.fillStyle = '#ddd'; c.beginPath(); c.arc(0, 0, 1.6, 0, 6.28); c.fill();
  c.restore();
  light(c, cx + 8, cy + 1, statusColor(m), Math.sin(time * 4) > -0.3 || !working, 1.4);
  // antenna
  c.strokeStyle = '#444'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(cx - 9, cy - 4); c.lineTo(cx - 11, cy - 16); c.stroke();
  light(c, cx - 11, cy - 16, '#f87171', Math.sin(time * 2 + m.id) > 0, 1);
  if (working && onScreen) {
    const tp = targetPos(m);
    if (tp && Math.random() < 0.5) fx.suck(tp[0] + (Math.random() - 0.5) * 22, tp[1] + (Math.random() - 0.5) * 22, cx, cy - 6, Math.floor(Math.random() * 3), 0.5);
  }
}

function drawArm(c: C, m: Machine, cx: number, cy: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  groundShadow(c, cx + 2, cy + 9, 14, 6);
  // base
  rrect(c, cx - 12, cy - 2, 24, 13, 3);
  c.fillStyle = lin(c, 0, cy - 2, 0, cy + 11, [[0, '#ffb74d'], [1, '#c26a00']]); c.fill();
  c.strokeStyle = '#5a3000'; c.lineWidth = 0.8; c.stroke();
  hazard(c, cx - 12, cy + 8, 24, 3);
  // turret
  ellipse(c, cx, cy - 1, 9, 5); c.fillStyle = lin(c, 0, cy - 6, 0, cy + 4, [[0, '#8d969c'], [1, '#4a5257']]); c.fill(); c.strokeStyle = '#2a2f33'; c.stroke();
  // arm towards the target
  const tp = targetPos(m);
  let ang = Math.sin(time * 0.6 + m.id) * 1.2 - 1.2;
  let reach = 18;
  if (tp) { ang = Math.atan2(tp[1] - cy, tp[0] - cx); reach = Math.min(48, Math.hypot(tp[0] - cx, tp[1] - cy)); }
  const pump = working ? (Math.sin(time * 9) + 1) / 2 : 0.2;
  const L1 = 16, L2 = Math.max(8, reach - L1 * 0.7) * (0.8 + pump * 0.2);
  const jx = cx + Math.cos(ang - 0.5) * L1, jy = cy - 4 + Math.sin(ang - 0.5) * L1 - 8;
  const ex = jx + Math.cos(ang + 0.3) * L2, ey = jy + Math.sin(ang + 0.3) * L2 + 6;
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx + 3, cy + 4); c.lineTo(jx + 3, jy + 10); c.lineTo(ex + 3, ey + 6); c.stroke();
  c.strokeStyle = '#e8a33a'; c.lineWidth = 4.5; c.beginPath(); c.moveTo(cx, cy - 3); c.lineTo(jx, jy); c.stroke();
  c.strokeStyle = '#f2b84f'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(jx, jy); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx + 2, cy - 4); c.lineTo((cx + jx) / 2 + 2, (cy + jy) / 2 - 2); c.stroke();
  c.fillStyle = '#37474f'; c.beginPath(); c.arc(jx, jy, 2.6, 0, 6.28); c.fill();
  // claw
  const open = working ? 0.3 + pump * 0.6 : 0.5;
  c.save(); c.translate(ex, ey); c.rotate(ang + 0.3);
  c.strokeStyle = '#455a64'; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(5, -3 - open * 3); c.lineTo(8, -1); c.moveTo(0, 0); c.lineTo(5, 3 + open * 3); c.lineTo(8, 1); c.stroke();
  c.restore();
  light(c, cx + 9, cy + 3, statusColor(m), true, 1.3);
  if (working && onScreen && tp && Math.random() < 0.08) fx.burst(tp[0], tp[1], 'dust', 1);
}

function drawCrusher(c: C, m: Machine, x: number, y: number, s: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  const shake = working ? Math.sin(time * 50) * 0.6 : 0;
  groundShadow(c, x + s / 2 + 3, y + s - 4, s * 0.55, 12, 0.45);
  c.save(); c.translate(shake, 0);
  // main body
  rrect(c, x + 2, y + 14, s - 4, s - 18, 4);
  c.fillStyle = lin(c, x, 0, x + s, 0, [[0, '#fbbf24'], [0.5, '#f59e0b'], [1, '#b45309']]); c.fill();
  c.strokeStyle = '#5b3204'; c.lineWidth = 1; c.stroke();
  hazard(c, x + 2, y + s - 10, s - 4, 5);
  // hopper top (3/4)
  c.beginPath(); c.moveTo(x - 2, y + 2); c.lineTo(x + s + 2, y + 2); c.lineTo(x + s - 6, y + 18); c.lineTo(x + 6, y + 18); c.closePath();
  c.fillStyle = lin(c, 0, y, 0, y + 18, [[0, '#9ca3af'], [1, '#4b5563']]); c.fill(); c.strokeStyle = '#1f2937'; c.stroke();
  // rollers
  c.fillStyle = '#111827'; c.fillRect(x + 8, y + 6, s - 16, 9);
  for (let r = 0; r < 2; r++) {
    const ry = y + 8.5 + r * 4;
    const rot = (working ? time * 8 : 0) * (r ? -1 : 1);
    c.fillStyle = '#6b7280'; c.fillRect(x + 9, ry - 1.8, s - 18, 3.6);
    c.fillStyle = '#d1d5db';
    for (let i = 0; i < 9; i++) { const tx = x + 10 + ((i * 5.5 + rot * 6) % (s - 20)); c.fillRect(tx, ry - 2.3, 1.5, 4.6); }
  }
  // chimney & lights
  c.fillStyle = '#374151'; c.fillRect(x + s - 14, y - 8, 7, 16);
  c.fillStyle = '#1f2937'; ellipse(c, x + s - 10.5, y - 8, 3.5, 1.6); c.fill();
  light(c, x + 10, y + 24, statusColor(m), true, 2);
  light(c, x + 18, y + 24, '#f87171', working && Math.sin(time * 10) > 0, 1.5);
  c.fillStyle = '#3b2306'; c.font = '900 6px system-ui'; c.textAlign = 'center'; c.fillText('TRITURA-TUDO', x + s / 2 + 6, y + 34);
  c.restore();
  if (working && onScreen) {
    if (Math.random() < 0.15) fx.smoke(x + s - 10.5, y - 10);
    if (Math.random() < 0.3) fx.burst(x + s / 2 + (Math.random() - 0.5) * 30, y + 10, 'spark', 1);
    const tp = targetPos(m);
    if (tp && Math.random() < 0.6) fx.suck(tp[0] + (Math.random() - 0.5) * 24, tp[1] + (Math.random() - 0.5) * 24, x + s / 2, y + 10, Math.floor(Math.random() * 3), 0.6);
  }
}

function drawStation(c: C, m: Machine, cx: number, cy: number, time: number) {
  groundShadow(c, cx + 2, cy + 8, 15, 6);
  ellipse(c, cx, cy + 2, 14, 9);
  c.fillStyle = lin(c, 0, cy - 7, 0, cy + 11, [[0, '#94a3b8'], [1, '#475569']]); c.fill();
  c.strokeStyle = '#1e293b'; c.lineWidth = 1; c.stroke();
  ellipse(c, cx, cy + 1, 10, 6.4); c.fillStyle = '#1e293b'; c.fill();
  c.strokeStyle = '#facc15'; c.lineWidth = 1.2; ellipse(c, cx, cy + 1, 7.5, 4.6); c.stroke();
  c.fillStyle = '#facc15'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('R', cx, cy + 1.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + time;
    light(c, cx + Math.cos(a) * 12, cy + 2 + Math.sin(a) * 7.6, '#38bdf8', Math.sin(time * 4 + i) > 0, 0.9);
  }
  c.strokeStyle = '#334155'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx + 11, cy); c.lineTo(cx + 11, cy - 16); c.stroke();
  light(c, cx + 11, cy - 17, statusColor(m), true, 1.3);
}

export function drawBots(c: C, m: Machine, time: number, fx: Effects, onScreen: boolean) {
  for (const b of m.bots) {
    if (m.type === 'excavator') drawExcavatorVehicle(c, b, m, time, fx, onScreen);
    else drawBot(c, b, time, fx, onScreen);
  }
}

function drawBot(c: C, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const hover = Math.sin(time * 5 + b.anim * 3) * 1.5;
  groundShadow(c, x, y + 4, 6, 2.5, 0.35);
  const by = y - 10 + hover;
  // propeller blur
  c.fillStyle = 'rgba(220,230,240,0.35)';
  ellipse(c, x, by - 6, 8, 1.6 + Math.abs(Math.sin(time * 50)) * 0.8); c.fill();
  c.strokeStyle = '#475569'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, by - 6); c.lineTo(x, by - 3); c.stroke();
  // body
  c.beginPath(); c.arc(x, by, 5, 0, 6.28);
  c.fillStyle = rad(c, x - 1.5, by - 1.5, 0, 6, [[0, '#e2e8f0'], [1, '#64748b']]); c.fill();
  c.strokeStyle = '#334155'; c.lineWidth = 0.7; c.stroke();
  // basket fill
  const fill = Math.min(1, b.carryTotal / 30);
  c.fillStyle = '#1e293b'; c.fillRect(x - 3.5, by + 3, 7, 3);
  if (fill > 0) { c.fillStyle = '#a3e635'; c.fillRect(x - 3.5, by + 6 - 3 * fill, 7 * 1, 3 * fill); }
  // eye
  const dx = Math.cos(b.angle) * 1.6, dy = Math.sin(b.angle) * 1;
  light(c, x + dx, by - 0.5 + dy, b.state === BOT_WORK ? '#f97316' : '#38bdf8', true, 1.3);
  if (b.state === BOT_WORK && onScreen) {
    if (Math.random() < 0.3) fx.suck(x + (Math.random() - 0.5) * 22, y + 6 + (Math.random() - 0.5) * 14, x, by + 4, Math.floor(Math.random() * 3), 0.35);
    // tractor beam
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(c, 0, by + 4, 0, y + 4, [[0, 'rgba(56,189,248,0.4)'], [1, 'rgba(56,189,248,0)']]);
    c.beginPath(); c.moveTo(x - 2, by + 5); c.lineTo(x + 2, by + 5); c.lineTo(x + 7, y + 6); c.lineTo(x - 7, y + 6); c.closePath(); c.fill();
    c.restore();
  }
}

function drawGarage(c: C, m: Machine, x: number, y: number, s: number, time: number) {
  groundShadow(c, x + s / 2 + 3, y + s - 4, s * 0.55, 12, 0.4);
  // floor pad
  c.fillStyle = '#6b6b66'; c.fillRect(x, y + 8, s, s - 8);
  // building
  c.fillStyle = lin(c, 0, y - 4, 0, y + s - 12, [[0, '#94a3b8'], [1, '#64748b']]);
  c.fillRect(x + 2, y - 4, s - 4, s - 18);
  c.fillStyle = lin(c, 0, y - 10, 0, y - 2, [[0, '#cbd5e1'], [1, '#94a3b8']]);
  c.beginPath(); c.moveTo(x - 2, y - 2); c.lineTo(x + 4, y - 12); c.lineTo(x + s - 4, y - 12); c.lineTo(x + s + 2, y - 2); c.closePath(); c.fill();
  c.strokeStyle = '#334155'; c.lineWidth = 1; c.stroke();
  // door
  const open = m.bots[0] && Math.hypot(m.bots[0].x - (m.tx + 1), m.bots[0].y - (m.ty + 1)) > 0.5 ? 1 : 0.3;
  c.fillStyle = '#1e293b'; c.fillRect(x + 10, y + 6, s - 20, s - 30);
  c.fillStyle = lin(c, 0, y + 6, 0, y + 6 + (s - 30) * (1 - open), [[0, '#e2e8f0'], [1, '#94a3b8']]);
  c.fillRect(x + 10, y + 6, s - 20, (s - 30) * (1 - open * 0.8));
  hazard(c, x + 2, y + s - 16, s - 4, 4);
  c.fillStyle = '#0f172a'; c.font = '900 6px system-ui'; c.textAlign = 'center'; c.fillText('ESCAVADEIRA', x + s / 2, y + 2);
  light(c, x + 6, y + 4, statusColor(m), true, 1.6);
  light(c, x + s - 6, y + 4, '#f59e0b', Math.sin(time * 6) > 0, 1.6);
}

function drawExcavatorVehicle(c: C, b: Bot, m: Machine, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const working = b.state === BOT_WORK;
  const moving = b.state === BOT_GO || b.state === BOT_RETURN;
  const ang = b.angle;
  groundShadow(c, x + 2, y + 6, 22, 11, 0.45);
  c.save();
  c.translate(x, y);
  // tracks (rotate with heading)
  c.save(); c.rotate(ang);
  for (const ty of [-11, 7]) {
    rrect(c, -15, ty, 30, 6, 3); c.fillStyle = '#1f2937'; c.fill();
    c.fillStyle = '#4b5563';
    const off = moving ? (time * 30) % 5 : 0;
    for (let i = -14; i < 14; i += 5) c.fillRect(i + off, ty + 0.5, 2, 5);
  }
  c.restore();
  // cab body rotates towards work
  const bodyAng = working ? ang + Math.sin(time * 2) * 0.4 : ang;
  c.save(); c.rotate(bodyAng);
  rrect(c, -12, -9, 22, 18, 4);
  c.fillStyle = lin(c, 0, -9, 0, 9, [[0, '#fde047'], [1, '#ca8a04']]); c.fill(); c.strokeStyle = '#713f12'; c.lineWidth = 1; c.stroke();
  rrect(c, -10, -8, 9, 11, 2); c.fillStyle = lin(c, -10, -8, 0, 3, [[0, '#bae6fd'], [1, '#0c4a6e']]); c.fill(); c.strokeStyle = '#1e293b'; c.stroke();
  c.fillStyle = '#44403c'; c.fillRect(-12, 3, 6, 5);
  // boom + bucket
  const dig = working ? (Math.sin(time * 5) + 1) / 2 : 0.3;
  const L = 16 + dig * 8;
  c.strokeStyle = '#eab308'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(6, 0); c.lineTo(6 + L, 0); c.stroke();
  c.strokeStyle = '#a16207'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, -2); c.lineTo(6 + L * 0.7, -2); c.stroke();
  c.save(); c.translate(6 + L, 0); c.rotate(dig * 1.2 - 0.4);
  c.beginPath(); c.moveTo(0, -6); c.lineTo(7, -5); c.lineTo(8, 5); c.lineTo(0, 6); c.closePath();
  c.fillStyle = lin(c, 0, -6, 8, 6, [[0, '#9ca3af'], [1, '#374151']]); c.fill(); c.strokeStyle = '#111827'; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#e5e7eb'; for (let i = -5; i <= 4; i += 3) c.fillRect(8, i, 2, 1.4);
  if (b.carryTotal > 0) { c.fillStyle = '#8b6b4a'; ellipse(c, 3.5, 0, 3, 4); c.fill(); }
  c.restore();
  light(c, -2, -10, '#f59e0b', Math.sin(time * 8) > 0, 1.3);
  c.restore();
  c.restore();
  if (onScreen && working) {
    const hx = x + Math.cos(bodyAng) * (6 + L), hy = y + Math.sin(bodyAng) * (6 + L);
    if (Math.random() < 0.5) fx.burst(hx, hy, 'dust', 1);
    if (Math.random() < 0.1) fx.shake(0.15);
  }
  if (onScreen && moving && Math.random() < 0.15) fx.burst(x - Math.cos(ang) * 14, y - Math.sin(ang) * 14 + 6, 'dust', 1);
  void m;
}

function drawRecycler(c: C, x: number, y: number, s: number, time: number, fx: Effects, onScreen: boolean) {
  groundShadow(c, x + s / 2 + 4, y + s - 6, s * 0.6, 16, 0.45);
  c.fillStyle = '#7d8a7a'; c.fillRect(x - 2, y + 18, s + 4, s - 18);
  // walls
  c.fillStyle = lin(c, x, 0, x + s, 0, [[0, '#d1fae5'], [0.6, '#a7f3d0'], [1, '#6ee7b7']]);
  c.fillRect(x + 4, y + 10, s - 8, s - 24);
  c.strokeStyle = '#065f46'; c.lineWidth = 1.2; c.strokeRect(x + 4, y + 10, s - 8, s - 24);
  // roof
  c.fillStyle = lin(c, 0, y - 8, 0, y + 12, [[0, '#34d399'], [1, '#047857']]);
  c.beginPath(); c.moveTo(x, y + 12); c.lineTo(x + 8, y - 8); c.lineTo(x + s - 8, y - 8); c.lineTo(x + s, y + 12); c.closePath(); c.fill(); c.stroke();
  // windows
  for (let i = 0; i < 4; i++) {
    const wx = x + 12 + i * 19, wy = y + 22;
    c.fillStyle = Math.sin(time * 0.7 + i) > -0.5 ? '#fef08a' : '#94a3b8'; c.fillRect(wx, wy, 12, 9);
    c.strokeStyle = '#065f46'; c.lineWidth = 0.8; c.strokeRect(wx, wy, 12, 9);
  }
  // recycle logo
  c.save(); c.translate(x + s / 2, y + 52); c.rotate(time * 0.6);
  c.strokeStyle = '#047857'; c.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) { c.rotate(2.094); c.beginPath(); c.arc(0, 0, 8, 0.2, 1.6); c.stroke(); c.fillStyle = '#047857'; c.beginPath(); c.moveTo(8 * Math.cos(1.6) - 3, 8 * Math.sin(1.6)); c.lineTo(8 * Math.cos(1.6) + 3, 8 * Math.sin(1.6) - 1); c.lineTo(8 * Math.cos(1.6), 8 * Math.sin(1.6) + 3); c.fill(); }
  c.restore();
  // big door
  c.fillStyle = '#064e3b'; c.fillRect(x + s / 2 - 12, y + s - 30, 24, 16);
  hazard(c, x + s / 2 - 12, y + s - 16, 24, 3);
  // chimneys
  for (const chx of [x + 14, x + s - 22]) {
    c.fillStyle = lin(c, chx, 0, chx + 8, 0, [[0, '#cbd5e1'], [1, '#64748b']]); c.fillRect(chx, y - 26, 8, 22);
    c.fillStyle = '#ef4444'; c.fillRect(chx, y - 22, 8, 2.5);
    if (onScreen && Math.random() < 0.12) fx.smoke(chx + 4, y - 28);
  }
  c.fillStyle = '#064e3b'; c.font = '900 7px system-ui'; c.textAlign = 'center'; c.fillText('CENTRAL DE RECICLAGEM', x + s / 2, y + 6);
}

function drawAncient(c: C, m: Machine, cx: number, cy: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  groundShadow(c, cx + 2, cy + 9, 15, 6);
  rrect(c, cx - 12, cy - 8, 24, 18, 6);
  c.fillStyle = lin(c, cx - 12, 0, cx + 12, 0, [[0, '#a78b5a'], [0.5, '#7c6a45'], [1, '#4a3e28']]); c.fill();
  c.strokeStyle = '#2d2414'; c.lineWidth = 1; c.stroke();
  for (let i = 0; i < 3; i++) {
    const tx = cx - 7 + i * 7;
    rrect(c, tx - 2, cy - 16, 4, 12, 2);
    c.fillStyle = 'rgba(180,255,180,0.25)'; c.fill(); c.strokeStyle = '#3f3a26'; c.stroke();
    const lvl = (Math.sin(time * 3 + i * 2) + 1) / 2;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(74,222,128,${0.5 + lvl * 0.5})`; c.fillRect(tx - 1.4, cy - 6 - lvl * 9, 2.8, lvl * 9 + 1);
    c.restore();
  }
  c.save(); c.translate(cx, cy + 3); c.rotate(time * (working ? 3 : 0.3));
  c.strokeStyle = '#d4b06a'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 4.5, 0, 6.28); c.stroke();
  c.beginPath(); c.moveTo(0, 0); c.lineTo(4, 0); c.stroke();
  c.restore();
  if (onScreen && working) {
    const tp = targetPos(m);
    if (tp && Math.random() < 0.5) fx.suck(tp[0] + (Math.random() - 0.5) * 24, tp[1] + (Math.random() - 0.5) * 24, cx, cy - 10, 8, 0.6);
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
