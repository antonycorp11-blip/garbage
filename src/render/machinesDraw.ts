import { DX, DY, TILE, WORLD_TILES } from '../core/constants';
import { MATERIALS, MAT_COUNT } from '../data/materials';
import { MACHINES } from '../data/machines';
import { Game } from '../game/Game';
import { BOT_GO, BOT_RETURN, BOT_WORK, Bot, Machine, machineBufferCap } from '../game/Machines';
import {
  INK, INK_W, SCI, blit, bolt, box34, cable, cachedLayer, cylinder34, energyLine, gem, glass, glow, hazardStripes, lamp,
  levelPips, pipe, rivet, rivetRow, shell, stencil, vent,
} from './detail';
import { Effects } from './Effects';
import { drawMatIcon } from './matIcons';
import { ellipse, groundShadow, lin, poly, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const matCol = (i: number) => MATERIALS[Math.max(0, Math.min(MAT_COUNT - 1, i))].color;
const statusColor = (m: Machine) => (m.status === 'working' ? '#4ade80' : m.status === 'full' ? '#f87171' : '#facc15');
const CHUNK_COLS = ['#93c5fd', '#f472b6', '#fb923c', '#86efac'];

function bufferBar(c: C, x: number, y: number, w: number, frac: number) {
  rrect(c, x - 0.6, y - 0.6, w + 1.2, 4.6, 2.3); c.fillStyle = INK; c.fill();
  rrect(c, x, y, w, 3.4, 1.7); c.fillStyle = '#2b2440'; c.fill();
  if (frac > 0) {
    rrect(c, x + 0.5, y + 0.5, Math.max(1.4, (w - 1) * Math.min(1, frac)), 2.4, 1.2);
    c.fillStyle = frac >= 1 ? '#f87171' : frac > 0.75 ? '#fbbf24' : SCI.cyan; c.fill();
  }
}

/** Floating status badge: ! full, z idle, broken link when it can't deliver anywhere. */
function statusBubble(c: C, m: Machine, x: number, y: number, time: number) {
  const def = MACHINES[m.type];
  const stranded = def.buffer > 0 && m.type !== 'robots' && !m.inService && !m.linked;
  if (m.status === 'working' && !stranded) return;
  const bob = Math.sin(time * 3 + m.id) * 1.5;
  c.save();
  c.translate(x, y + bob);
  const col = m.status === 'full' ? '#ef4444' : stranded ? '#f59e0b' : '#6b6488';
  c.beginPath(); c.moveTo(-1.6, 5.2); c.lineTo(0, 8); c.lineTo(1.6, 5.2); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  c.beginPath(); c.arc(0, 0, 5.8, 0, 6.28); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-1.8, -2.4, 2, 1.1, -0.5, 0, 6.28); c.fill();
  c.fillStyle = '#fff'; c.strokeStyle = '#fff';
  if (m.status === 'full') { c.font = '900 8px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 0.6); }
  else if (stranded) {
    // broken chain link
    c.lineWidth = 1.2; c.lineCap = 'round';
    c.beginPath(); c.arc(-1.8, 0.8, 1.6, 1.2, 4.6); c.stroke();
    c.beginPath(); c.arc(1.8, -0.8, 1.6, 4.3, 1.6 + 6.28); c.stroke();
  } else { c.font = '900 7px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', 0.3, 0.4); }
  c.restore();
}

function targetPos(m: Machine): [number, number] | null {
  if (m.lastTarget < 0) return null;
  return [((m.lastTarget % WORLD_TILES) + 0.5) * TILE, (Math.floor(m.lastTarget / WORLD_TILES) + 0.5) * TILE];
}

/** Hex foot plate shared by small machines (violet with teal trim). */
function hexFoot(c: C, cx: number, cy: number, r: number) {
  const hex = (rr: number, oy: number) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.PI / 6; c.lineTo(cx + Math.cos(a) * rr, cy + oy + Math.sin(a) * rr * 0.52); } c.closePath(); };
  hex(r, 3.2); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  hex(r, 0); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  hex(r * 0.78, 0); c.strokeStyle = SCI.teal; c.lineWidth = 1; c.stroke();
}

// =====================================================================================================
// CONVEYORS — energy rails with glowing chevrons
// =====================================================================================================
const beltFrame = () => cachedLayer('belt3-frame', -16, -16, 34, 34, (c) => {
  const H = 16;
  c.fillStyle = 'rgba(20,10,30,0.3)'; c.fillRect(-H + 1.5, -H + 8, 32, 21);
  rrect(c, -H, -H + 6, 32, 20, 2); c.fillStyle = '#231d36'; c.fill();
  c.fillStyle = '#2d2645'; c.fillRect(-H, -H + 8, 32, 16);
  // cream side rails with teal stripe
  for (const ry of [-H + 2, H - 7]) {
    rrect(c, -H, ry, 32, 5, 2.2); c.fillStyle = SCI.shell; c.fill();
    c.fillStyle = shade(SCI.shell, -0.18); c.fillRect(-H, ry + 3, 32, 2);
    c.fillStyle = SCI.teal; c.fillRect(-H, ry + 1.6, 32, 1.2);
    rrect(c, -H, ry, 32, 5, 2.2); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  }
  for (let i = -H + 4; i < H; i += 8) { c.fillStyle = SCI.violet; c.beginPath(); c.arc(i, -H + 4.5, 0.8, 0, 6.28); c.arc(i, H - 4.5, 0.8, 0, 6.28); c.fill(); }
});

const sepGate = () => cachedLayer('sep3-gate', -18, -30, 36, 48, (c) => {
  groundShadow(c, 0, 12, 15, 4, 0.3);
  for (const px of [-14, 9]) {
    shell(c, px, -14, 5, 26, SCI.shell, 2.2);
    rrect(c, px + 0.8, 6, 3.4, 5, 1); c.fillStyle = SCI.violet; c.fill();
  }
  shell(c, -16, -22, 32, 10, SCI.teal, 4);
  glass(c, -6, -20, 12, 5, '#0f2a3a', 2.2);
  rivetRow(c, -13, -12.8, 13, -12.8, 6, 0.5, SCI.shell);
  rrect(c, -14, -27, 28, 4.6, 2.3); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
});

/** Curved belt bed: quarter ring around the corner (H, H), fed from local +y, leaving toward +x. */
const beltCurve = () => cachedLayer('belt3-curve', -16, -16, 34, 34, (c) => {
  const H = 16;
  const ring = (r0: number, r1: number) => { c.beginPath(); c.arc(H, H, r1, Math.PI, Math.PI * 1.5); c.arc(H, H, r0, Math.PI * 1.5, Math.PI, true); c.closePath(); };
  // shadow + bed
  c.save(); c.translate(1.5, 2); ring(H - 9, H + 9); c.fillStyle = 'rgba(20,10,30,0.3)'; c.fill(); c.restore();
  ring(H - 10, H + 10); c.fillStyle = '#231d36'; c.fill();
  ring(H - 8, H + 8); c.fillStyle = '#2d2645'; c.fill();
  // cream rails with teal stripe (inner and outer)
  for (const [r0, r1] of [[H - 14, H - 9], [H + 9, H + 14]]) {
    ring(r0, r1); c.fillStyle = SCI.shell; c.fill();
    ring(r0, r0 + 2); c.fillStyle = shade(SCI.shell, -0.18); c.fill();
    ring(r0 + 2.6, r0 + 3.8); c.fillStyle = SCI.teal; c.fill();
    ring(r0, r1); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  }
  // studs along both rails
  c.fillStyle = SCI.violet;
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI + (i / 4) * Math.PI / 2;
    for (const r of [H - 11.5, H + 11.5]) { c.beginPath(); c.arc(H + Math.cos(a) * r, H + Math.sin(a) * r, 0.8, 0, 6.28); c.fill(); }
  }
});

/** Merge ramp drawn on the +y rail of a straight belt when something feeds it from that side. */
const beltRamp = () => cachedLayer('belt3-ramp', -10, 0, 20, 17, (c) => {
  const H = 16;
  // opening in the rail: a short ramp tongue sliding into the bed
  poly(c, [-7, H, 7, H, 5.5, H - 9, -5.5, H - 9]); c.fillStyle = '#2d2645'; c.fill();
  poly(c, [-7, H, 7, H, 5.5, H - 9, -5.5, H - 9]); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  for (const sx of [-1, 1]) { rrect(c, sx * 7 - 1.6, H - 9, 3.2, 9, 1.4); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke(); }
});

/** World direction (0..3) from which this belt receives items, as local sides relative to its own dir. */
function beltFeeds(m: Machine, g: Game): number {
  // bit 1: local +y side, bit 2: behind, bit 3: local -y side
  let mask = 0;
  const ms = g.machines;
  for (let s = 0; s < 4; s++) {
    if (s === m.dir) continue;
    const nx = m.tx + DX[s], ny = m.ty + DY[s];
    const n = ms.at(nx, ny);
    if (!n || n.id === m.id) continue;
    let feeds = false;
    if (n.type === 'conveyor' || n.type === 'separator') feeds = nx + DX[n.dir] === m.tx && ny + DY[n.dir] === m.ty;
    else feeds = n.outConveyor === m.id;
    if (feeds) mask |= 1 << ((s - m.dir + 4) % 4);
  }
  return mask;
}

/** Where a packet at progress t sits on this belt (world px) and which way it faces (radians). */
function beltPoint(m: Machine, curve: number, t: number): [number, number, number] {
  const H = TILE / 2;
  let lx: number, ly: number, la: number;
  if (curve) {
    // quarter circle around (H, H*curve): from the side edge (0, H*curve) to the front edge (H, 0)
    const a = Math.PI + t * Math.PI / 2;
    lx = H + Math.cos(a) * H; ly = H + Math.sin(a) * H;
    la = a + Math.PI / 2;
    if (curve < 0) { ly = -ly; la = -la; }
  } else { lx = (t - 0.5) * TILE; ly = 0; la = 0; }
  const ang = (m.dir * Math.PI) / 2, co = Math.cos(ang), si = Math.sin(ang);
  return [m.tx * TILE + H + lx * co - ly * si, m.ty * TILE + H + lx * si + ly * co, la + ang];
}

function chevron(c: C, col: string) {
  c.fillStyle = shade(col, 0, 0.28);
  c.beginPath(); c.moveTo(-5, -6); c.lineTo(3, 0); c.lineTo(-5, 6); c.lineTo(-2, 0); c.closePath(); c.fill();
  c.fillStyle = shade(col, 0.3, 0.9);
  c.beginPath(); c.moveTo(-3.5, -4); c.lineTo(1.5, 0); c.lineTo(-3.5, 4); c.lineTo(-1.5, 0); c.closePath(); c.fill();
}

export function drawBelt(c: C, m: Machine, g: Game, time: number) {
  const x = m.tx * TILE, y = m.ty * TILE;
  const cx = x + TILE / 2, cy = y + TILE / 2;
  const H = TILE / 2;
  const feeds = m.type === 'conveyor' ? beltFeeds(m, g) : 0;
  const side = feeds & 0b1010;
  // a single side feed (nothing from behind) bends the belt into a curve
  const curve = !(feeds & 0b100) && (side === 0b10 ? 1 : side === 0b1000 ? -1 : 0);
  const col = m.linked ? SCI.cyan : '#ff6b6b';
  const speed = g.d.beltSpeed * TILE;
  c.save();
  c.translate(cx, cy);
  c.rotate((m.dir * Math.PI) / 2);
  if (curve) {
    if (curve < 0) c.scale(1, -1);
    blit(c, beltCurve(), 0, 0);
    // chevrons follow the arc
    c.save();
    c.beginPath(); c.arc(H, H, H + 8, Math.PI, Math.PI * 1.5); c.arc(H, H, H - 8, Math.PI * 1.5, Math.PI, true); c.closePath(); c.clip();
    c.globalCompositeOperation = 'lighter';
    const arcLen = (Math.PI / 2) * H;
    const ph = (time * speed) % 12;
    for (let s0 = -12; s0 < arcLen + 12; s0 += 12) {
      const a = Math.PI + ((s0 + ph) / arcLen) * (Math.PI / 2);
      c.save(); c.translate(H + Math.cos(a) * H, H + Math.sin(a) * H); c.rotate(a + Math.PI / 2); chevron(c, col); c.restore();
    }
    c.restore();
  } else {
    blit(c, beltFrame(), 0, 0);
    c.save();
    c.beginPath(); c.rect(-H, -H + 8, TILE, 16); c.clip();
    const off = (time * speed) % 6;
    c.fillStyle = '#3a3258';
    for (let i = -H - 6; i < H + 6; i += 6) c.fillRect(i + off, -H + 8, 1.6, 16);
    c.globalCompositeOperation = 'lighter';
    for (let i = -H - 16; i < H + 16; i += 16) { c.save(); c.translate(i + ((time * speed) % 16), 0); chevron(c, col); c.restore(); }
    c.restore();
    // side feeds on a straight run (T-junction) get a merge ramp
    if (m.type === 'conveyor' && (feeds & 0b100 || side === 0b1010)) {
      if (feeds & 0b10) blit(c, beltRamp(), 0, 0);
      if (feeds & 0b1000) { c.save(); c.scale(1, -1); blit(c, beltRamp(), 0, 0); c.restore(); }
    }
  }
  if (m.type === 'separator') {
    // gate is drawn upright so its 3/4 perspective stays correct
    c.rotate(-(m.dir * Math.PI) / 2);
    blit(c, sepGate(), 0, 0);
    const sw = Math.sin(time * 4);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(c, 0, -14, 0, 10, [[0, 'rgba(255,90,140,0.55)'], [1, 'rgba(255,90,140,0.05)']]);
    c.beginPath(); c.moveTo(-3 + sw * 2, -14); c.lineTo(3 + sw * 2, -14); c.lineTo(9 + sw * 6, 10); c.lineTo(-9 + sw * 6, 10); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,140,180,0.95)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-10, 6 + sw * 2); c.lineTo(10, 6 + sw * 2); c.stroke();
    c.restore();
    glow(c, 0, -17.5, 6, SCI.cyan, 0.3 + Math.sin(time * 8) * 0.12);
    for (let i = 0; i < MAT_COUNT; i++) lamp(c, -11.2 + i * 4.5, -24.7, matCol(i), (Math.floor(time * 5) + i) % 3 === 0 || m.belt.some((p) => p.mat === i), 0.75);
  }
  c.restore();
  for (const p of m.belt) {
    const [px, py] = beltPoint(m, curve || 0, p.t);
    drawPacket(c, px, py, p.mat, p.sorted, time);
  }
}

function drawPacket(c: C, px: number, py: number, mat: number, sorted: boolean, time: number) {
  const col = matCol(mat);
  c.fillStyle = 'rgba(20,10,30,0.35)'; ellipse(c, px + 0.8, py + 3, 5, 1.8); c.fill();
  if (sorted) {
    // sorted cargo rides in a clean capsule with the material's icon
    rrect(c, px - 6, py - 8, 12, 10.5, 3.4); c.fillStyle = SCI.shell; c.fill();
    c.fillStyle = col; c.fillRect(px - 6, py - 0.8, 12, 2.2);
    rrect(c, px - 6, py - 8, 12, 10.5, 3.4); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
    drawMatIcon(c, mat, px, py - 3.6, 8.5);
    glow(c, px, py - 3, 7, col, 0.22 + Math.sin(time * 6 + px) * 0.08);
  } else {
    // loose material: its icon on a little tray
    ellipse(c, px, py + 1.2, 5.6, 2.4); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke();
    drawMatIcon(c, mat, px, py - 2.6, 10);
  }
}

// =====================================================================================================
// MACHINE DISPATCH
// =====================================================================================================
export function drawMachine(c: C, m: Machine, g: Game, time: number, fx: Effects, onScreen: boolean) {
  const def = MACHINES[m.type];
  const s = def.size * TILE;
  // a roaming collector glides from its old spot (offset decays to 0 as it drives)
  const x = (m.tx + (m.ox || 0)) * TILE, y = (m.ty + (m.oy || 0)) * TILE;
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
    case 'depot': drawDepot(c, x, y, time, g, fx, onScreen); break;
    case 'collector': drawCollector(c, m, x, y, time, working, fx, onScreen, g); break;
    case 'arm': drawArm(c, m, x, y, time, working, fx, onScreen); break;
    case 'crusher': drawCrusher(c, m, x, y, time, working, fx, onScreen, g); break;
    case 'robots': drawStation(c, m, x, y, time); break;
    case 'excavator': drawGarage(c, m, x, y, time); break;
    case 'recycler': drawRecycler(c, x, y, time, fx, onScreen, g); break;
    case 'beacon': drawBeacon(c, m, x, y, time, g, fx, onScreen); break;
    case 'ancient': drawAncient(c, m, x, y, time, working, fx, onScreen); break;
    case 'harvester': drawHarvesterGarage(c, m, x, y, time); break;
    case 'drill': drawDrill(c, m, x, y, time, working, fx, onScreen); break;
    case 'vortex': drawVortexEmitter(c, m, x, y, time); break;
    default: break;
  }
  c.restore();
  if (def.buffer > 0) {
    const cap = machineBufferCap(m, g.d);
    if (m.bufferTotal > 0 || m.status === 'full') bufferBar(c, x + 4, y + s + 2, s - 8, m.bufferTotal / cap);
  }
  if (m.type !== 'depot' && m.type !== 'recycler' && m.type !== 'beacon') statusBubble(c, m, x + s - 3, y - (s > 32 ? 34 : 26), time);
}

// =====================================================================================================
// COLLECTOR — vacuum turret with spinning intake and a glass hopper
// =====================================================================================================
function collectorBase(level: number) {
  return cachedLayer(`col3-${level}`, -10, -44, 52, 82, (c) => {
    // deck plate riding on the treads (treads themselves are drawn live so they can roll)
    rrect(c, 3, 15, 26, 13, 4); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    rrect(c, 3, 13, 26, 12, 4); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.fillStyle = SCI.teal; c.fillRect(5, 22, 22, 1.2);
    // flexible hose curling to the ground
    pipe(c, [26, 8, 33, 12, 33, 20, 31, 24], 3, SCI.violet);
    c.fillStyle = SCI.violetD; ellipse(c, 31, 24.4, 3, 1.2); c.fill();
    // cream body (capsule)
    shell(c, 4, -12, 24, 36, SCI.shell, 9);
    // orange collar + teal band
    rrect(c, 3, 13, 26, 5.5, 2.7); c.fillStyle = SCI.orange; c.fill(); c.fillStyle = SCI.orangeD; c.fillRect(3, 16.5, 26, 2); rrect(c, 3, 13, 26, 5.5, 2.7); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.fillStyle = SCI.teal; c.fillRect(6, -6.5, 20, 1.6);
    // hopper window frame (contents live)
    rrect(c, 9, -3, 14, 14, 5); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    // intake ring on top
    ellipse(c, 16, -14, 13.5, 6); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 16, -15, 13.5, 6); c.fillStyle = SCI.shell; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 16, -15, 10.5, 4.4); c.fillStyle = '#120f1d'; c.fill();
    c.fillStyle = SCI.orange; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; c.beginPath(); c.arc(16 + Math.cos(a) * 12, -15 + Math.sin(a) * 5.3, 0.7, 0, 6.28); c.fill(); }
    pipe(c, [26, -8, 30, -24], 0.9, SCI.violet);
    levelPips(c, 16, 31, level);
  });
}

/** Two little tank treads under the collector; lugs roll while it drives. */
function collectorTreads(c: C, x: number, y: number, roll: number) {
  for (const tx of [x - 1, x + 25]) {
    rrect(c, tx, y + 14, 8, 17, 3.5); c.fillStyle = '#231d36'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.save(); rrect(c, tx + 1, y + 15, 6, 15, 3); c.clip();
    c.fillStyle = '#4b416e';
    const off = ((roll % 3.4) + 3.4) % 3.4;
    for (let ly = y + 13 + off; ly < y + 32; ly += 3.4) c.fillRect(tx + 1, ly, 6, 1.5);
    c.restore();
    // drive wheels peeking out front/back
    for (const wy of [y + 17.5, y + 27.5]) { c.beginPath(); c.arc(tx + 4, wy, 1.8, 0, 6.28); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke(); }
  }
}

function drawCollector(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean, g: Game) {
  const moving = Math.abs(m.ox || 0) + Math.abs(m.oy || 0) > 0.01;
  const bob = moving ? Math.sin(time * 26) * 0.6 : working ? Math.sin(time * 20) * 0.25 : 0;
  groundShadow(c, x + 16, y + 30, 18, 5.5, 0.4);
  collectorTreads(c, x, y, moving ? time * 30 : 0);
  if (moving && onScreen && Math.random() < 0.35) fx.burst(x + 16 + (Math.random() - 0.5) * 26, y + 30, 'dust', 1);
  blit(c, collectorBase(m.level), x, y + bob);
  const cx = x + 16, cy = y - 15 + bob;
  // spinning turbine inside the intake
  c.save(); c.translate(cx, cy); c.scale(1, 0.42); c.rotate(working ? time * 14 : time * 0.5);
  for (let i = 0; i < 5; i++) {
    c.rotate(1.2566);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6, -4, 9.6, 0.5); c.lineTo(1.5, 2); c.closePath();
    c.fillStyle = i % 2 ? '#cfc6e4' : '#a99fca'; c.fill();
  }
  c.fillStyle = SCI.orange; c.beginPath(); c.arc(0, 0, 2.4, 0, 6.28); c.fill();
  c.restore();
  if (working) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(95,242,255,0.22)'; ellipse(c, cx, cy, 10.5, 4.4); c.fill();
    c.strokeStyle = 'rgba(95,242,255,0.5)'; c.lineWidth = 0.8;
    for (let i = 0; i < 2; i++) { const a = time * 9 + i * 3.14; c.beginPath(); c.ellipse(cx, cy - 3 - i * 2, 7 - i * 2, 2.6 - i * 0.6, 0, a, a + 2.2); c.stroke(); }
    c.restore();
  }
  // hopper window shows the haul as colored crystals
  const cap = Math.max(1, machineBufferCap(m, g.d));
  const fill = Math.min(1, m.bufferTotal / cap);
  const wx = x + 9, wy = y - 3 + bob;
  c.save(); rrect(c, wx + 1, wy + 1, 12, 12, 4.3); c.clip();
  c.fillStyle = lin(c, 0, wy, 0, wy + 14, [[0, '#3f6f8f'], [1, '#22324f']]); c.fillRect(wx, wy, 14, 14);
  if (fill > 0) {
    const top = wy + 13 - 12 * fill;
    c.fillStyle = 'rgba(95,242,255,0.18)'; c.fillRect(wx, top, 14, 14);
    let k = 0;
    for (let row = 0; top + row * 2.6 < wy + 14; row++) for (let col = 0; col < 4; col++, k++) {
      let mi = 0; let best = -1;
      for (let i = 0; i < MAT_COUNT; i++) { const v = m.buffer[i] * (((k * 7 + i * 3) % 5) + 1); if (v > best) { best = v; mi = i; } }
      gem(c, wx + 2.5 + col * 3.1 + (row % 2) * 1.2, top + 1.5 + row * 2.6 + (working ? Math.sin(time * 7 + k) * 0.3 : 0), 1.5, matCol(mi), k);
    }
  }
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(wx + 4.5, wy + 3.5, 2, 1, -0.6, 0, 6.28); c.fill();
  c.restore();
  lamp(c, x + 30, y - 24.5 + bob, statusColor(m), !working || Math.sin(time * 5 + m.id) > -0.5, 1.2);
  if (working && onScreen) {
    const tp = targetPos(m);
    if (tp && Math.random() < 0.55) fx.suck(tp[0] + (Math.random() - 0.5) * 22, tp[1] + (Math.random() - 0.5) * 22, cx, cy, Math.floor(Math.random() * 3), 0.5);
  }
}

// =====================================================================================================
// HYDRAULIC CRANE (arm) — lifts the heavy base of the piles
// =====================================================================================================
function armBase(level: number) {
  return cachedLayer(`arm3-${level}`, -10, -22, 54, 62, (c) => {
    groundShadow(c, 16, 27, 19, 7, 0.42);
    // outriggers
    for (const [ox, oy] of [[-3, 24], [35, 24], [-1, 12], [33, 12]] as [number, number][]) {
      pipe(c, [16, 18, ox, oy], 2.2, SCI.violet);
      rrect(c, ox - 2.6, oy - 1, 5.2, 2.6, 1.2); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    }
    box34(c, 2, 8, 28, 10, 12, SCI.violet, 3);
    hazardStripes(c, 3, 26, 26, 2.4, SCI.orange, SCI.violetD);
    for (const [bx, by] of [[5, 11], [27, 11]]) bolt(c, bx, by, 1);
    // power pack with teal fins at the back
    shell(c, 0, -6, 13, 15, SCI.teal, 4);
    vent(c, 2.2, 0, 8.6, 4.6, 3);
    // turret ring
    cylinder34(c, 16, 6, 9, 5, SCI.shell, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; rivet(c, 16 + Math.cos(a) * 7, 6 + Math.sin(a) * 2.8, 0.45, SCI.orange); }
    levelPips(c, 16, 32, level);
  });
}

function drawArm(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  blit(c, armBase(m.level), x, y);
  const cx = x + 16, cy = y + 6;
  const tp = targetPos(m);
  let ang = Math.sin(time * 0.6 + m.id) * 1.2 - 1.2;
  let reach = 18;
  if (tp) { ang = Math.atan2(tp[1] - cy, tp[0] - cx); reach = Math.min(50, Math.hypot(tp[0] - cx, tp[1] - cy)); }
  // lift cycle: lower -> grab -> raise
  const cyc = working ? (time * 0.9 + m.id * 0.13) % 1 : 0.6;
  const lift = working ? (cyc < 0.45 ? cyc / 0.45 : cyc < 0.6 ? 1 : 1 - (cyc - 0.6) / 0.4) : 0.6;
  const holding = working && cyc < 0.6;
  // cab (turns toward the target)
  c.save(); c.translate(cx, cy);
  const hx = Math.cos(ang) * 2.4, hy = Math.sin(ang) * 1.2;
  shell(c, -7 + hx * 0.3, -11 + hy, 14, 11, SCI.shell, 4.5);
  glass(c, -4 + hx * 0.8, -9 + hy, 8, 4, '#173246', 2);
  c.fillStyle = SCI.orange; c.fillRect(-7 + hx * 0.3, -3 + hy, 14, 1.6);
  c.restore();
  const L1 = 16, L2 = Math.max(9, reach - L1 * 0.6) * (0.85 + lift * 0.15);
  const sx = cx, sy = cy - 9;
  const raise = 6 + lift * 8;
  const jx = sx + Math.cos(ang - 0.4) * L1, jy = sy + Math.sin(ang - 0.4) * L1 - raise;
  const ex = jx + Math.cos(ang + 0.3) * L2, ey = jy + Math.sin(ang + 0.3) * L2 + raise * 0.9 - lift * 4;
  c.strokeStyle = 'rgba(20,10,30,0.22)'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx + 3, cy + 6); c.lineTo(jx + 6, jy + 16 + raise); c.lineTo(ex + 4, ey + 10 + lift * 6); c.stroke();
  const seg = (x0: number, y0: number, x1: number, y1: number, w: number, col: string) => {
    const a = Math.atan2(y1 - y0, x1 - x0), l = Math.hypot(x1 - x0, y1 - y0);
    c.save(); c.translate(x0, y0); c.rotate(a);
    rrect(c, -w / 2, -w / 2, l + w, w, w / 2); c.fillStyle = col; c.fill();
    c.save(); rrect(c, -w / 2, -w / 2, l + w, w, w / 2); c.clip();
    c.fillStyle = shade(col, -0.22); c.fillRect(-w, w * 0.12, l + 2 * w, w);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-w, -w * 0.36, l + 2 * w, w * 0.16);
    c.fillStyle = SCI.teal; c.fillRect(l * 0.3, -w / 2, 1.4, w); c.fillRect(l * 0.36, -w / 2, 1.4, w);
    c.restore();
    rrect(c, -w / 2, -w / 2, l + w, w, w / 2); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.restore();
  };
  seg(sx, sy, jx, jy, 6.6, SCI.orange);
  const pa = Math.atan2(jy - sy, jx - sx);
  const px0 = sx + Math.cos(pa + 1.57) * 3.4, py0 = sy + Math.sin(pa + 1.57) * 3.4;
  const plen = Math.hypot(jx - sx, jy - sy) * (0.55 + lift * 0.2);
  pipe(c, [px0, py0, px0 + Math.cos(pa) * plen * 0.6, py0 + Math.sin(pa) * plen * 0.6], 2.3, SCI.violet);
  pipe(c, [px0 + Math.cos(pa) * plen * 0.6, py0 + Math.sin(pa) * plen * 0.6, px0 + Math.cos(pa) * plen, py0 + Math.sin(pa) * plen], 1.2, '#e9e4f5');
  seg(jx, jy, ex, ey, 5.2, '#ffb15e');
  for (const [jxx, jyy] of [[sx, sy], [jx, jy]]) {
    c.beginPath(); c.arc(jxx, jyy, 3.5, 0, 6.28); c.fillStyle = SCI.shell; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.fillStyle = SCI.teal; c.beginPath(); c.arc(jxx, jyy, 1.4, 0, 6.28); c.fill();
  }
  // grabber: two teal jaws, with the chunk being lifted
  const open = holding ? 0.15 : 0.7;
  c.save(); c.translate(ex, ey);
  if (holding) {
    const k = Math.abs(m.id + Math.floor(time * 0.9 + m.id * 0.13)) % CHUNK_COLS.length;
    gem(c, 0, 6.5, 4.6, CHUNK_COLS[k], 0.4);
    gem(c, 3, 8, 2.6, shade(CHUNK_COLS[k], -0.15), -0.3);
  }
  rrect(c, -3, -3.4, 6, 5, 1.8); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  for (const sd of [-1, 1]) {
    const a = sd * (0.25 + open * 0.6);
    c.save(); c.rotate(a);
    c.beginPath(); c.moveTo(sd * 1.6, 0.8); c.quadraticCurveTo(sd * 6.5, 4, sd * 3, 10); c.lineTo(sd * 1.2, 9); c.quadraticCurveTo(sd * 3.8, 4.5, sd * 0.2, 1.4); c.closePath();
    c.fillStyle = SCI.teal; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    c.restore();
  }
  c.restore();
  lamp(c, x + 27, y + 14, statusColor(m), true, 1.2);
  if (working && onScreen && tp && lift < 0.1 && Math.random() < 0.3) fx.burst(tp[0], tp[1], 'dust', 1);
}

// =====================================================================================================
// COMPACTOR PRESS (crusher, 2x2) — thumps the yard queue down
// =====================================================================================================
function crusherBase(level: number) {
  return cachedLayer(`crush3-${level}`, -10, -56, 86, 126, (c) => {
    groundShadow(c, 32, 60, 34, 10, 0.45);
    // back wall of the press bay
    rrect(c, 8, -24, 48, 44, 4); c.fillStyle = SCI.violetD; c.fill();
    c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 5; i++) c.fillRect(10, -20 + i * 8, 44, 3);
    rrect(c, 8, -24, 48, 44, 4); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    box34(c, 2, 14, 60, 16, 32, SCI.shell, 5);
    // control strip on the front
    rrect(c, 22, 50.5, 20, 2, 1); c.fillStyle = SCI.teal; c.fill();
    // warning sign + gauges flanking the window
    poly(c, [4.5, 46, 8.5, 38.5, 12.5, 46]); c.fillStyle = SCI.gold; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
    stencil(c, '!', 8.5, 43.6, 4.6, INK);
    rrect(c, 53.5, 37, 6, 10, 2); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    for (let i = 0; i < 3; i++) { c.fillStyle = [SCI.cyan, SCI.gold, '#f87171'][i]; c.fillRect(55, 38.6 + i * 2.8, 3, 1.6); }
    // front window into the chamber (contents live)
    rrect(c, 12, 34, 40, 16, 4); c.fillStyle = '#17132a'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    hazardStripes(c, 3, 53, 58, 4, SCI.orange, SCI.violetD);
    // press columns
    for (const px of [2, 54]) {
      shell(c, px, -26, 8, 46, SCI.violet, 3.6);
      c.fillStyle = SCI.teal; for (let i = 0; i < 4; i++) c.fillRect(px + 2, -18 + i * 9, 4, 1.4);
    }
    // top beam
    shell(c, 0, -34, 64, 12, SCI.orange, 5);
    stencil(c, 'COMPACTADOR', 32, -27.6, 4.6, 'rgba(60,25,0,0.85)');
    // output ramp
    poly(c, [62, 38, 74, 46, 74, 58, 62, 54]); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    vent(c, 6, 18, 10, 8, 4); vent(c, 48, 18, 10, 8, 4);
    levelPips(c, 32, 64, level);
  });
}

function drawCrusher(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean, g: Game) {
  blit(c, crusherBase(m.level), x, y);
  // press head: slow descent, quick slam back up
  const t = working ? (time * 1.3 + m.id * 0.21) % 1 : 0.3;
  const drop = working ? (t < 0.75 ? t / 0.75 : 1 - (t - 0.75) / 0.25) : 0.1;
  const headY = y - 20 + drop * 30;
  pipe(c, [x + 32, y - 22, x + 32, headY], 4, '#e9e4f5');
  shell(c, x + 12, headY - 2, 40, 9, SCI.violet, 3);
  c.fillStyle = SCI.cyan; c.fillRect(x + 16, headY + 4.6, 32, 1.2);
  // chamber contents (yard queue)
  const yfill = Math.min(1, g.yardTotal / Math.max(1, g.yardCap()));
  c.save(); rrect(c, x + 13, y + 35, 38, 14, 3.4); c.clip();
  if (working || yfill > 0.02) {
    for (let i = 0; i < 9; i++) gem(c, x + 16 + i * 4, y + 46 - (i % 3) * 2 - (drop > 0.9 ? 0 : 1.5), 2, CHUNK_COLS[i % 4], i);
  }
  if (working && drop > 0.9) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(95,242,255,0.35)'; c.fillRect(x + 13, y + 35, 38, 14); }
  c.restore();
  // compacted cubes sliding out
  if (working) for (let i = 0; i < 2; i++) {
    const k = (time * 0.6 + i * 0.5) % 1;
    const bx = x + 63 + k * 9, by = y + 44 + k * 7;
    rrect(c, bx - 2.6, by - 2.6, 5.2, 5.2, 1); c.fillStyle = CHUNK_COLS[(i + Math.floor(time * 0.6)) % 4]; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
  }
  lamp(c, x + 6, y - 39, statusColor(m), true, 1.3);
  lamp(c, x + 58, y - 39, '#f87171', working && Math.sin(time * 10) > 0, 1.3);
  if (working && onScreen) {
    if (drop > 0.97 && Math.random() < 0.5) { fx.burst(x + 32 + (Math.random() - 0.5) * 30, y + 38, 'spark', 2); fx.shake(0.05); }
    const hub = g.machines.nearestHub(m.tx + 1, m.ty + 1);
    if (hub && Math.random() < 0.12) fx.fly((hub.tx + 1.5) * TILE, (hub.ty + 1.5) * TILE, x + 32, y + 30, Math.floor(Math.random() * 5));
  }
}

// =====================================================================================================
// DRONE HANGAR (robots)
// =====================================================================================================
function stationBase(level: number) {
  return cachedLayer(`hang3-${level}`, -10, -44, 52, 82, (c) => {
    groundShadow(c, 16, 26, 19, 7, 0.38);
    ellipse(c, 16, 22, 16, 8); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 16, 20, 16, 8); c.fillStyle = SCI.shell; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 16, 20, 11.5, 5.6); c.fillStyle = SCI.violet; c.fill();
    c.strokeStyle = SCI.teal; c.lineWidth = 1.4; ellipse(c, 16, 20, 8, 3.8); c.stroke();
    c.save(); c.translate(16, 20); c.scale(1, 0.5); c.strokeStyle = SCI.orange; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-4, -4); c.lineTo(-4, 4); c.moveTo(4, -4); c.lineTo(4, 4); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke(); c.restore();
    // control tower capsule
    shell(c, 22, -22, 11, 34, SCI.shell, 5);
    glass(c, 24, -18, 7, 6, '#173246', 2.5);
    c.fillStyle = SCI.teal; c.fillRect(22.5, -6, 10, 1.6);
    vent(c, 24, 0, 7, 6, 3);
    pipe(c, [27.5, -22, 27.5, -36], 1.2, SCI.violet);
    levelPips(c, 16, 31, level);
  });
}

function drawStation(c: C, m: Machine, x: number, y: number, time: number) {
  blit(c, stationBase(m.level), x, y);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28;
    lamp(c, x + 16 + Math.cos(a) * 13.6, y + 20 + Math.sin(a) * 6.6, SCI.cyan, Math.floor(time * 8) % 8 === i, 0.7);
  }
  lamp(c, x + 27.5, y - 37, statusColor(m), Math.sin(time * 4 + m.id) > -0.3, 1.4);
  // drone count badge on the tower
  const n = m.bots.length;
  if (n > 0) {
    rrect(c, x + 13, y - 31, 10, 8, 3); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = SCI.cyan; c.font = '900 6.5px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x + 18, y - 26.8);
  }
}

export function drawBots(c: C, m: Machine, time: number, fx: Effects, onScreen: boolean) {
  for (const b of m.bots) {
    if (m.type === 'excavator') drawExcavatorVehicle(c, b, time, fx, onScreen);
    else if (m.type === 'harvester') drawRover(c, b, time, fx, onScreen);
    else if (m.type === 'vortex') drawVortex(c, m, b, time, fx, onScreen);
    else drawBot(c, b, time, fx, onScreen);
  }
}

function drawBot(c: C, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const hover = Math.sin(time * 5 + b.anim * 3) * 1.4;
  const working = b.state === BOT_WORK;
  groundShadow(c, x, y + 4, 6.5, 2.6, 0.32);
  const by = y - 13 + hover;
  // tractor beam with rising rings
  if (working) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(c, 0, by + 4, 0, y + 6, [[0, 'rgba(95,242,255,0.55)'], [1, 'rgba(95,242,255,0)']]);
    c.beginPath(); c.moveTo(x - 2.4, by + 4); c.lineTo(x + 2.4, by + 4); c.lineTo(x + 8, y + 6); c.lineTo(x - 8, y + 6); c.closePath(); c.fill();
    for (let i = 0; i < 3; i++) { const k = (time * 2 + i / 3) % 1; c.strokeStyle = `rgba(190,250,255,${0.6 * k})`; c.lineWidth = 0.6; ellipse(c, x, y + 4 - k * (y - by - 2), 7 - k * 4.5, 2 - k * 1.2); c.stroke(); }
    c.restore();
  }
  // ducted fan ring
  ellipse(c, x, by + 0.5, 8.2, 3); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = 'rgba(200,220,255,0.35)'; ellipse(c, x, by + 0.3, 7, 2.2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.5;
  for (let i = 0; i < 2; i++) { const a = time * 50 + i * 1.57; c.beginPath(); c.moveTo(x - Math.cos(a) * 6.5, by + 0.3 - Math.sin(a) * 2); c.lineTo(x + Math.cos(a) * 6.5, by + 0.3 + Math.sin(a) * 2); c.stroke(); }
  // cargo pod underneath: a glass bubble showing what it carries
  if (b.carryTotal > 0) {
    let m1 = 0, m2 = -1;
    for (let k = 1; k < MAT_COUNT; k++) if (b.carry[k] > b.carry[m1]) m1 = k;
    for (let k = 0; k < MAT_COUNT; k++) if (k !== m1 && b.carry[k] > 0 && (m2 < 0 || b.carry[k] > b.carry[m2])) m2 = k;
    c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - 2, by + 1.5); c.lineTo(x - 2.6, by + 4); c.moveTo(x + 2, by + 1.5); c.lineTo(x + 2.6, by + 4); c.stroke();
    c.beginPath(); c.arc(x, by + 7, 4.4, 0, 6.28); c.fillStyle = 'rgba(200,240,255,0.35)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    if (m2 >= 0) drawMatIcon(c, m2, x + 1.8, by + 8, 5);
    drawMatIcon(c, m1, x - 0.8, by + 6.8, 6);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(x - 1.8, by + 5, 0.9, 0, 6.28); c.fill();
    if (b.state === BOT_RETURN && Math.sin(time * 9 + b.anim * 5) > 0.92) glow(c, x, by + 7, 6, SCI.cyan, 0.5);
  } else {
    rrect(c, x - 3.4, by + 2, 6.8, 4, 1.8); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke();
  }
  // round body with one big eye
  c.beginPath(); c.arc(x, by - 2.6, 4.8, 0, 6.28);
  c.fillStyle = rad(c, x - 1.6, by - 4.4, 0, 6, [[0, '#ffffff'], [0.5, SCI.shell], [1, SCI.shellD]]); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = SCI.orange; c.fillRect(x - 4.4, by - 0.6, 8.8, 1.2);
  const ex = Math.cos(b.angle) * 1.4;
  c.fillStyle = '#16122a'; c.beginPath(); c.arc(x + ex, by - 3, 2.3, 0, 6.28); c.fill();
  const eyeCol = working ? SCI.orange : b.state === BOT_RETURN ? '#a3e635' : SCI.cyan;
  c.fillStyle = eyeCol; c.beginPath(); c.arc(x + ex, by - 3, 1.3, 0, 6.28); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x + ex - 0.5, by - 3.5, 0.45, 0, 6.28); c.fill();
  // tiny antenna
  c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x + 1.5, by - 7); c.lineTo(x + 2.6, by - 9.4); c.stroke();
  c.fillStyle = eyeCol; c.beginPath(); c.arc(x + 2.6, by - 9.6, 0.8, 0, 6.28); c.fill();
  if (working && onScreen && Math.random() < 0.35) fx.suck(x + (Math.random() - 0.5) * 22, y + 6 + (Math.random() - 0.5) * 14, x, by + 5, Math.floor(Math.random() * 3), 0.35);
}

// =====================================================================================================
// MINING GARAGE + BUCKET-WHEEL CRAWLER (excavator)
// =====================================================================================================
function garageBase(level: number) {
  return cachedLayer(`garage3-${level}`, -10, -40, 86, 112, (c) => {
    groundShadow(c, 32, 60, 36, 10, 0.42);
    rrect(c, -4, 30, 72, 36, 6); c.fillStyle = '#5b4f80'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    c.save(); rrect(c, -4, 30, 72, 36, 6); c.clip(); hazardStripes(c, -4, 62, 72, 4, SCI.orange, SCI.violetD); c.restore();
    for (const gx of [-1, 65]) for (let i = 0; i < 4; i++) { c.fillStyle = SCI.cyan; c.beginPath(); c.arc(gx, 38 + i * 7, 0.9, 0, 6.28); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 3; c.setLineDash([3, 3]);
    for (const tx of [22, 42]) { c.beginPath(); c.moveTo(tx, 36); c.lineTo(tx, 64); c.stroke(); }
    c.setLineDash([]);
    // quonset hangar
    const hall = () => { c.beginPath(); c.moveTo(2, 36); c.lineTo(2, 10); c.bezierCurveTo(2, -26, 62, -26, 62, 10); c.lineTo(62, 36); c.closePath(); };
    hall(); c.fillStyle = SCI.shell; c.fill();
    c.save(); hall(); c.clip();
    c.fillStyle = shade(SCI.shell, -0.14); c.fillRect(42, -30, 30, 70);
    c.strokeStyle = shade(SCI.shell, -0.22); c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(2 + i * 12, 40); c.quadraticCurveTo(2 + i * 12, -14, 32, -16); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(10, -10, 4, 40);
    c.restore();
    hall(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    rrect(c, 12, 6, 40, 30, 4); c.fillStyle = '#17132a'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    hazardStripes(c, 12, 3, 40, 3, SCI.orange, SCI.violetD);
    rrect(c, 18, -12, 28, 8, 3); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    stencil(c, 'MINERADORA', 32, -7.8, 3.6, 'rgba(60,25,0,0.85)');
    cylinder34(c, 68, 14, 4.5, 18, SCI.teal, 1);
    c.fillStyle = SCI.cyan; c.fillRect(66.4, 19, 3.2, 8);
    levelPips(c, 32, 69, level);
  });
}

function drawGarage(c: C, m: Machine, x: number, y: number, time: number) {
  blit(c, garageBase(m.level), x, y);
  const b = m.bots[0];
  const away = b ? Math.hypot(b.x - (m.tx + 1), b.y - (m.ty + 1)) : 0;
  const open = Math.min(1, away / 1.5);
  const dh = 28 * (1 - open * 0.85);
  c.save(); rrect(c, x + 13, y + 7, 38, 28, 3.4); c.clip();
  c.fillStyle = lin(c, 0, y + 7, 0, y + 7 + dh, [[0, '#d9cfee'], [1, '#9c90c2']]);
  c.fillRect(x + 13, y + 7, 38, dh);
  c.fillStyle = 'rgba(40,20,60,0.2)'; for (let i = y + 9; i < y + 7 + dh; i += 3) c.fillRect(x + 13, i, 38, 0.7);
  c.restore();
  lamp(c, x + 8, y + 2, statusColor(m), true, 1.2);
  lamp(c, x + 56, y + 2, SCI.orange, m.status === 'working' && Math.sin(time * 7) > 0, 1.2);
}

function drawExcavatorVehicle(c: C, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const working = b.state === BOT_WORK;
  const moving = b.state === BOT_GO || b.state === BOT_RETURN;
  const ang = b.angle;
  groundShadow(c, x + 3, y + 6, 24, 12, 0.42);
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  // tracks
  for (const ty of [-12.5, 6.5]) {
    rrect(c, -16, ty, 30, 6.5, 3.2); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
    const off = moving ? (time * 34) % 4 : 0;
    c.fillStyle = '#5b4f80';
    for (let i = -15; i < 13; i += 4) c.fillRect(i + off, ty + 0.8, 1.6, 4.9);
  }
  // body
  rrect(c, -14, -9, 22, 18, 5); c.fillStyle = SCI.shell; c.fill();
  c.save(); rrect(c, -14, -9, 22, 18, 5); c.clip(); c.fillStyle = shade(SCI.shell, -0.15); c.fillRect(-14, 2, 22, 8); c.fillStyle = SCI.orange; c.fillRect(-14, -2, 22, 3); c.restore();
  rrect(c, -14, -9, 22, 18, 5); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  // cockpit bubble
  c.beginPath(); c.arc(-6, -2, 4.6, 0, 6.28); c.fillStyle = '#173246'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-7.4, -3.6, 1.6, 0.9, -0.6, 0, 6.28); c.fill();
  // bucket wheel boom
  rrect(c, 6, -2.4, 12, 4.8, 2); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  const rot = working ? time * 5 : moving ? time : 0;
  c.save(); c.translate(19, 0);
  c.beginPath(); c.arc(0, 0, 7.5, 0, 6.28); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.beginPath(); c.arc(0, 0, 4, 0, 6.28); c.fillStyle = SCI.orangeD; c.fill();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * 6.28;
    c.save(); c.rotate(a); c.translate(7.6, 0);
    rrect(c, -1.6, -2.4, 3.6, 4.8, 1); c.fillStyle = '#e9e4f5'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke();
    if (b.carryTotal > 0 && i % 2 === 0) { c.fillStyle = CHUNK_COLS[i % 4]; c.fillRect(-0.8, -1.4, 2, 2.8); }
    c.restore();
  }
  c.fillStyle = SCI.teal; c.beginPath(); c.arc(0, 0, 1.6, 0, 6.28); c.fill();
  c.restore();
  lamp(c, -2, -8, SCI.orange, Math.sin(time * 8) > 0, 1);
  c.restore();
  if (onScreen) {
    if (working) {
      const hx = x + Math.cos(ang) * 19, hy = y + Math.sin(ang) * 19;
      if (Math.random() < 0.5) fx.burst(hx, hy, 'dust', 1);
      if (Math.random() < 0.06) fx.shake(0.1);
    }
    if (moving && Math.random() < 0.15) fx.burst(x - Math.cos(ang) * 15, y - Math.sin(ang) * 15 + 6, 'dust', 1);
  }
}

// =====================================================================================================
// REFINERY (recycler, 3x3) — glass dome with a swirling core
// =====================================================================================================
const recyclerBase = () => cachedLayer('refinery3', -14, -66, 126, 174, (c) => {
  groundShadow(c, 48, 92, 54, 13, 0.45);
  rrect(c, -6, 30, 108, 68, 10); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  rrect(c, -6, 27, 108, 66, 10); c.fillStyle = '#5b4f80'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
  for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-2 + i * 12, 30); c.lineTo(-2 + i * 12, 90); c.stroke(); }
  // side tanks
  const tanks: [number, string][] = [[2, '#f472b6'], [14, '#93c5fd'], [84, '#86efac'], [96, '#fb923c']];
  for (const [tx, col] of tanks) {
    cylinder34(c, tx, -8, 6, 46, SCI.shell, 2);
    rrect(c, tx - 2.2, 4, 4.4, 26, 2.2); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
  }
  pipe(c, [14, -4, 26, -4, 30, 8], 2.4, SCI.teal);
  pipe(c, [84, -4, 72, -4, 68, 8], 2.4, SCI.teal);
  // dome base ring
  box34(c, 18, 26, 62, 10, 26, SCI.shell, 8);
  c.fillStyle = SCI.orange; c.fillRect(19, 44, 60, 4);
  rrect(c, 19, 44, 60, 4, 1); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  rrect(c, 38, 52, 22, 10, 3); c.fillStyle = '#17132a'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  // cargo crates in material colors on the apron
  for (const [bx, by, col] of [[0, 62, '#f472b6'], [8, 66, '#93c5fd'], [86, 62, '#86efac'], [92, 70, '#fb923c']] as [number, number, string][]) {
    box34(c, bx, by, 9, 3, 7, col, 1.4);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(bx + 1.5, by + 5, 6, 0.8);
  }
  c.save(); rrect(c, -6, 27, 108, 66, 10); c.clip(); hazardStripes(c, -6, 82, 108, 3.4, SCI.orange, SCI.violetD); c.restore();
  rrect(c, 26, 70, 46, 9, 3); c.fillStyle = SCI.teal; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  stencil(c, 'REFINARIA', 49, 74.8, 5, 'rgba(0,40,36,0.9)');
  // dome interior (glass and core drawn live)
  c.beginPath(); c.ellipse(49, 30, 28, 34, 0, Math.PI, 0); c.closePath(); c.fillStyle = '#1b1631'; c.fill();
  cylinder34(c, 90, -56, 4, 48, SCI.violet, 4);
  c.fillStyle = SCI.cyan; c.fillRect(86.5, -48, 7, 2);
});

function drawRecycler(c: C, x: number, y: number, time: number, fx: Effects, onScreen: boolean, g: Game) {
  blit(c, recyclerBase(), x, y);
  const busy = g.yardTotal > 0.5;
  const cx = x + 49, cy = y + 6;
  c.save();
  c.beginPath(); c.ellipse(x + 49, y + 30, 27, 33, 0, Math.PI, 0); c.closePath(); c.clip();
  c.globalCompositeOperation = 'lighter';
  glow(c, cx, cy + 6, 26, SCI.cyan, busy ? 0.55 : 0.25);
  for (let i = 0; i < 6; i++) {
    const a = time * (busy ? 2.5 : 0.6) + i * 1.05;
    gem(c, cx + Math.cos(a) * 14, cy + 8 + Math.sin(a) * 6, 2.6, ['#f472b6', '#93c5fd', '#86efac', '#fb923c', '#5ff2ff', '#c084fc'][i], a);
  }
  c.beginPath(); c.arc(cx, cy + 8, 5 + Math.sin(time * 4) * 0.8, 0, 6.28); c.fillStyle = 'rgba(200,255,255,0.8)'; c.fill();
  c.restore();
  // glass dome
  c.save();
  c.beginPath(); c.ellipse(x + 49, y + 30, 28, 34, 0, Math.PI, 0); c.closePath();
  c.fillStyle = 'rgba(160,230,255,0.14)'; c.fill();
  c.strokeStyle = INK; c.lineWidth = INK_W * 1.3; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2.4;
  c.beginPath(); c.ellipse(x + 49, y + 30, 22, 28, 0, Math.PI + 0.35, Math.PI + 1.1); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(x + 49, y + 30, 28 * Math.abs(Math.cos(k * 1.4)) + 0.1, 34, 0, Math.PI, 0); c.stroke(); }
  c.restore();
  for (let i = 0; i < 6; i++) lamp(c, x + 6 + i * 17, y + 92, SCI.cyan, Math.floor(time * 3) % 6 === i, 0.9);
  if (onScreen && Math.random() < (busy ? 0.15 : 0.04)) fx.smoke(x + 90, y - 58);
}

// =====================================================================================================
// CARGO TELEPORTER (beacon, 2x2) — a remote drop-off that beams everything to the silos
// =====================================================================================================
const beaconBase = () => cachedLayer('beacon1', -8, -40, 82, 112, (c) => {
  groundShadow(c, 32, 58, 34, 9, 0.4);
  // octagonal deck
  const oct = (oy: number, r: number, k: number) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + Math.PI / 8; c.lineTo(32 + Math.cos(a) * r, 36 + oy + Math.sin(a) * r * k); } c.closePath(); };
  oct(5, 31, 0.62); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  oct(0, 31, 0.62); c.fillStyle = '#6a5d95'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  oct(0, 25, 0.62); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1; c.stroke();
  // hazard ring around the pad
  c.save(); c.translate(32, 36); c.scale(1, 0.5);
  for (let i = 0; i < 16; i++) { const a0 = (i / 16) * 6.28; c.beginPath(); c.arc(0, 0, 21, a0, a0 + 0.3); c.arc(0, 0, 18, a0 + 0.3, a0, true); c.closePath(); c.fillStyle = i % 2 ? SCI.orange : SCI.violetD; c.fill(); }
  c.restore();
  // the pad: cream rim, dark well
  ellipse(c, 32, 37.5, 17, 8.4); c.fillStyle = SCI.shellD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  ellipse(c, 32, 36, 17, 8.4); c.fillStyle = SCI.shell; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  ellipse(c, 32, 36, 13, 6.2); c.fillStyle = '#16122a'; c.fill(); c.strokeStyle = SCI.teal; c.lineWidth = 1.2; c.stroke();
  // three emitter pylons (back left, back right, front)
  for (const [px, py, h] of [[8, 30, 20], [56, 30, 20], [32, 58, 14]] as [number, number, number][]) {
    shell(c, px - 4, py - h, 8, h + 4, SCI.shell, 3.5);
    c.fillStyle = SCI.teal; c.fillRect(px - 3.6, py - h * 0.45, 7.2, 1.6);
    rrect(c, px - 3, py - h - 3, 6, 4, 1.6); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  }
  // antenna mast at the back, between the rear pylons
  pipe(c, [32, 20, 32, -22], 1.6, SCI.violet);
  for (const yy of [-4, -14]) pipe(c, [28, yy, 36, yy], 0.9, SCI.violet);
  ellipse(c, 32, 21, 4, 2); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
  // little sign
  rrect(c, -2, 46, 22, 9, 3); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  stencil(c, 'TELEP.', 9, 51, 4.4, '#3b1d05');
});

function drawBeacon(c: C, m: Machine, x: number, y: number, time: number, g: Game, fx: Effects, onScreen: boolean) {
  blit(c, beaconBase(), x, y);
  const pcx = x + 32, pcy = y + 36;
  // brighter when BIP stands by or the yard is busy
  const p = g.player;
  const near = Math.hypot(p.x - (x + 32), p.y - (y + 40)) < TILE * 4;
  const k = near ? 1 : g.yardTotal > 0.5 ? 0.75 : 0.5;
  c.save(); c.globalCompositeOperation = 'lighter';
  // swirling portal in the well
  c.save(); c.translate(pcx, pcy); c.scale(1, 0.48);
  for (let i = 0; i < 3; i++) {
    const a = time * (2.4 + i * 0.7) + i * 2.1;
    c.strokeStyle = `rgba(95,242,255,${0.35 * k + 0.15})`; c.lineWidth = 2.4 - i * 0.6;
    c.beginPath(); c.arc(0, 0, 11 - i * 3, a, a + 2.6); c.stroke();
  }
  c.fillStyle = rad(c, 0, 0, 0, 13, [[0, `rgba(190,250,255,${0.55 * k})`], [1, 'rgba(95,242,255,0)']]); c.beginPath(); c.arc(0, 0, 13, 0, 6.28); c.fill();
  c.restore();
  // light column
  const colH = 46 + Math.sin(time * 3) * 3;
  c.fillStyle = lin(c, 0, pcy, 0, pcy - colH, [[0, `rgba(95,242,255,${0.42 * k})`], [1, 'rgba(95,242,255,0)']]);
  c.beginPath(); c.moveTo(pcx - 11, pcy); c.lineTo(pcx + 11, pcy); c.lineTo(pcx + 6, pcy - colH); c.lineTo(pcx - 6, pcy - colH); c.closePath(); c.fill();
  // energy arcs from the pylons to the pad
  for (const [px, py] of [[x + 8, y + 7], [x + 56, y + 7], [x + 32, y + 41]] as [number, number][]) {
    const j = Math.sin(time * 23 + px) * 2;
    energyLine(c, [px, py, (px + pcx) / 2 + j, (py + pcy - 6) / 2 - 3, pcx, pcy - 4], 0.8, SCI.cyan, 0.35 + 0.4 * k);
    glow(c, px, py, 4, SCI.cyan, 0.35 + 0.35 * k);
  }
  c.restore();
  // materials dematerializing upward
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.45 + i / 4) % 1;
    const mat = (i + Math.floor(time * 0.45 + i / 4)) % MAT_COUNT;
    c.save();
    c.globalAlpha *= (1 - t) * (0.5 + 0.5 * k);
    drawMatIcon(c, mat, pcx + Math.sin(time * 2 + i * 1.7) * 6, pcy - 6 - t * 40, 9 - t * 4);
    c.restore();
  }
  // service ring guide lights + mast beacon
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28;
    lamp(c, pcx + Math.cos(a) * 19.5, pcy + Math.sin(a) * 9.6, SCI.cyan, Math.floor(time * 6) % 8 === i, 0.7);
  }
  lamp(c, x + 32, y - 24, '#f87171', Math.sin(time * 3 + m.id) > 0.2, 1.4);
  if (near && onScreen && Math.random() < 0.08) fx.burst(pcx + (Math.random() - 0.5) * 16, pcy - 10, 'magic', 1);
}

// =====================================================================================================
// OUTPOST (depot, 3x3) — office pod, MÃE's landing pad, six material silos, yard hopper
// =====================================================================================================
const SILO_X0 = 3, SILO_W = 13, SILO_GAP = 2.4, SILO_TOP = 44, SILO_H = 36;

function depotBase(stage: number) {
  return cachedLayer(`outpost-${stage}`, -22, -58, 150, 172, (c) => {
    groundShadow(c, 48, 96, 58, 13, 0.4);
    // deck: hex plates
    rrect(c, -6, 8, 108, 96, 12); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    rrect(c, -6, 5, 108, 95, 12); c.fillStyle = '#6a5d95'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.save(); rrect(c, -6, 5, 108, 95, 12); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.8;
    for (let row = 0; row < 9; row++) for (let col = 0; col < 10; col++) {
      const hx = -6 + col * 12 + (row % 2) * 6, hy = 5 + row * 11;
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.PI / 6; c.lineTo(hx + Math.cos(a) * 6.2, hy + Math.sin(a) * 5.4); } c.closePath(); c.stroke();
    }
    c.restore();
    c.fillStyle = 'rgba(255,154,60,0.35)'; c.fillRect(-6, 38, 108, 3);

    // ---- office pod (back left)
    shell(c, -4, -10, 40, 40, SCI.shell, 14);
    c.fillStyle = SCI.teal; c.fillRect(-3.5, 10, 39, 3);
    rrect(c, -4, 10, 40, 3, 1); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    // window band
    rrect(c, 1, -1, 30, 7, 3.5); c.fillStyle = '#2c3a5c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    for (let i = 0; i < 4; i++) { rrect(c, 3 + i * 7, 0.4, 5, 4.2, 1.6); c.fillStyle = i === 1 ? '#8fd9ff' : '#ffe38a'; c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(3, 0.8, 26, 1);
    // airlock door
    rrect(c, 9, 18, 14, 11, 5); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    c.strokeStyle = SCI.orangeD; c.lineWidth = 0.8; c.beginPath(); c.moveTo(16, 18.5); c.lineTo(16, 29); c.stroke();
    // vent + beacon mast
    vent(c, 26, 18, 7, 6, 3);
    // dish on the roof
    pipe(c, [8, -10, 9, -4], 1.2, SCI.violet);
    c.save(); c.translate(8, -12); c.rotate(-0.4);
    ellipse(c, 0, 0, 7, 3.4); c.fillStyle = '#e9e4f5'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(3, -5); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    c.restore();

    // ---- landing pad (back right)
    ellipse(c, 68, 22, 27, 13); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 68, 19.5, 27, 13); c.fillStyle = '#d9cfee'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 68, 19.5, 21, 10); c.fillStyle = '#3f3560'; c.fill();
    c.strokeStyle = SCI.orange; c.lineWidth = 1.4; c.setLineDash([3, 2.4]); ellipse(c, 68, 19.5, 17, 8); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(68, 19.5); c.scale(1, 0.48);
    c.strokeStyle = SCI.shell; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-8, 7); c.lineTo(-8, -7); c.lineTo(0, 2); c.lineTo(8, -7); c.lineTo(8, 7); c.stroke();
    c.restore();

    // ---- silos (front row): glass tubes on a cream base; contents drawn live
    for (let i = 0; i < MAT_COUNT; i++) {
      const sx = SILO_X0 + i * (SILO_W + SILO_GAP);
      box34(c, sx - 1, SILO_TOP + SILO_H - 4, SILO_W + 2, 4, 9, SCI.shell, 2);
      c.fillStyle = matCol(i); c.fillRect(sx + 1, SILO_TOP + SILO_H + 2, SILO_W - 2, 3);
      rrect(c, sx + 1, SILO_TOP + SILO_H + 2, SILO_W - 2, 3, 0.8); c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke();
      rrect(c, sx, SILO_TOP, SILO_W, SILO_H, 5); c.fillStyle = lin(c, sx, 0, sx + SILO_W, 0, [[0, '#4a5f8a'], [0.5, '#34406a'], [1, '#262c50']]); c.fill();
      ellipse(c, sx + SILO_W / 2, SILO_TOP - 0.5, SILO_W / 2 + 1, 3); c.fillStyle = SCI.shell; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
      ellipse(c, sx + SILO_W / 2, SILO_TOP - 2, SILO_W / 2 - 1, 2.2); c.fillStyle = shade(SCI.shell, 0.3); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    }
    // header pipe feeding the silos from the hopper
    pipe(c, [-2, SILO_TOP - 6, 98, SILO_TOP - 6], 2.6, SCI.teal);
    for (let i = 0; i < MAT_COUNT; i++) { const sx = SILO_X0 + i * (SILO_W + SILO_GAP) + SILO_W / 2; pipe(c, [sx, SILO_TOP - 6, sx, SILO_TOP - 3], 1.6, SCI.teal); }

    // ---- yard hopper (right side)
    poly(c, [100, 62, 124, 62, 120, 84, 104, 84]); c.fillStyle = SCI.shell; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    poly(c, [102, 62, 122, 62, 119, 68, 105, 68]); c.fillStyle = '#17132a'; c.fill();
    hazardStripes(c, 104, 80, 16, 3, SCI.orange, SCI.violetD);
    pipe(c, [104, 74, 98, 74, 98, SILO_TOP - 6], 2.6, SCI.teal);

    // ---- sign over the office
    pipe(c, [2, -21, 2, -10], 1.4, SCI.violet); pipe(c, [36, -21, 36, -10], 1.4, SCI.violet);
    rrect(c, -10, -36, 58, 15, 6); c.fillStyle = SCI.orange; c.fill();
    c.fillStyle = SCI.orangeD; c.fillRect(-10, -26, 58, 5);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-5, -34, 48, 1.4);
    rrect(c, -10, -36, 58, 15, 6); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    stencil(c, 'POSTO AVANÇADO', 19, -28.4, 5.4, '#3b1d05');

    // upgrades add modules to the outpost
    if (stage >= 1) { shell(c, 104, 24, 18, 22, SCI.shell, 7); c.fillStyle = SCI.teal; c.fillRect(104.5, 34, 17, 2.4); }
    if (stage >= 2) { cylinder34(c, 116, 0, 5, 22, SCI.violet, 2); c.fillStyle = SCI.cyan; c.fillRect(114.6, 6, 2.8, 12); }
    if (stage >= 3) { shell(c, -20, 30, 14, 34, SCI.teal, 6); vent(c, -18, 44, 10, 8, 4); }
  });
}

/** Silo scale: doubles above 200 so fills stay readable as stock grows. */
function siloCap(g: Game): number {
  let max = 0;
  for (let i = 0; i < MAT_COUNT; i++) max = Math.max(max, g.storage[i]);
  let cap = 200;
  while (cap < max * 1.05) cap *= 2;
  return cap;
}

function drawDepot(c: C, x: number, y: number, time: number, g: Game, fx: Effects, onScreen: boolean) {
  const lvl = g.upgrades.r_depot || 0;
  const stage = lvl >= 5 ? 3 : lvl >= 3 ? 2 : lvl >= 1 ? 1 : 0;
  blit(c, depotBase(stage), x, y);
  // silo contents
  const cap = siloCap(g);
  for (let i = 0; i < MAT_COUNT; i++) {
    const sx = x + SILO_X0 + i * (SILO_W + SILO_GAP), sy = y + SILO_TOP;
    const f = Math.min(1, (g.storage[i] || 0) / cap);
    const col = matCol(i);
    c.save(); rrect(c, sx + 1, sy + 1, SILO_W - 2, SILO_H - 2, 4.4); c.clip();
    if (f > 0.002) {
      const top = sy + SILO_H - 1 - (SILO_H - 2) * Math.max(0.04, f);
      c.fillStyle = lin(c, sx, 0, sx + SILO_W, 0, [[0, shade(col, 0.15)], [0.6, col], [1, shade(col, -0.3)]]);
      c.fillRect(sx, top, SILO_W, SILO_H);
      c.fillStyle = shade(col, 0.45);
      c.beginPath(); c.moveTo(sx, top);
      for (let k = 0; k <= 6; k++) c.lineTo(sx + (k / 6) * SILO_W, top + Math.sin(time * 3 + k + i) * 0.6);
      c.lineTo(sx + SILO_W, top + 1.6); c.lineTo(sx, top + 1.6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (let k = 0; k < 3; k++) { const bt = (time * 0.4 + k * 0.33 + i * 0.1) % 1; const by = sy + SILO_H - 2 - bt * (sy + SILO_H - 2 - top); if (by > top + 1) { c.beginPath(); c.arc(sx + 3 + ((k * 4 + i) % (SILO_W - 5)), by, 0.7, 0, 6.28); c.fill(); } }
    }
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(sx + 2, sy + 2, 2.4, SILO_H - 4); c.restore();
    rrect(c, sx, sy, SILO_W, SILO_H, 5); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.6;
    for (let k = 1; k < 4; k++) { const ty = sy + (SILO_H * k) / 4; c.beginPath(); c.moveTo(sx + SILO_W - 4, ty); c.lineTo(sx + SILO_W - 1.5, ty); c.stroke(); }
    if (f >= 0.999) glow(c, sx + SILO_W / 2, sy, 8, col, 0.4 + Math.sin(time * 5) * 0.15);
    // material badge on the glass
    c.beginPath(); c.arc(sx + SILO_W / 2, sy + 7, 5, 0, 6.28); c.fillStyle = 'rgba(243,234,216,0.92)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
    drawMatIcon(c, i, sx + SILO_W / 2, sy + 7, 9);
  }
  // yard hopper: queue waiting to be processed
  const yf = Math.min(1, g.yardTotal / Math.max(1, g.yardCap()));
  if (yf > 0.01) {
    const n = Math.ceil(2 + yf * 12);
    for (let k = 0; k < n; k++) gem(c, x + 106 + ((k * 5.3) % 14), y + 66 - Math.floor(k / 3) * 2.4 - yf * 2, 2.2, CHUNK_COLS[k % 4], k * 1.7 + Math.sin(time * 2 + k) * 0.1);
  }
  if (yf >= 0.98) {
    const bob = Math.sin(time * 4) * 1.5;
    c.beginPath(); c.arc(x + 112, y + 50 + bob, 6.5, 0, 6.28); c.fillStyle = '#ef4444'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#fff'; c.font = '900 9px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', x + 112, y + 50.5 + bob);
  }
  // processing flow along the header pipe
  if (g.yardTotal > 0.5) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) { const t = (time * 0.6 + k / 4) % 1; c.fillStyle = 'rgba(95,242,255,0.8)'; c.beginPath(); c.arc(x + 98 - t * 100, y + SILO_TOP - 6, 1.1, 0, 6.28); c.fill(); }
    c.restore();
  }
  glow(c, x + 5.5, y + 3, 8, '#ffe38a', 0.18 + Math.sin(time * 1.3) * 0.05);
  lamp(c, x + 11, y - 17, '#f87171', Math.sin(time * 2.2) > 0.4, 0.9);

  // landing pad: guide lights, or the shuttle visit
  const padX = x + 68, padY = y + 19.5;
  const st = g.shuttleT || 0;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 6.28;
    const on = st > 0 ? Math.floor(time * 10) % 2 === i % 2 : Math.floor(time * 4) % 10 === i;
    lamp(c, padX + Math.cos(a) * 24, padY + Math.sin(a) * 11.5, st > 0 ? SCI.orange : SCI.cyan, on, 0.75);
  }
  if (st > 0) drawShuttle(c, g, padX, padY, Math.max(0, 6 - st), time, x, y, fx, onScreen);
}

/** MÃE's cargo shuttle: 0–1.6 s descend, 1.6–4.4 s loading, 4.4–6 s take-off. */
function drawShuttle(c: C, g: Game, padX: number, padY: number, t: number, time: number, x: number, y: number, fx: Effects, onScreen: boolean) {
  let alt: number;
  if (t < 1.6) { const k = t / 1.6; alt = 110 * Math.pow(1 - k, 2.2); }
  else if (t < 4.4) alt = 0;
  else { const k = (t - 4.4) / 1.6; alt = 150 * k * k; }
  const landed = t >= 1.6 && t < 4.4;
  const sk = Math.max(0, 1 - alt / 120);
  groundShadow(c, padX, padY + 2, 8 + sk * 14, 3 + sk * 5, 0.25 + sk * 0.25);
  // cargo pods hop from the silos into the hold
  if (landed) {
    const lt = (t - 1.6) / 2.8;
    for (let i = 0; i < MAT_COUNT; i++) {
      const k = (lt * 2.2 + i * 0.17) % 1;
      const sx = x + SILO_X0 + i * (SILO_W + SILO_GAP) + SILO_W / 2, sy = y + SILO_TOP - 4;
      const px = sx + (padX - sx) * k, py = sy + (padY - 10 - sy) * k - Math.sin(k * Math.PI) * 18;
      rrect(c, px - 2.6, py - 2.6, 5.2, 5.2, 1.6); c.fillStyle = matCol(i); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke();
    }
  }
  const sy = padY - 12 - alt;
  // thrusters
  const thrust = t < 1.6 ? 0.6 + (1 - t / 1.6) * 0.6 : t >= 4.4 ? 1.3 : 0.15;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const tx of [-9, 9]) {
    const fl = (6 + Math.random() * 3) * thrust;
    c.fillStyle = lin(c, 0, sy + 8, 0, sy + 8 + fl * 2, [[0, 'rgba(200,255,255,0.95)'], [0.4, 'rgba(95,242,255,0.7)'], [1, 'rgba(95,242,255,0)']]);
    c.beginPath(); c.moveTo(padX + tx - 3, sy + 8); c.lineTo(padX + tx + 3, sy + 8); c.lineTo(padX + tx, sy + 8 + fl * 2); c.closePath(); c.fill();
  }
  c.restore();
  for (const sd of [-1, 1]) {
    c.beginPath(); c.moveTo(padX + sd * 10, sy - 2); c.lineTo(padX + sd * 22, sy + 6); c.lineTo(padX + sd * 20, sy + 9); c.lineTo(padX + sd * 9, sy + 6); c.closePath();
    c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  }
  for (const tx of [-9, 9]) { rrect(c, padX + tx - 3.4, sy + 2, 6.8, 7, 2.6); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke(); }
  shell(c, padX - 13, sy - 16, 26, 22, SCI.shell, 10);
  c.fillStyle = SCI.teal; c.fillRect(padX - 12.5, sy - 1, 25, 2.2);
  rrect(c, padX - 8, sy - 13, 16, 7, 3.5); c.fillStyle = '#173246'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(padX - 6, sy - 12, 4, 1.4);
  // heart logo (MÃE)
  c.fillStyle = '#f472b6';
  c.beginPath(); c.moveTo(padX, sy - 2.8); c.bezierCurveTo(padX - 3.6, sy - 6, padX - 6, sy - 1, padX, sy + 2); c.bezierCurveTo(padX + 6, sy - 1, padX + 3.6, sy - 6, padX, sy - 2.8); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.6; c.stroke();
  if (landed) { rrect(c, padX - 5, sy + 4, 10, 4, 1.5); c.fillStyle = '#ffe38a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke(); }
  lamp(c, padX - 12, sy - 4, '#f87171', Math.sin(time * 9) > 0, 0.9);
  lamp(c, padX + 12, sy - 4, '#4ade80', Math.sin(time * 9) <= 0, 0.9);
  if (onScreen && (t < 1.6 || t >= 4.4) && alt < 30 && Math.random() < 0.5) fx.burst(padX + (Math.random() - 0.5) * 30, padY + 4, 'dust', 1);
}

// =====================================================================================================
// ANCIENT MACHINE — alien obelisk with floating ring
// =====================================================================================================
const ancientBase = () => cachedLayer('ancient3', -10, -44, 52, 80, (c) => {
  groundShadow(c, 16, 27, 16, 6, 0.45);
  hexFoot(c, 16, 22, 14);
  const ob = () => { c.beginPath(); c.moveTo(10, 22); c.lineTo(8, -14); c.lineTo(16, -30); c.lineTo(24, -14); c.lineTo(22, 22); c.closePath(); };
  ob(); c.fillStyle = '#3b2f5c'; c.fill();
  c.save(); ob(); c.clip(); c.fillStyle = '#2a2145'; c.fillRect(16, -32, 12, 56); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(10, -20, 2, 40); c.restore();
  ob(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  c.strokeStyle = '#1b1530'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(13, -10); c.lineTo(16, -14); c.lineTo(19, -10); c.moveTo(16, -6); c.lineTo(16, 4); c.moveTo(12, 10); c.lineTo(20, 10); c.moveTo(14, 15); c.lineTo(18, 15); c.stroke();
});

function drawAncient(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  blit(c, ancientBase(), x, y);
  const pulse = (Math.sin(time * 2.4) + 1) / 2;
  energyLine(c, [x + 13, y - 10, x + 16, y - 14, x + 19, y - 10], 0.9, '#4ade80', 0.5 + pulse * 0.5);
  energyLine(c, [x + 16, y - 6, x + 16, y + 4], 0.9, '#4ade80', 0.4 + (1 - pulse) * 0.6);
  energyLine(c, [x + 12, y + 10, x + 20, y + 10], 0.9, '#4ade80', 0.5 + pulse * 0.5);
  glow(c, x + 16, y - 20, 20, '#4ade80', 0.18 + pulse * 0.1);
  const fy = y - 36 + Math.sin(time * 1.6) * 2;
  c.save(); c.translate(x + 16, fy); c.rotate(working ? time * 1.8 : time * 0.3);
  c.strokeStyle = INK; c.lineWidth = 3.6; ellipse(c, 0, 0, 8, 3.2); c.stroke();
  c.strokeStyle = SCI.gold; c.lineWidth = 2; ellipse(c, 0, 0, 8, 3.2); c.stroke();
  c.restore();
  gem(c, x + 16, fy, 2.6, '#86efac', time);
  if (onScreen && working) {
    const tp = targetPos(m);
    if (tp && Math.random() < 0.5) fx.suck(tp[0] + (Math.random() - 0.5) * 24, tp[1] + (Math.random() - 0.5) * 24, x + 16, y - 20, 8, 0.6);
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

export { rivet, cable };

// =====================================================================================================
// HARVESTER — alien farm barn + chunky sweeper rovers
// =====================================================================================================
function harvGarageBase(level: number) {
  return cachedLayer(`harv1-${level}`, -10, -46, 86, 118, (c) => {
    groundShadow(c, 32, 60, 36, 10, 0.42);
    // deck with hazard lip
    rrect(c, -4, 32, 72, 34, 6); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    rrect(c, -4, 30, 72, 32, 6); c.fillStyle = '#5b4f80'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.save(); rrect(c, -4, 30, 72, 32, 6); c.clip(); hazardStripes(c, -4, 58, 72, 4, SCI.orange, SCI.violetD); c.restore();
    // tire tracks leaving the door
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 3.4; c.setLineDash([2.5, 2.5]);
    for (const tx of [22, 42]) { c.beginPath(); c.moveTo(tx, 38); c.lineTo(tx, 60); c.stroke(); }
    c.setLineDash([]);
    // barn body
    rrect(c, 4, 0, 56, 36, 3); c.fillStyle = SCI.shell; c.fill();
    c.save(); rrect(c, 4, 0, 56, 36, 3); c.clip();
    c.fillStyle = shade(SCI.shell, -0.14); c.fillRect(42, 0, 20, 36);
    c.strokeStyle = shade(SCI.shell, -0.2); c.lineWidth = 0.8;
    for (let i = 8; i < 60; i += 5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 36); c.stroke(); }
    c.restore();
    rrect(c, 4, 0, 56, 36, 3); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    // gambrel roof (orange)
    const roof = () => { c.beginPath(); c.moveTo(0, 2); c.lineTo(8, -16); c.lineTo(32, -26); c.lineTo(56, -16); c.lineTo(64, 2); c.closePath(); };
    roof(); c.fillStyle = SCI.orange; c.fill();
    c.save(); roof(); c.clip();
    c.fillStyle = SCI.orangeD; c.fillRect(32, -30, 40, 40);
    c.strokeStyle = 'rgba(80,30,0,0.35)'; c.lineWidth = 0.8;
    for (let i = -24; i < 4; i += 4) { c.beginPath(); c.moveTo(0, i); c.lineTo(64, i); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(9, -14); c.lineTo(30, -23); c.lineTo(30, -20); c.lineTo(11, -11); c.closePath(); c.fill();
    c.restore();
    roof(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    // teal trim + hay-loft window with a little rover emblem
    c.fillStyle = SCI.teal; c.fillRect(4, 1, 56, 2.2);
    c.beginPath(); c.arc(32, -12, 6, 0, 6.28); c.fillStyle = '#173246'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    c.strokeStyle = SCI.cyan; c.lineWidth = 0.9; c.beginPath(); c.arc(32, -12, 4, 0, 6.28); c.stroke();
    c.fillStyle = SCI.gold; c.beginPath(); c.arc(30.2, -10.6, 1.2, 0, 6.28); c.arc(33.8, -10.6, 1.2, 0, 6.28); c.fill();
    rrect(c, 29.4, -14.8, 5.2, 3.6, 1.2); c.fill();
    // door frame
    rrect(c, 13, 8, 38, 28, 3); c.fillStyle = '#17132a'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    hazardStripes(c, 13, 5, 38, 3, SCI.orange, SCI.violetD);
    // sign
    rrect(c, 17, -34, 30, 8, 3); c.fillStyle = SCI.teal; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    stencil(c, 'COLHEITA', 32, -29.8, 3.6, 'rgba(0,40,36,0.9)');
    pipe(c, [24, -26, 24, -22], 1, SCI.violet); pipe(c, [40, -26, 40, -22], 1, SCI.violet);
    // fuel silo pod
    cylinder34(c, 68, 6, 5, 26, SCI.shell, 2);
    c.fillStyle = SCI.orange; c.fillRect(63.2, 16, 9.6, 3);
    levelPips(c, 32, 65, level);
  });
}

function drawHarvesterGarage(c: C, m: Machine, x: number, y: number, time: number) {
  blit(c, harvGarageBase(m.level), x, y);
  // the roller door rises when a rover is near
  let near = 99;
  for (const b of m.bots) near = Math.min(near, Math.hypot(b.x - (m.tx + 1), b.y - (m.ty + 1.6)));
  const open = m.bots.length ? Math.max(0, Math.min(1, 1.8 - near * 0.6)) : 0;
  const dh = 28 * (1 - open * 0.85);
  c.save(); rrect(c, x + 13, y + 8, 38, 28, 3); c.clip();
  c.fillStyle = lin(c, 0, y + 8, 0, y + 8 + dh, [[0, '#ffe2bf'], [1, '#e8a564']]);
  c.fillRect(x + 13, y + 8, 38, dh);
  c.fillStyle = 'rgba(90,40,0,0.22)'; for (let i = y + 10; i < y + 8 + dh; i += 3) c.fillRect(x + 13, i, 38, 0.7);
  c.restore();
  // landing lights chase toward the door
  for (let i = 0; i < 4; i++) {
    const on = Math.floor(time * 6) % 4 === 3 - i;
    lamp(c, x + 9, y + 38 + i * 6, SCI.cyan, on, 0.8);
    lamp(c, x + 55, y + 38 + i * 6, SCI.cyan, on, 0.8);
  }
  lamp(c, x + 6, y - 2, statusColor(m), true, 1.2);
  // rover count badge
  const n = m.bots.length;
  if (n > 1) {
    rrect(c, x + 47, y - 30, 10, 8, 3); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = SCI.cyan; c.font = '900 6.5px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x + 52, y - 25.8);
  }
}

function knobWheel(c: C, x: number, y: number, r: number, roll: number) {
  c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fillStyle = '#2b2440'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = '#4a4068';
  for (let i = 0; i < 8; i++) {
    const a = roll + (i / 8) * 6.28;
    c.save(); c.translate(x + Math.cos(a) * r, y + Math.sin(a) * r); c.rotate(a);
    c.fillRect(-1, -1.3, 2, 2.6); c.restore();
  }
  c.beginPath(); c.arc(x, y, r * 0.48, 0, 6.28); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
  c.fillStyle = SCI.shell; c.beginPath(); c.arc(x, y, r * 0.18, 0, 6.28); c.fill();
}

function drawRover(c: C, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const x = b.x * TILE, y = b.y * TILE;
  const working = b.state === BOT_WORK;
  const moving = b.state === BOT_GO || b.state === BOT_RETURN;
  const ang = b.angle;
  const bob = moving ? Math.abs(Math.sin(time * 14 + b.anim)) * 0.8 : 0;
  groundShadow(c, x + 2, y + 5, 18, 10, 0.4);
  c.save();
  c.translate(x, y - bob);
  c.rotate(ang);
  // headlight cones
  if (moving || working) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(c, 14, 0, 34, 0, [[0, 'rgba(255,240,180,0.35)'], [1, 'rgba(255,240,180,0)']]);
    for (const sy of [-5, 5]) { c.beginPath(); c.moveTo(13, sy); c.lineTo(34, sy - 7); c.lineTo(34, sy + 7); c.closePath(); c.fill(); }
    c.restore();
  }
  // wheels (knobby, rolling)
  const roll = moving ? time * 9 : working ? time * 2 : 0;
  for (const [wx, wy] of [[-8, -10], [6, -10], [-8, 10], [6, 10]]) knobWheel(c, wx, wy, 4.4, roll);
  // chassis
  rrect(c, -14, -8, 26, 16, 5); c.fillStyle = SCI.shell; c.fill();
  c.save(); rrect(c, -14, -8, 26, 16, 5); c.clip();
  c.fillStyle = shade(SCI.shell, -0.15); c.fillRect(-14, 3, 26, 6);
  c.fillStyle = SCI.teal; c.fillRect(-14, -1.2, 26, 2.4);
  c.restore();
  rrect(c, -14, -8, 26, 16, 5); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  // hopper on top: glass box with what it carries
  rrect(c, -12, -6, 13, 12, 3); c.fillStyle = 'rgba(200,240,255,0.3)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  if (b.carryTotal > 0) {
    let m1 = 0, m2 = -1;
    for (let k = 1; k < MAT_COUNT; k++) if (b.carry[k] > b.carry[m1]) m1 = k;
    for (let k = 0; k < MAT_COUNT; k++) if (k !== m1 && b.carry[k] > 0 && (m2 < 0 || b.carry[k] > b.carry[m2])) m2 = k;
    c.save(); c.rotate(-ang);
    const hx = Math.cos(ang) * -5.5, hy = Math.sin(ang) * -5.5;
    if (m2 >= 0) drawMatIcon(c, m2, hx + 2.4, hy + 1.6, 6);
    drawMatIcon(c, m1, hx - 1.2, hy - 0.6, 7.5);
    c.restore();
  }
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-11, -5, 3, 1.4);
  // cab with a cute eye
  c.beginPath(); c.arc(5, 0, 5, 0, 6.28); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.beginPath(); c.arc(6, 0, 3.2, 0, 6.28); c.fillStyle = '#16122a'; c.fill();
  c.fillStyle = working ? SCI.gold : SCI.cyan; c.beginPath(); c.arc(6.6, 0, 1.7, 0, 6.28); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(6, -0.7, 0.55, 0, 6.28); c.fill();
  // headlights
  lamp(c, 12.5, -5, '#fff2c0', moving || working, 1.1); lamp(c, 12.5, 5, '#fff2c0', moving || working, 1.1);
  // front sweeper reel (spins while working)
  rrect(c, 13, -10, 3, 20, 1.4); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
  const spin = working ? time * 14 : moving ? time * 3 : 0;
  rrect(c, 16, -11, 7, 22, 3.4); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.save(); rrect(c, 16, -11, 7, 22, 3.4); c.clip();
  c.strokeStyle = SCI.orangeD; c.lineWidth = 1.4;
  for (let i = -3; i < 8; i++) { const yy = -11 + (((i * 4 + spin * 4) % 26) + 26) % 26; c.beginPath(); c.moveTo(16, yy); c.lineTo(23, yy - 3); c.stroke(); }
  c.restore();
  // antenna flag
  c.strokeStyle = INK; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-10, 6); c.lineTo(-14, 11); c.stroke();
  c.fillStyle = SCI.cyan; c.beginPath(); c.arc(-14, 11, 1, 0, 6.28); c.fill();
  c.restore();
  if (onScreen) {
    if (working && Math.random() < 0.45) fx.burst(x + Math.cos(ang) * 20, y + Math.sin(ang) * 20, 'dust', 1);
    if (moving && Math.random() < 0.18) fx.burst(x - Math.cos(ang) * 14, y - Math.sin(ang) * 14 + 6, 'dust', 1);
  }
}

// =====================================================================================================
// SEISMIC DRILL (3x3) — derrick tower, spinning bit, ground pulses
// =====================================================================================================
function drillBase(level: number) {
  return cachedLayer(`drill1-${level}`, -14, -78, 126, 192, (c) => {
    groundShadow(c, 48, 90, 54, 14, 0.45);
    // cracked ground around the bore
    c.strokeStyle = 'rgba(30,18,40,0.55)'; c.lineWidth = 1.2; c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.28 + 0.3;
      let px = 48 + Math.cos(a) * 30, py = 66 + Math.sin(a) * 18;
      c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < 3; k++) { px += Math.cos(a + (k % 2 ? 0.5 : -0.4)) * 7; py += Math.sin(a + (k % 2 ? 0.5 : -0.4)) * 4; c.lineTo(px, py); }
      c.stroke();
    }
    // octagonal deck
    const oct = (oy: number, r: number) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + Math.PI / 8; c.lineTo(48 + Math.cos(a) * r, 64 + oy + Math.sin(a) * r * 0.55); } c.closePath(); };
    oct(4, 46); c.fillStyle = SCI.violetD; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    oct(0, 46); c.fillStyle = '#5b4f80'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.save(); oct(0, 46); c.clip();
    c.strokeStyle = SCI.orange; c.lineWidth = 3; c.setLineDash([5, 5]); oct(0, 40); c.stroke(); c.setLineDash([]);
    c.restore();
    // bore hole
    ellipse(c, 48, 66, 13, 7); c.fillStyle = '#120d1e'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    ellipse(c, 48, 66, 13, 7); c.strokeStyle = SCI.cyanD; c.lineWidth = 1; c.stroke();
    // derrick legs (lattice)
    const legs: [number, number][] = [[18, 60], [78, 60], [30, 50], [66, 50]];
    for (const [lx, ly] of legs) {
      c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(lx, ly); c.lineTo(48 + (lx - 48) * 0.18, -50); c.stroke();
      c.strokeStyle = lx < 48 ? SCI.shell : SCI.shellD; c.lineWidth = 2.4; c.beginPath(); c.moveTo(lx, ly); c.lineTo(48 + (lx - 48) * 0.18, -50); c.stroke();
    }
    // cross braces
    c.strokeStyle = SCI.orange; c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const t0 = i / 4, t1 = (i + 1) / 4;
      const L = (t: number, lx: number) => 48 + (lx - 48) * (1 - t * 0.82);
      const Y = (t: number) => 60 - t * 110;
      c.beginPath(); c.moveTo(L(t0, 18), Y(t0)); c.lineTo(L(t1, 78), Y(t1)); c.moveTo(L(t0, 78), Y(t0)); c.lineTo(L(t1, 18), Y(t1)); c.stroke();
    }
    // crown block
    rrect(c, 36, -60, 24, 12, 3); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    hazardStripes(c, 36, -50, 24, 3, SCI.orange, SCI.violetD);
    lamp(c, 48, -64, '#ff5050', true, 1.4);
    // power house on the side
    shell(c, 78, 20, 20, 30, SCI.shell, 5);
    glass(c, 82, 25, 12, 8, '#173246', 2);
    vent(c, 81, 38, 14, 8, 3);
    cable(c, 80, 30, 58, 48, 6, SCI.violet, 1.6);
    // hopper bin on the other side
    poly(c, [-6, 24, 18, 24, 15, 50, -3, 50]); c.fillStyle = SCI.teal; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.fillStyle = '#17132a'; poly(c, [-3, 26, 15, 26, 13, 31, -1, 31]); c.fill();
    stencil(c, 'SÍSMICA', 6, 42, 3.4, 'rgba(0,40,36,0.85)');
    levelPips(c, 48, 98, level);
  });
}

function drawDrill(c: C, m: Machine, x: number, y: number, time: number, working: boolean, fx: Effects, onScreen: boolean) {
  // seismic rings on the ground (behind the tower)
  if (working) {
    for (let i = 0; i < 3; i++) {
      const k = ((time / 1.2) + i / 3) % 1;
      c.strokeStyle = `rgba(95,242,255,${0.55 * (1 - k)})`; c.lineWidth = 2 * (1 - k) + 0.5;
      ellipse(c, x + 48, y + 66, 14 + k * 70, 7 + k * 38); c.stroke();
    }
  }
  blit(c, drillBase(m.level), x, y);
  // drill string + spinning bit going down into the bore
  const spin = working ? time * 9 : 0;
  const plunge = working ? Math.sin(time * 5) * 2 : 0;
  rrect(c, x + 45.5, y - 46, 5, 104 + plunge, 1.5); c.fillStyle = '#b9c2c7'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  c.save(); rrect(c, x + 45.5, y - 46, 5, 104 + plunge, 1.5); c.clip();
  c.strokeStyle = 'rgba(40,30,60,0.45)'; c.lineWidth = 1;
  for (let i = -2; i < 30; i++) { const yy = y - 46 + (((i * 4 + spin * 6) % 108) + 108) % 108; c.beginPath(); c.moveTo(x + 45, yy); c.lineTo(x + 51, yy + 2.5); c.stroke(); }
  c.restore();
  // rotary table
  ellipse(c, x + 48, y + 58 + plunge, 9, 4.5); c.fillStyle = SCI.orange; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  for (let i = 0; i < 4; i++) { const a = spin + i * 1.57; c.fillStyle = SCI.orangeD; c.beginPath(); c.arc(x + 48 + Math.cos(a) * 6.5, y + 58 + plunge + Math.sin(a) * 3.2, 1.2, 0, 6.28); c.fill(); }
  // pistons pumping on both sides
  for (const sx of [24, 72]) {
    const ext = working ? (Math.sin(time * 5 + (sx > 48 ? 1.6 : 0)) + 1) * 3 : 0;
    rrect(c, x + sx - 3, y + 24, 6, 18, 2); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
    rrect(c, x + sx - 1.4, y + 14 - ext, 2.8, 12 + ext, 1); c.fillStyle = '#d6dde2'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.7; c.stroke();
  }
  // hopper contents
  if (m.bufferTotal > 0) {
    let mi = 0;
    for (let k = 1; k < MAT_COUNT; k++) if (m.buffer[k] > m.buffer[mi]) mi = k;
    drawMatIcon(c, mi, x + 6, y + 27, 9);
  }
  lamp(c, x + 88, y + 18, statusColor(m), Math.sin(time * 4 + m.id) > -0.3, 1.4);
  if (working && onScreen) {
    if (Math.random() < 0.3) fx.burst(x + 48 + (Math.random() - 0.5) * 20, y + 66, 'dust', 1);
    if (Math.random() < 0.03) fx.shake(0.25);
  }
}

// =====================================================================================================
// VORTEX — ancient emitter + roaming plasma whirl
// =====================================================================================================
const vortexBase = () => cachedLayer('vortex1', -10, -52, 86, 124, (c) => {
  groundShadow(c, 32, 58, 34, 10, 0.42);
  // jade ancient plinth
  const JADE = '#3fae8f', JADED = '#1f6b58';
  const hex = (oy: number, r: number) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.PI / 6; c.lineTo(32 + Math.cos(a) * r, 46 + oy + Math.sin(a) * r * 0.55); } c.closePath(); };
  hex(6, 34); c.fillStyle = JADED; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  hex(0, 34); c.fillStyle = JADE; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  hex(0, 24); c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  // glyphs on the rim
  c.strokeStyle = 'rgba(160,255,230,0.75)'; c.lineWidth = 0.9;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + 0.52;
    const gx = 32 + Math.cos(a) * 29, gy = 46 + Math.sin(a) * 16;
    c.beginPath(); c.moveTo(gx - 2, gy - 1); c.lineTo(gx, gy + 1.5); c.lineTo(gx + 2, gy - 1); c.moveTo(gx, gy - 2); c.lineTo(gx, gy + 1.5); c.stroke();
  }
  // three violet pylons
  for (const [px, py] of [[10, 40], [54, 40], [32, 30]] as [number, number][]) {
    c.beginPath(); c.moveTo(px - 4, py + 6); c.lineTo(px - 2.4, py - 20); c.lineTo(px, py - 25); c.lineTo(px + 2.4, py - 20); c.lineTo(px + 4, py + 6); c.closePath();
    c.fillStyle = SCI.violet; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(px - 2.6, py + 4); c.lineTo(px - 1.6, py - 19); c.lineTo(px - 0.4, py - 19); c.lineTo(px - 1, py + 4); c.closePath(); c.fill();
    c.fillStyle = JADE; c.fillRect(px - 2.4, py - 8, 4.8, 2.4);
  }
  // emitter socket
  ellipse(c, 32, 44, 12, 6); c.fillStyle = '#120d1e'; c.fill(); c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke();
  ellipse(c, 32, 44, 9, 4.4); c.strokeStyle = SCI.cyan; c.lineWidth = 1; c.stroke();
});

function drawVortexEmitter(c: C, m: Machine, x: number, y: number, time: number) {
  blit(c, vortexBase(), x, y);
  const cx = x + 32, cy = y + 4;
  // floating ring
  const fl = Math.sin(time * 2) * 2.5;
  c.save(); c.translate(cx, cy + fl); c.rotate(Math.sin(time * 0.8) * 0.25);
  ellipse(c, 0, 0, 15, 5.5); c.strokeStyle = INK; c.lineWidth = 4.4; c.stroke();
  ellipse(c, 0, 0, 15, 5.5); c.strokeStyle = SCI.gold; c.lineWidth = 2.6; c.stroke();
  for (let i = 0; i < 6; i++) { const a = time * 2 + i * 1.05; c.fillStyle = SCI.cyan; c.beginPath(); c.arc(Math.cos(a) * 15, Math.sin(a) * 5.5, 0.9, 0, 6.28); c.fill(); }
  c.restore();
  // core: big when idle (the whirl collapses home), small when the whirl is out
  const idle = m.status !== 'working' || !m.bots.length;
  const r = idle ? 6 + Math.sin(time * 4) * 0.8 : 3.4;
  glow(c, cx, cy + fl, r * 3, idle ? SCI.cyan : '#c084fc', 0.45);
  c.beginPath(); c.arc(cx, cy + fl, r, 0, 6.28);
  c.fillStyle = rad(c, cx - r * 0.3, cy + fl - r * 0.3, 0, r, [[0, '#ffffff'], [0.45, SCI.cyan], [1, '#7c3aed']]); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
  // pylon tips spark toward the core
  for (const [px, py] of [[10, 15], [54, 15], [32, 5]] as [number, number][]) lamp(c, x + px, y + py, SCI.cyan, Math.sin(time * 6 + px) > -0.2, 1);
  lamp(c, x + 60, y + 40, statusColor(m), true, 1.1);
}

function drawVortex(c: C, m: Machine, b: Bot, time: number, fx: Effects, onScreen: boolean) {
  const ex = (m.tx + 1) * TILE, ey = (m.ty + 0.1) * TILE;
  const x = b.x * TILE, y = b.y * TILE;
  const working = m.status === 'working';
  if (!working) return; // idle: the emitter shows the collapsed orb
  // energy tether from the emitter
  c.save(); c.globalCompositeOperation = 'lighter';
  const wob = (t: number) => Math.sin(time * 9 + t * 12) * 3;
  c.strokeStyle = 'rgba(192,132,252,0.55)'; c.lineWidth = 3.2;
  c.beginPath();
  for (let i = 0; i <= 14; i++) { const t = i / 14; const px = ex + (x - ex) * t, py = ey + (y - 18 - ey) * t - Math.sin(t * Math.PI) * 16; i ? c.lineTo(px + wob(t), py) : c.moveTo(px, py); }
  c.stroke();
  c.strokeStyle = 'rgba(200,250,255,0.8)'; c.lineWidth = 1;
  c.stroke();
  c.restore();
  groundShadow(c, x, y + 4, 20, 8, 0.35);
  // ground swirl
  c.save(); c.translate(x, y + 2); c.scale(1, 0.45);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = `rgba(95,242,255,${0.35 - i * 0.08})`; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, 10 + i * 6, time * 4 + i, time * 4 + i + 3.6); c.stroke();
  }
  c.restore();
  // the funnel: stacked rotating ellipses, wide at the top
  c.save();
  c.globalCompositeOperation = 'lighter';
  const H = 40;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const yy = y - t * H;
    const rx = 4 + t * t * 16;
    const sway = Math.sin(time * 3 + t * 4) * (2 + t * 4);
    const a0 = time * (7 - t * 3) + i;
    c.strokeStyle = i % 2 ? `rgba(192,132,252,${0.75 - t * 0.3})` : `rgba(95,242,255,${0.8 - t * 0.3})`;
    c.lineWidth = 2.2 - t * 0.8;
    c.beginPath(); c.ellipse(x + sway, yy, rx, rx * 0.32, 0, a0, a0 + 4.4); c.stroke();
  }
  glow(c, x, y - 6, 16, '#a78bfa', 0.35);
  c.restore();
  // debris orbiting and being sucked up: material icons spiralling
  for (let i = 0; i < 4; i++) {
    const k = ((time * 0.6 + i / 4 + m.id * 0.1) % 1);
    const a = time * 5 + i * 1.6;
    const rr = 6 + k * 14;
    const ix = x + Math.cos(a) * rr + Math.sin(time * 3 + k * 4) * (2 + k * 4);
    const iy = y - k * H + Math.sin(a) * rr * 0.3;
    drawMatIcon(c, (i + m.id) % 5, ix, iy, 6 + (1 - k) * 2);
  }
  // bright eye of the storm
  c.beginPath(); c.arc(x, y - H - 2, 3, 0, 6.28); c.fillStyle = '#fff'; c.fill();
  glow(c, x, y - H - 2, 9, SCI.cyan, 0.5);
  if (onScreen && Math.random() < 0.6) fx.suck(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 22, x, y - 10, Math.floor(Math.random() * 5), 0.4);
}
