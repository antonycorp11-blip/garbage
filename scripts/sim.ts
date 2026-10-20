// Headless balance bot: plays the game greedily and prints progression timings.
import { Game, InputState } from '../src/game/Game';
import { CENTER, TILE, WORLD_TILES, tileIndex, inWorld } from '../src/core/constants';
import { MACHINES, MachineType } from '../src/data/machines';
import { TOOLS } from '../src/data/tools';
import { UPGRADES, upgradeCost } from '../src/data/upgrades';
import { centerX, centerY, hubRadius, isHub } from '../src/game/Machines';

import { mulberry } from '../src/core/rng';
Math.random = mulberry(Number(process.argv[3] || 1));
const MINUTES = Number(process.argv[2] || 60);
const g = new Game();
const dt = 1 / 15;
let t = 0;
const log = (s: string) => console.log(`[${(t / 60).toFixed(1).padStart(5)} min] ${s}`);
let mode: 'collect' | 'unload' = 'collect';
let target = -1;
const firsts = new Set<string>();
const first = (k: string, s: string) => { if (!firsts.has(k)) { firsts.add(k); log(s); } };

function nearestDirty(): number {
  const p = g.player;
  let best = -1, bd = Infinity;
  const R = 40;
  for (let y = Math.max(0, Math.floor(p.ty) - R); y < Math.min(WORLD_TILES, Math.floor(p.ty) + R); y++)
    for (let x = Math.max(0, Math.floor(p.tx) - R); x < Math.min(WORLD_TILES, Math.floor(p.tx) + R); x++) {
      const i = tileIndex(x, y);
      if (!g.world.garbage[i] || (!g.canLiftHeavy && g.world.lightAvailable(i) === 0)) continue;
      const d = (x + 0.5 - p.tx) ** 2 + (y + 0.5 - p.ty) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  return best;
}

function placeNearHub(type: MachineType): boolean {
  const s = MACHINES[type].size;
  const hubs = g.machines.hubs();
  for (const h of hubs) {
    const r = Math.floor(hubRadius(h, g.d)) - 1;
    const cands: [number, number, number][] = [];
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const tx = Math.floor(centerX(h)) + x, ty = Math.floor(centerY(h)) + y;
      if (Math.hypot(x, y) > r) continue;
      if (!g.placeProblem(type, tx, ty)) {
        // prefer spots with lots of garbage around
        let around = 0;
        for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) if (inWorld(tx + xx, ty + yy)) around += g.world.garbage[tileIndex(tx + xx, ty + yy)];
        cands.push([tx, ty, around]);
      }
    }
    cands.sort((a, b) => b[2] - a[2]);
    for (const [tx, ty] of cands) if (!g.build(type, tx, ty)) return true;
  }
  return false;
}

// conveyor spines leaving the depot in four directions
const SPINES = [
  { x: CENTER + 2, y: CENTER, dx: 1, dy: 0, dir: 2 },
  { x: CENTER - 2, y: CENTER, dx: -1, dy: 0, dir: 0 },
  { x: CENTER, y: CENTER - 2, dx: 0, dy: -1, dir: 1 },
  { x: CENTER, y: CENTER + 2, dx: 0, dy: 1, dir: 3 },
];
const spineLen = [0, 0, 0, 0];
function extendSpines() {
  if (!g.isUnlocked('conveyor')) return;
  SPINES.forEach((sp, k) => {
    for (let n = 0; n < 6; n++) {
      const x = sp.x + sp.dx * spineLen[k], y = sp.y + sp.dy * spineLen[k];
      const m = g.machines.at(x, y);
      if (m && m.type === 'conveyor') { spineLen[k]++; continue; }
      if (g.build('conveyor', x, y, sp.dir)) return;
      spineLen[k]++;
    }
  });
}
function placeOnSpine(type: MachineType): boolean {
  const s = MACHINES[type].size;
  const cands: [number, number, number][] = [];
  SPINES.forEach((sp, k) => {
    for (let i = 2; i < spineLen[k]; i++) {
      const x = sp.x + sp.dx * i, y = sp.y + sp.dy * i;
      const opts = sp.dx ? [[x, y - s], [x, y + 1]] : [[x - s, y], [x + 1, y]];
      for (const [tx, ty] of opts) {
        if (g.placeProblem(type, tx, ty)) continue;
        let around = 0;
        for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) if (inWorld(tx + xx, ty + yy)) around += g.world.garbage[tileIndex(tx + xx, ty + yy)];
        cands.push([tx, ty, around]);
      }
    }
  });
  cands.sort((a, b) => b[2] - a[2]);
  for (const [tx, ty] of cands.slice(0, 5)) if (!g.build(type, tx, ty)) return true;
  return false;
}

// like a real player now: build where the action is and auto-connect with conveyors
function placeAtFront(type: MachineType): boolean {
  const p = g.player;
  const spot = g.findSpot(type, p.tx, p.ty);
  if (!spot) return false;
  if (g.build(type, spot.tx, spot.ty)) return false;
  const m = g.machines.at(spot.tx, spot.ty)!;
  g.machines.relink();
  if (!m.inService && g.isUnlocked('conveyor')) {
    if (g.connectToDepot(m)) { g.demolish(m); return false; }
  } else if (!m.inService) { g.demolish(m); return false; }
  return true;
}

const prio = ['c_bag', 'c_speed', 'a_arm', 'r_value', 'c_unload', 'a_speed', 'c_force', 'c_move', 'r_depot', 'a_buffer', 'c_auto', 'a_radius', 'c_reach', 'a_belts', 'c_remote', 'r_rare', 'c_treasure', 'a_robots', 'a_robotcount', 'r_sep', 'r_discount', 'a_crusher', 'r_metal', 'a_excav', 'r_sepbonus', 'r_center', 'a_integr', 'c_radar', 'r_quality', 'c_orbital'];

function relocateIdle() {
  const p = g.player;
  const idle = g.machines.machines.find((m) => (m.type === 'collector' || m.type === 'arm' || m.type === 'robots' || m.type === 'excavator') && m.status === 'idle' && m.built >= 1);
  if (!idle) return;
  const info = g.pickUp(idle)!;
  const spot = g.findSpot(info.type, p.tx, p.ty);
  if (!spot || g.placeMoved(info.type, spot.tx, spot.ty, info.level, info.dir)) { g.placeMoved(info.type, info.tx, info.ty, info.level, info.dir, true); return; }
  const m = g.machines.at(spot.tx, spot.ty)!;
  g.machines.relink();
  if (!m.inService && g.isUnlocked('conveyor')) g.connectToDepot(m);
}

function upgradeMachines() {
  for (const m of g.machines.machines) {
    if (m.level < 5 && ['collector', 'arm', 'robots', 'excavator', 'crusher'].includes(m.type) && !g.upgradeMachine(m)) return;
  }
}

function shop() {
  // processing: keep the depot yard flowing
  if (g.yardTotal > g.yardCap() * 0.6 && g.isUnlocked('crusher') && g.missingFor(g.machineCost('crusher'))) return; // save up
  if (g.yardTotal > g.yardCap() * 0.6 && g.isUnlocked('crusher') && !g.missingFor(g.machineCost('crusher'))) {
    const d = g.depot;
    const spot = g.findSpot('crusher', d.tx + 1.5, d.ty + 1.5);
    if (spot && !g.build('crusher', spot.tx, spot.ty)) { first('mcrusher', 'primeiro triturador'); return; }
  }
  extendSpines();
  relocateIdle();
  if (Math.random() < 0.3) upgradeMachines();
  // tools
  const nt = g.toolTier + 1;
  if (nt < TOOLS.length && g.money >= g.toolCost(nt)) { g.buyTool(nt); log(`ferramenta: ${TOOLS[nt].name}`); return; }
  // machines (keep a ratio)
  for (const type of ['excavator', 'robots', 'arm', 'collector'] as MachineType[]) {
    if (!g.isUnlocked(type)) continue;
    if (g.missingFor(g.machineCost(type))) continue;
    if (placeAtFront(type) || placeOnSpine(type) || placeNearHub(type)) { first('m' + type, `primeira máquina: ${MACHINES[type].name}`); return; }
  }
  // cheapest affordable upgrade from priority list
  let best: string | null = null, bc = Infinity;
  for (const id of prio) {
    if (g.canBuyUpgrade(id)) continue;
    const u = UPGRADES.find((x) => x.id === id)!;
    const c = upgradeCost(u, g.upgrades[id] || 0);
    if (c < bc) { bc = c; best = id; }
  }
  if (best) { g.buyUpgrade(best); first('u' + best, `melhoria: ${best}`); }
  // recycling center
  if (g.isUnlocked('recycler') && !g.missingFor(g.machineCost('recycler'))) {
    for (let k = 0; k < 400; k++) {
      const tx = CENTER + Math.floor((Math.random() - 0.5) * 60), ty = CENTER + Math.floor((Math.random() - 0.5) * 60);
      if (!g.build('recycler', tx, ty)) { log('central de reciclagem construída'); break; }
    }
  }
}

let stuckT = 0, side = 1;
let nextReport = 5 * 60;
let shopT = 0;
while (t < MINUTES * 60 && g.remaining > 0) {
  const p = g.player;
  const inp: InputState = { moveX: 0, moveY: 0, collect: false, interact: false, aim: null };
  if (mode === 'collect' && p.carried >= g.d.capacity) mode = 'unload';
  if (mode === 'unload' && p.carried === 0) mode = 'collect';
  if (mode === 'unload') {
    const h = g.machines.nearestHub(p.tx, p.ty)!;
    const dx = centerX(h) - p.tx, dy = centerY(h) + 2 - p.ty;
    const l = Math.hypot(dx, dy);
    if (l > 0.5) { inp.moveX = dx / l; inp.moveY = dy / l; }
  } else {
    if (target < 0 || g.world.garbage[target] === 0 || Math.random() < 0.02) target = nearestDirty();
    if (target >= 0) {
      const tx = (target % WORLD_TILES) + 0.5, ty = Math.floor(target / WORLD_TILES) + 0.5;
      const dx = tx - p.tx, dy = ty - p.ty;
      const l = Math.hypot(dx, dy);
      const reach = g.tool.mode === 'single' ? g.tool.reach * g.d.reachMult : g.tool.reach + g.tool.radius * 0.6;
      inp.aim = { x: tx * TILE, y: ty * TILE };
      if (l > reach * 0.8) { inp.moveX = dx / l; inp.moveY = dy / l; }
      inp.collect = l < reach + 1.5;
    }
  }
  if (stuckT > 0) { stuckT -= dt; const ox = inp.moveX; inp.moveX = -inp.moveY * side + ox * 0.3; inp.moveY = ox * side + inp.moveY * 0.3; }
  const bx = p.x, by = p.y;
  g.update(dt, inp);
  if ((inp.moveX || inp.moveY) && Math.hypot(p.x - bx, p.y - by) < 0.01) { stuckT = 0.8; side = Math.random() < 0.5 ? 1 : -1; }
  // stuck detection: teleport-free nudge
  shopT -= dt;
  if (shopT <= 0) { shopT = 2; shop(); }
  t += dt;
  if (t >= nextReport) {
    nextReport += 5 * 60;
    if (0) log(`pos ${g.player.tx.toFixed(1)},${g.player.ty.toFixed(1)} mode ${mode} carried ${g.player.carried} target ${target} ms ${g.machines.machines.map(m=>m.type+":"+m.status).join(",")}`);
    log(`máquinas fizeram ${(100 * g.stats.removedMachines / Math.max(1, g.removed)).toFixed(0)}% · pátio ${Math.round(g.yardTotal)}/${g.yardCap()} @${g.processRate()}/s · removido ${g.removed} (${(g.removed / 1e4).toFixed(2)}%) · ${g.ratePerSec.toFixed(1)}/s · $${Math.round(g.money)} · máquinas ${g.machines.machines.filter((m) => !isHub(m.type)).length} · ferramenta ${g.toolTier + 1} · mochila ${g.d.capacity}`);
  }
  g.events.length = 0;
}
log(`FIM: removido ${g.removed}, restante ${g.remaining}`);
