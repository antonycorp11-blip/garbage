import { DX, DY, TILE, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { MAT_COUNT, emptyMats } from '../data/materials';
import { MACHINES, MachineType } from '../data/machines';
import { World } from '../world/World';
import { Derived } from './derived';
import { FX } from './fx';

export interface Packet { mat: number; units: number; sorted: boolean; t: number }

export const BOT_IDLE = 0, BOT_GO = 1, BOT_WORK = 2, BOT_RETURN = 3;
export interface Bot {
  x: number; y: number; state: number; target: number; carry: number[]; carryTotal: number; work: number; angle: number; anim: number;
}

export type MachineStatus = 'working' | 'idle' | 'full' | 'ok';

export interface Machine {
  id: number;
  type: MachineType;
  tx: number;
  ty: number;
  dir: number;
  level: number;
  buffer: number[];
  bufferTotal: number;
  work: number;
  cursor: number;
  collected: number;
  belt: Packet[];
  bots: Bot[];
  status: MachineStatus;
  /** drones bought for this hangar */
  extra: number;
  // runtime only
  targets: Int32Array | null;
  targetsRadius: number;
  anim: number;
  lastTarget: number;
  outConveyor: number;
  inService: boolean;
  linked: boolean;
  deliverT: number;
  built: number;
  /** render offset (tiles) while a collector drives to a new spot */
  ox: number;
  oy: number;
  /** where a roaming collector was built: it stays around here */
  anchorX: number;
  anchorY: number;
  idleT: number;
}

export interface MachineHost {
  world: World;
  d: Derived;
  fx: FX;
  deliver(mats: number[], sortedFrac: number, fromX: number, fromY: number, direct?: boolean): void;
  /** free units in the depot yard */
  yardSpace(): number;
  yardBusy(): boolean;
  isVisible(x: number, y: number): boolean;
  onMachineRemoved(n: number): void;
}

const SPACING = 0.34;
const PACKET_UNITS = 10;
const SERVICE_RATE = 40;
const BOT_CAPACITY = 24;
const BOT_SPEED = 2.6;
const EXC_SPEED = 2.1;
const EXC_CAPACITY = 1500;

export function machineRate(m: Machine, d: Derived): number {
  return MACHINES[m.type].rate * (1 + 0.5 * (m.level - 1)) * d.machineSpeed;
}
export function machineRadius(m: Machine, d: Derived): number {
  const def = MACHINES[m.type];
  return (def.radius + (m.level - 1) * (m.type === 'robots' || m.type === 'excavator' ? 1.5 : 0.35)) * d.machineRadiusMult;
}
export function machineBufferCap(m: Machine, d: Derived): number {
  return Math.round(MACHINES[m.type].buffer * (1 + 0.3 * (m.level - 1)) * d.bufferMult);
}
/** drones a hangar can buy on top of its own */
export const MAX_EXTRA_DRONES = 4;
export function botCount(m: Machine, d: Derived): number {
  if (m.type === 'excavator') return 1;
  if (m.type !== 'robots') return 0;
  return 2 + (m.level - 1) + d.extraRobots + m.extra;
}
export function botCapacity(m: Machine, d: Derived): number {
  return Math.round((m.type === 'excavator' ? EXC_CAPACITY : BOT_CAPACITY) * (1 + 0.3 * (m.level - 1)) * d.bufferMult);
}
export function hubRadius(m: Machine, d: Derived): number {
  return MACHINES[m.type].radius + d.serviceBonus;
}
export const isHub = (t: MachineType) => t === 'depot' || t === 'recycler' || t === 'beacon';
export const isBelt = (t: MachineType) => t === 'conveyor' || t === 'separator';
export const centerX = (m: Machine) => m.tx + MACHINES[m.type].size / 2;
export const centerY = (m: Machine) => m.ty + MACHINES[m.type].size / 2;

export class MachineSystem {
  machines: Machine[] = [];
  byId = new Map<number, Machine>();
  nextId = 1;
  reserved = new Set<number>();
  linksDirty = true;
  host: MachineHost;
  /** removal totals since last read, for stats */
  removedAcc = 0;

  constructor(host: MachineHost) {
    this.host = host;
  }

  create(type: MachineType, tx: number, ty: number, dir = 0, level = 1, id?: number): Machine {
    const m: Machine = {
      id: id ?? this.nextId++, type, tx, ty, dir, level, buffer: emptyMats(), bufferTotal: 0, work: 0, cursor: 0, collected: 0,
      belt: [], bots: [], status: 'idle', targets: null, targetsRadius: 0, anim: Math.random() * 10, lastTarget: -1,
      outConveyor: -1, inService: false, linked: false, deliverT: 0, built: 0, extra: 0,
      ox: 0, oy: 0, anchorX: tx, anchorY: ty, idleT: 0,
    };
    if (id !== undefined) this.nextId = Math.max(this.nextId, id + 1);
    const size = MACHINES[type].size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) this.host.world.occupant[tileIndex(tx + x, ty + y)] = m.id;
    this.machines.push(m);
    this.byId.set(m.id, m);
    this.linksDirty = true;
    return m;
  }

  remove(m: Machine) {
    const size = MACHINES[m.type].size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) this.host.world.occupant[tileIndex(m.tx + x, m.ty + y)] = -1;
    for (const b of m.bots) if (b.target >= 0) this.reserved.delete(b.target);
    this.machines.splice(this.machines.indexOf(m), 1);
    this.byId.delete(m.id);
    this.linksDirty = true;
    this.host.onMachineRemoved(m.id);
  }

  /** Moves a machine to another free spot (the drawing slides over). */
  relocate(m: Machine, tx: number, ty: number) {
    const size = MACHINES[m.type].size;
    const w = this.host.world;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) w.occupant[tileIndex(m.tx + x, m.ty + y)] = -1;
    m.ox += m.tx - tx; m.oy += m.ty - ty;
    m.tx = tx; m.ty = ty;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) w.occupant[tileIndex(tx + x, ty + y)] = m.id;
    m.targets = null;
    m.idleT = 0;
    this.linksDirty = true;
  }

  at(tx: number, ty: number): Machine | undefined {
    if (!inWorld(tx, ty)) return undefined;
    const id = this.host.world.occupant[tileIndex(tx, ty)];
    return id >= 0 ? this.byId.get(id) : undefined;
  }

  count(type: MachineType) {
    let n = 0;
    for (const m of this.machines) if (m.type === type) n++;
    return n;
  }

  hubs() { return this.machines.filter((m) => isHub(m.type)); }

  nearestHub(x: number, y: number): Machine | undefined {
    let best: Machine | undefined, bd = Infinity;
    for (const m of this.machines) {
      if (!isHub(m.type)) continue;
      const d = (centerX(m) - x) ** 2 + (centerY(m) - y) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  /** Recompute service areas, conveyor outputs and whether conveyor lines reach a hub. */
  relink() {
    this.linksDirty = false;
    const d = this.host.d;
    const hubs = this.hubs();
    for (const m of this.machines) {
      m.inService = false; m.outConveyor = -1; m.linked = false;
      if (isHub(m.type) || isBelt(m.type)) continue;
      const cx = centerX(m), cy = centerY(m);
      for (const h of hubs) {
        if (Math.hypot(centerX(h) - cx, centerY(h) - cy) <= hubRadius(h, d)) { m.inService = true; break; }
      }
      const size = MACHINES[m.type].size;
      for (let i = 0; i < size && m.outConveyor < 0; i++) {
        const cands = [[m.tx + i, m.ty - 1], [m.tx + i, m.ty + size], [m.tx - 1, m.ty + i], [m.tx + size, m.ty + i]];
        for (const [x, y] of cands) {
          const c = this.at(x, y);
          if (!c || !isBelt(c.type)) continue;
          const nx = x + DX[c.dir], ny = y + DY[c.dir];
          if (nx >= m.tx && ny >= m.ty && nx < m.tx + size && ny < m.ty + size) continue;
          m.outConveyor = c.id;
          break;
        }
      }
      if (m.outConveyor >= 0) m.linked = this.traceToHub(this.byId.get(m.outConveyor)!);
    }
    for (const m of this.machines) if (isBelt(m.type)) m.linked = this.traceToHub(m);
  }

  traceToHub(start: Machine): boolean {
    let c: Machine | undefined = start;
    const seen = new Set<number>();
    while (c && isBelt(c.type)) {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      c = this.at(c.tx + DX[c.dir], c.ty + DY[c.dir]);
    }
    return !!c && isHub(c.type);
  }

  ensureTargets(m: Machine) {
    const r = machineRadius(m, this.host.d);
    if (!m.targets || Math.abs(m.targetsRadius - r) > 0.01) {
      m.targets = this.host.world.tilesInRadius(centerX(m), centerY(m), r);
      m.targetsRadius = r;
      m.cursor = 0;
    }
  }

  /** Units this machine can take from a tile (light machines leave the heavy base of dense piles). */
  avail(m: Machine, tile: number): number {
    const w = this.host.world;
    return MACHINES[m.type].heavy ? w.garbage[tile] : w.lightAvailable(tile);
  }

  /** Removes up to n units from the nearest dirty tiles of a machine's area into out. Returns removed. */
  harvest(m: Machine, n: number, out: number[]): number {
    this.ensureTargets(m);
    const t = m.targets!;
    let got = 0;
    let guard = 0;
    while (got < n && m.cursor < t.length && guard++ < 64) {
      const tile = t[m.cursor];
      if (this.avail(m, tile) === 0) { m.cursor++; continue; }
      if (this.reserved.has(tile)) {
        // skip reserved tiles without losing them
        let k = m.cursor + 1;
        while (k < t.length && (this.avail(m, t[k]) === 0 || this.reserved.has(t[k]))) k++;
        if (k >= t.length) break;
        got += this.take(m, t[k], n - got, out);
        break;
      }
      got += this.take(m, tile, n - got, out);
    }
    return got;
  }

  private take(m: Machine, tile: number, n: number, out: number[]): number {
    const w = this.host.world;
    const before = w.garbage[tile];
    const r = w.remove(tile, Math.min(n, this.avail(m, tile)), 'machine');
    if (r > 0) {
      w.rollMaterials(tile, r, this.host.d.rareChance, out);
      m.lastTarget = tile;
      this.removedAcc += r;
      const tx = tile % WORLD_TILES, ty = (tile / WORLD_TILES) | 0;
      if (this.host.isVisible((tx + 0.5) * TILE, (ty + 0.5) * TILE)) {
        this.host.fx.removed(tile, before, before - r, centerX(m) * TILE, centerY(m) * TILE);
      }
    }
    return r;
  }

  hasWork(m: Machine): boolean {
    this.ensureTargets(m);
    const t = m.targets!;
    while (m.cursor < t.length && this.avail(m, t[m.cursor]) === 0) m.cursor++;
    return m.cursor < t.length;
  }

  update(dt: number) {
    if (this.linksDirty) this.relink();
    const d = this.host.d;
    for (let i = 0; i < this.machines.length; i++) {
      const m = this.machines[i];
      m.anim += dt;
      m.built = Math.min(1, m.built + dt * 1.5);
      if (m.ox || m.oy) {
        // driving to a new spot: the drawing catches up with the real position
        const l = Math.hypot(m.ox, m.oy), step = 2.6 * dt;
        if (l <= step) { m.ox = 0; m.oy = 0; } else { m.ox -= (m.ox / l) * step; m.oy -= (m.oy / l) * step; }
      }
      switch (m.type) {
        case 'collector': case 'arm': case 'ancient': this.updateStatic(m, dt, d); m.idleT = m.status === 'idle' ? m.idleT + dt : 0; break;
        case 'crusher': m.status = this.host.yardBusy() ? 'working' : 'idle'; break;
        case 'robots': case 'excavator': this.updateBots(m, dt, d); break;
        case 'conveyor': case 'separator': this.updateBelt(m, dt, d); break;
        default: break;
      }
      if (m.bufferTotal > 0) this.deliverFrom(m, dt);
    }
  }

  private updateStatic(m: Machine, dt: number, d: Derived) {
    const cap = m.type === 'ancient' ? Infinity : machineBufferCap(m, d);
    if (m.bufferTotal >= cap) { m.status = 'full'; m.work = 0; return; }
    if (!this.hasWork(m)) { m.status = 'idle'; m.work = 0; return; }
    m.status = 'working';
    m.work += machineRate(m, d) * dt;
    let n = Math.floor(m.work);
    if (n <= 0) return;
    n = Math.min(n, cap - m.bufferTotal);
    m.work -= n;
    const out = emptyMats();
    const got = this.harvest(m, n, out);
    if (got > 0) {
      m.collected += got;
      if (m.type === 'ancient') {
        this.host.deliver(out, 0, centerX(m) * TILE, centerY(m) * TILE, true);
      } else {
        for (let k = 0; k < MAT_COUNT; k++) m.buffer[k] += out[k];
        m.bufferTotal += got;
      }
    }
  }

  private updateBots(m: Machine, dt: number, d: Derived) {
    const want = botCount(m, d);
    const sx = centerX(m), sy = centerY(m);
    while (m.bots.length < want) m.bots.push({ x: sx, y: sy, state: BOT_IDLE, target: -1, carry: emptyMats(), carryTotal: 0, work: 0, angle: 0, anim: Math.random() * 6 });
    while (m.bots.length > want) { const b = m.bots.pop()!; if (b.target >= 0) this.reserved.delete(b.target); }
    const cap = botCapacity(m, d);
    const rate = machineRate(m, d);
    const speed = (m.type === 'excavator' ? EXC_SPEED : BOT_SPEED) * Math.sqrt(d.machineSpeed);
    const bufCap = machineBufferCap(m, d);
    const w = this.host.world;
    let anyWork = false;
    for (const b of m.bots) {
      b.anim += dt;
      if (b.state === BOT_IDLE) {
        if (b.carryTotal > 0) { b.state = BOT_RETURN; continue; }
        const t = this.pickBotTarget(m);
        if (t >= 0) { b.target = t; this.reserved.add(t); b.state = BOT_GO; }
        else {
          // hover around the station
          b.x += (sx + Math.cos(b.anim * 0.7) * 0.8 - b.x) * Math.min(1, dt * 2);
          b.y += (sy - 0.6 + Math.sin(b.anim * 0.9) * 0.4 - b.y) * Math.min(1, dt * 2);
        }
      } else if (b.state === BOT_GO) {
        anyWork = true;
        const tx = (b.target % WORLD_TILES) + 0.5, ty = ((b.target / WORLD_TILES) | 0) + 0.5;
        if (this.moveBot(b, tx, ty, speed * dt)) b.state = BOT_WORK;
      } else if (b.state === BOT_WORK) {
        anyWork = true;
        b.work += rate * dt;
        let n = Math.floor(b.work);
        if (n > 0) {
          b.work -= n;
          n = Math.min(n, cap - b.carryTotal);
          const tiles = m.type === 'excavator' ? this.scoopTiles(b.target) : [b.target];
          let got = 0;
          for (const tile of tiles) {
            if (got >= n) break;
            const bb = w.garbage[tile];
            const r = w.remove(tile, Math.min(this.avail(m, tile), Math.ceil((n - got) / (tile === b.target ? 1 : 2))), 'machine');
            if (r > 0) {
              w.rollMaterials(tile, r, d.rareChance, b.carry);
              got += r;
              const ttx = tile % WORLD_TILES, tty = (tile / WORLD_TILES) | 0;
              if (this.host.isVisible((ttx + 0.5) * TILE, (tty + 0.5) * TILE)) this.host.fx.removed(tile, bb, bb - r, b.x * TILE, b.y * TILE);
            }
          }
          b.carryTotal += got;
          m.collected += got;
          this.removedAcc += got;
        }
        if (b.carryTotal >= cap) { this.release(b); b.state = BOT_RETURN; }
        else if (this.avail(m, b.target) === 0) {
          this.release(b);
          const nt = this.neighborTarget(m, b);
          if (nt >= 0) { b.target = nt; this.reserved.add(nt); b.state = BOT_GO; }
          else b.state = b.carryTotal > 0 ? BOT_RETURN : BOT_IDLE;
        }
      } else if (b.state === BOT_RETURN && m.type === 'robots') {
        // drones fly their load straight to the nearest hub: no belts needed
        const hub = this.nearestHub(b.x, b.y);
        if (!hub) { anyWork = true; continue; }
        if (this.moveBot(b, centerX(hub), centerY(hub) - 0.3, speed * dt)) {
          const space = this.host.yardSpace();
          if (space <= 0) { m.status = 'full'; continue; }
          const frac = Math.min(1, space / b.carryTotal);
          const out = emptyMats();
          let moved = 0;
          for (let k = 0; k < MAT_COUNT; k++) {
            const v = frac >= 1 ? b.carry[k] : Math.floor(b.carry[k] * frac);
            out[k] = v; b.carry[k] -= v; moved += v;
          }
          if (moved > 0) this.host.deliver(out, 0, b.x * TILE, b.y * TILE);
          b.carryTotal -= moved;
          if (b.carryTotal <= 0) { b.carryTotal = 0; b.carry.fill(0); b.state = BOT_IDLE; }
        } else anyWork = true;
      } else if (b.state === BOT_RETURN) {
        if (this.moveBot(b, sx, sy, speed * dt)) {
          const space = bufCap - m.bufferTotal;
          if (space <= 0) { m.status = 'full'; continue; }
          const frac = Math.min(1, space / b.carryTotal);
          let moved = 0;
          for (let k = 0; k < MAT_COUNT; k++) {
            const v = frac >= 1 ? b.carry[k] : Math.floor(b.carry[k] * frac);
            m.buffer[k] += v; b.carry[k] -= v; moved += v;
          }
          m.bufferTotal += moved;
          b.carryTotal -= moved;
          if (b.carryTotal <= 0) { b.carryTotal = 0; b.carry.fill(0); b.state = BOT_IDLE; }
        } else anyWork = true;
      }
    }
    if (m.type === 'robots') { if (m.status !== 'full' || this.host.yardSpace() > 0) m.status = anyWork ? 'working' : 'idle'; }
    else m.status = m.bufferTotal >= bufCap ? 'full' : anyWork ? 'working' : 'idle';
  }

  private scoopTiles(center: number): number[] {
    const tx = center % WORLD_TILES, ty = (center / WORLD_TILES) | 0;
    const res = [center];
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      if ((x || y) && inWorld(tx + x, ty + y)) {
        const t = tileIndex(tx + x, ty + y);
        if (!this.reserved.has(t)) res.push(t);
      }
    }
    return res;
  }

  private release(b: Bot) {
    if (b.target >= 0) this.reserved.delete(b.target);
    b.target = -1;
  }

  private moveBot(b: Bot, tx: number, ty: number, step: number): boolean {
    const dx = tx - b.x, dy = ty - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) { b.x = tx; b.y = ty; return true; }
    b.angle = Math.atan2(dy, dx);
    b.x += (dx / dist) * step; b.y += (dy / dist) * step;
    return false;
  }

  private pickBotTarget(m: Machine): number {
    this.ensureTargets(m);
    const t = m.targets!;
    while (m.cursor < t.length && this.avail(m, t[m.cursor]) === 0) m.cursor++;
    const cands: number[] = [];
    for (let k = m.cursor; k < t.length && cands.length < 40 && k < m.cursor + 600; k++) {
      if (this.avail(m, t[k]) > 0 && !this.reserved.has(t[k])) cands.push(t[k]);
    }
    if (!cands.length) return -1;
    const w = this.host.world;
    if (m.type === 'excavator') {
      // the excavator goes for the biggest piles
      cands.sort((a, b) => w.garbage[b] - w.garbage[a]);
      return cands[Math.floor(Math.random() * Math.min(3, cands.length))];
    }
    // drones prefer small, scattered leftovers
    cands.sort((a, b) => this.avail(m, a) - this.avail(m, b));
    return cands[Math.floor(Math.random() * Math.min(8, cands.length))];
  }

  private neighborTarget(m: Machine, b: Bot): number {
    const r = machineRadius(m, this.host.d);
    const cx = centerX(m), cy = centerY(m);
    const bx = Math.floor(b.x), by = Math.floor(b.y);
    for (let rad = 1; rad <= 2; rad++) for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const tx = bx + x, ty = by + y;
      if (!inWorld(tx, ty)) continue;
      const t = tileIndex(tx, ty);
      if (this.avail(m, t) > 0 && !this.reserved.has(t) && Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) <= r) return t;
    }
    return -1;
  }

  private updateBelt(m: Machine, dt: number, d: Derived) {
    const p = m.belt;
    if (!p.length) { m.status = 'idle'; return; }
    m.status = 'working';
    const adv = d.beltSpeed * dt;
    for (let i = 0; i < p.length; i++) {
      const maxT = i === 0 ? 1 : p[i - 1].t - SPACING;
      p[i].t = Math.max(p[i].t, Math.min(p[i].t + adv, maxT));
    }
    if (m.type === 'separator') for (const pk of p) if (pk.t > 0.5) pk.sorted = true;
    if (p[0].t >= 1) {
      const next = this.at(m.tx + DX[m.dir], m.ty + DY[m.dir]);
      if (!next) return;
      if (isHub(next.type)) {
        if (!p[0].sorted && this.host.yardSpace() < p[0].units) { m.status = 'full'; return; }
        const pk = p.shift()!;
        const mats = emptyMats();
        mats[pk.mat] = pk.units;
        this.host.deliver(mats, pk.sorted ? 1 : 0, (m.tx + 0.5 + DX[m.dir]) * TILE, (m.ty + 0.5 + DY[m.dir]) * TILE);
      } else if (isBelt(next.type) && (next.dir + 2) % 4 !== m.dir) {
        const last = next.belt[next.belt.length - 1];
        if (!last || last.t >= SPACING) {
          const pk = p.shift()!;
          pk.t = 0;
          next.belt.push(pk);
        }
      }
    }
  }

  private deliverFrom(m: Machine, dt: number) {
    if (m.inService) {
      const space = this.host.yardSpace();
      if (space <= 0) return;
      const n = Math.min(m.bufferTotal, space, Math.max(1, Math.floor(SERVICE_RATE * dt * (1 + m.level * 0.5) + Math.random())));
      const out = this.takeFromBuffer(m, n);
      const hub = this.nearestHub(centerX(m), centerY(m));
      m.deliverT -= dt;
      const vis = this.host.isVisible(centerX(m) * TILE, centerY(m) * TILE);
      if (vis && hub && m.deliverT <= 0) {
        m.deliverT = 0.22;
        let mat = 0;
        for (let k = 1; k < MAT_COUNT; k++) if (out[k] > out[mat]) mat = k;
        this.host.fx.fly(centerX(m) * TILE, centerY(m) * TILE, centerX(hub) * TILE, centerY(hub) * TILE, mat);
      }
      this.host.deliver(out, 0, -1, -1);
      return;
    }
    if (m.outConveyor >= 0) {
      const c = this.byId.get(m.outConveyor);
      if (!c) { this.linksDirty = true; return; }
      const last = c.belt[c.belt.length - 1];
      if (last && last.t < SPACING) return;
      let mat = 0;
      for (let k = 1; k < MAT_COUNT; k++) if (m.buffer[k] > m.buffer[mat]) mat = k;
      const units = Math.min(m.buffer[mat], PACKET_UNITS * (m.type === 'excavator' || m.type === 'crusher' ? 3 : 1));
      if (units <= 0) return;
      m.buffer[mat] -= units;
      m.bufferTotal -= units;
      c.belt.push({ mat, units, sorted: false, t: 0 });
    }
  }

  takeFromBuffer(m: Machine, n: number): number[] {
    const out = emptyMats();
    n = Math.min(n, m.bufferTotal);
    let left = n;
    for (let k = 0; k < MAT_COUNT && left > 0; k++) {
      const share = k === MAT_COUNT - 1 ? left : Math.min(m.buffer[k], Math.ceil((m.buffer[k] / m.bufferTotal) * n));
      const v = Math.min(share, left, m.buffer[k]);
      out[k] += v; m.buffer[k] -= v; left -= v;
    }
    for (let k = 0; k < MAT_COUNT && left > 0; k++) {
      const v = Math.min(left, m.buffer[k]);
      out[k] += v; m.buffer[k] -= v; left -= v;
    }
    m.bufferTotal -= n - left;
    return out;
  }
}
