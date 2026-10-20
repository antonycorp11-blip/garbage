import { CENTER, CHUNK, CHUNKS, TILE, TOTAL_GARBAGE, WORLD_TILES, inWorld, tileIndex } from '../core/constants';
import { clamp } from '../core/rng';
import { DISCOVERIES } from '../data/discoveries';
import { BUILD_ORDER, MACHINES, MAX_MACHINE_LEVEL, MachineType, machineUpgradeCost } from '../data/machines';
import { MATERIALS, MAT_COUNT, M_ELEC, M_METAL, M_RARE, emptyMats, sumMats } from '../data/materials';
import { INTRO, MILESTONES, RANDOM_MESSAGES, RARE_FINDS, SENDER, TV_ADS } from '../data/messages';
import { TOOLS } from '../data/tools';
import { UPGRADES, UPGRADE_MAP, upgradeCost } from '../data/upgrades';
import { World } from '../world/World';
import { DEPOT } from '../world/worldgen';
import { Derived, computeDerived } from './derived';
import { FX, NULL_FX } from './fx';
import { Machine, MachineSystem, centerX, centerY, isHub } from './Machines';
import { Player } from './Player';

export interface InputState {
  moveX: number;
  moveY: number;
  collect: boolean;
  interact: boolean;
  /** world-pixel aim point (mouse), or null to aim with facing */
  aim: { x: number; y: number } | null;
}

export type GameEvent =
  | { type: 'discovery'; special: number }
  | { type: 'ending' }
  | { type: 'message'; text: string; from: string }
  | { type: 'openInventory' }
  | { type: 'openMachine'; id: number }
  | { type: 'offline'; seconds: number; removed: number }
  | { type: 'changed' };

export interface SpecialState { revealed: boolean; opened: boolean; progress: number }

export interface Stats {
  removedPlayer: number;
  removedMachines: number;
  earned: number;
  rareFound: number;
  playTime: number;
  peakRate: number;
  unitsSold: number;
  built: number;
  walked: number;
}

export interface Context { kind: 'special' | 'machine' | 'depot' | 'none'; label: string; progress?: number }

export class Game {
  world: World;
  player: Player;
  machines: MachineSystem;
  fx: FX = NULL_FX;
  d: Derived;

  money = 0;
  storage = emptyMats();
  autoSell = [true, true, true, true, true, true];
  reserve = [0, 60, 0, 0, 20, 0];
  toolTier = 0;
  upgrades: Record<string, number> = {};
  flags: Record<string, boolean> = {};
  specials: SpecialState[];
  stats: Stats = { removedPlayer: 0, removedMachines: 0, earned: 0, rareFound: 0, playTime: 0, peakRate: 0, unitsSold: 0, built: 0, walked: 0 };
  milestone = 0;
  ended = false;
  events: GameEvent[] = [];
  view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  context: Context = { kind: 'none', label: '' };

  // runtime
  private actionT = 0;
  private areaAcc = 0;
  private autoAcc = 0;
  private orbitalAcc = 0;
  private orbitalCursor = 0;
  private unloadAcc = 0;
  private remoteT = 0;
  private secondT = 0;
  private secondRemoved = 0;
  private lastRemaining: number;
  rateHistory: number[] = [];
  private randomMsgT = 120;
  private moneyPopup = 0;
  private moneyPopupT = 0;
  private discoveryT = 0;
  locator: { tx: number; ty: number } | null = null;
  private locatorT = 0;
  depot!: Machine;
  aimTile = -1;
  areaCenter: { x: number; y: number } | null = null;
  interactLatch = false;

  constructor() {
    this.world = new World();
    this.player = new Player(CENTER + 0.5, CENTER + 2.6);
    this.d = computeDerived({ up: this.upgrades, flags: this.flags, recyclers: 0 });
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const game = this;
    this.machines = new MachineSystem({
      world: this.world,
      get d() { return game.d; },
      get fx() { return game.fx; },
      deliver: (m, s, x, y) => this.deliver(m, s, x, y),
      isVisible: (x, y) => this.isVisible(x, y),
      onMachineRemoved: () => {},
    });
    this.specials = this.world.specials.map(() => ({ revealed: false, opened: false, progress: 0 }));
    this.depot = this.machines.create('depot', DEPOT.tx, DEPOT.ty);
    this.lastRemaining = this.world.remaining;
  }

  get tool() { return TOOLS[this.toolTier]; }
  get remaining() { return this.world.remaining; }
  get removed() { return TOTAL_GARBAGE - this.world.remaining; }
  get ratePerSec() {
    const h = this.rateHistory;
    if (!h.length) return 0;
    const n = Math.min(5, h.length);
    let s = 0;
    for (let i = h.length - n; i < h.length; i++) s += h[i];
    return s / n;
  }
  get ratePerMin() {
    let s = 0;
    for (const v of this.rateHistory) s += v;
    return this.rateHistory.length < 60 ? (s / Math.max(1, this.rateHistory.length)) * 60 : s;
  }
  get workingMachines() {
    let n = 0;
    for (const m of this.machines.machines) if (m.status === 'working' && !isHub(m.type)) n++;
    return n;
  }

  recompute() {
    this.d = computeDerived({ up: this.upgrades, flags: this.flags, recyclers: this.machines.count('recycler') });
    this.machines.linksDirty = true;
  }

  notify(text: string, from = SENDER) {
    this.events.push({ type: 'message', text, from });
  }

  intro() {
    INTRO.forEach((t) => this.notify(t));
  }

  isVisible(x: number, y: number) {
    const v = this.view;
    return x > v.x0 - 64 && x < v.x1 + 64 && y > v.y0 - 64 && y < v.y1 + 64;
  }

  // ------------------------------------------------------------------ economy
  deliver(mats: number[], sortedFrac: number, fromX: number, fromY: number) {
    let value = 0;
    for (let k = 0; k < MAT_COUNT; k++) {
      if (!mats[k]) continue;
      this.storage[k] += mats[k];
      value += mats[k] * this.d.value[k];
    }
    if (sortedFrac > 0) {
      const bonus = value * this.d.sepBonus * sortedFrac;
      this.earn(bonus);
      if (fromX >= 0 && this.isVisible(fromX, fromY) && bonus >= 1) this.fx.text(fromX, fromY - 10, '+$' + Math.round(bonus), '#7CFC9A');
    }
    this.autoSellNow();
  }

  earn(v: number) {
    this.money += v;
    this.stats.earned += v;
    this.moneyPopup += v;
  }

  autoSellNow() {
    for (let k = 0; k < MAT_COUNT; k++) {
      if (!this.autoSell[k]) continue;
      const extra = this.storage[k] - this.reserve[k];
      if (extra > 0) this.sell(k, extra, true);
    }
  }

  sell(mat: number, n: number, silent = false) {
    n = Math.min(Math.floor(n), this.storage[mat]);
    if (n <= 0) return 0;
    this.storage[mat] -= n;
    const v = n * this.d.value[mat];
    this.earn(v);
    this.stats.unitsSold += n;
    if (!silent) this.fx.sound('coin');
    return v;
  }

  sellAll() {
    let v = 0;
    for (let k = 0; k < MAT_COUNT; k++) v += this.sell(k, this.storage[k], true);
    if (v > 0) this.fx.sound('coin');
    return v;
  }

  machineCost(type: MachineType): { money: number; mats: number[] } {
    const def = MACHINES[type];
    const n = this.machines.count(type);
    const g = Math.pow(def.costGrowth, n);
    return {
      money: Math.ceil(def.money * g * this.d.costMult),
      mats: def.mats.map((v) => Math.ceil(v * Math.pow(def.costGrowth, n * 0.6))),
    };
  }

  missingFor(cost: { money: number; mats: number[] }): string | null {
    if (this.money < cost.money) return 'Dinheiro insuficiente';
    for (let k = 0; k < MAT_COUNT; k++) if (this.storage[k] < cost.mats[k]) return `Faltam ${Math.ceil(cost.mats[k] - this.storage[k])} de ${MATERIALS[k].name} no depósito`;
    return null;
  }

  pay(cost: { money: number; mats: number[] }) {
    this.money -= cost.money;
    for (let k = 0; k < MAT_COUNT; k++) this.storage[k] -= cost.mats[k];
  }

  isUnlocked(type: MachineType) {
    const u = MACHINES[type].unlock;
    return !u || (this.upgrades[u] || 0) > 0;
  }

  /** Why a machine cannot be placed there, or null if it can. */
  placeProblem(type: MachineType, tx: number, ty: number): string | null {
    const size = MACHINES[type].size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const ax = tx + x, ay = ty + y;
      if (!inWorld(ax, ay)) return 'Fora do terreno';
      const i = tileIndex(ax, ay);
      if (this.world.garbage[i] > 0) return `Ainda há lixo aqui (${this.world.garbage[i]})`;
      if (this.world.occupant[i] >= 0) return 'Espaço ocupado';
      if (this.world.specialAt[i] >= 0) return 'Há um objeto especial aqui';
      if (ax === CENTER - 4 && (ay === CENTER + 1 || ay === CENTER + 2)) return 'O Sr. Valdemar está sentado aí';
      if (MACHINES[type].solid || isHub(type)) {
        for (const h of this.machines.machines) {
          if (!isHub(h.type)) continue;
          const hs = MACHINES[h.type].size;
          if (ax >= h.tx - 1 && ay >= h.ty - 1 && ax <= h.tx + hs && ay <= h.ty + hs + 1) return 'Deixe um corredor livre ao redor do depósito';
        }
      }
      const p = this.player;
      if (MACHINES[type].solid && Math.abs(ax + 0.5 - p.tx) < 0.5 + p.radius && Math.abs(ay + 0.5 - p.ty) < 0.5 + p.radius) return 'Você está no caminho';
    }
    return null;
  }

  placeProblemIgnoringPlayer(type: MachineType, tx: number, ty: number): string | null {
    const size = MACHINES[type].size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!inWorld(tx + x, ty + y)) return 'Fora do terreno';
      const i = tileIndex(tx + x, ty + y);
      if (this.world.occupant[i] >= 0) return 'Espaço ocupado';
      if (type !== 'ancient' && this.world.garbage[i] > 0) return 'lixo';
    }
    return null;
  }

  build(type: MachineType, tx: number, ty: number, dir = 0): string | null {
    if (!this.isUnlocked(type)) return 'Tecnologia bloqueada';
    const p = this.placeProblem(type, tx, ty);
    if (p) return p;
    const cost = this.machineCost(type);
    const miss = this.missingFor(cost);
    if (miss) return miss;
    this.pay(cost);
    const m = this.machines.create(type, tx, ty, dir);
    m.built = 0;
    this.stats.built++;
    if (type === 'recycler') this.recompute();
    const s = MACHINES[type].size;
    this.fx.burst((tx + s / 2) * TILE, (ty + s / 2) * TILE, 'build', type === 'conveyor' ? 4 : 18);
    this.fx.sound('build', (tx + s / 2) * TILE, (ty + s / 2) * TILE);
    if (this.stats.built === 1) this.notify('Sua primeira máquina! Ela trabalha mesmo quando você não está olhando. Diferente de certos funcionários.');
    if (type === 'conveyor' && this.machines.count('conveyor') === 1) this.notify('Esteiras levam materiais das máquinas até o depósito. A seta mostra a direção. Tecla R gira.');
    return null;
  }

  upgradeMachine(m: Machine): string | null {
    if (m.level >= MAX_MACHINE_LEVEL) return 'Nível máximo';
    if (!MACHINES[m.type].buildable || m.type === 'conveyor') return 'Não pode ser melhorado';
    const c = Math.ceil(machineUpgradeCost(m.type, m.level) * this.d.costMult);
    if (this.money < c) return 'Dinheiro insuficiente';
    this.money -= c;
    m.level++;
    m.targets = null;
    this.machines.linksDirty = true;
    this.fx.burst(centerX(m) * TILE, centerY(m) * TILE, 'unlock', 20);
    this.fx.sound('unlock');
    return null;
  }

  demolish(m: Machine) {
    if (!MACHINES[m.type].buildable) return;
    // empty buffer first
    if (m.bufferTotal > 0) this.deliver(m.buffer.slice(), 0, -1, -1);
    for (const pk of m.belt) { const mats = emptyMats(); mats[pk.mat] = pk.units; this.deliver(mats, 0, -1, -1); }
    for (const b of m.bots) if (b.carryTotal) this.deliver(b.carry.slice(), 0, -1, -1);
    this.machines.remove(m);
    const refund = Math.floor(this.machineCost(m.type).money / MACHINES[m.type].costGrowth * 0.5);
    this.earn(refund);
    this.fx.burst(centerX(m) * TILE, centerY(m) * TILE, 'dust', 16);
    this.fx.sound('demolish');
    if (m.type === 'recycler') this.recompute();
  }

  emptyMachineIntoBackpack(m: Machine): number {
    const free = this.d.capacity - this.player.carried;
    if (free <= 0 || m.bufferTotal <= 0) return 0;
    const out = this.machines.takeFromBuffer(m, Math.min(free, m.bufferTotal));
    const n = sumMats(out);
    for (let k = 0; k < MAT_COUNT; k++) this.player.backpack[k] += out[k];
    this.player.carried += n;
    for (let i = 0; i < Math.min(8, n); i++) this.fx.fly(centerX(m) * TILE, centerY(m) * TILE, this.player.x, this.player.y, i % MAT_COUNT);
    this.fx.sound('unload');
    return n;
  }

  canBuyUpgrade(id: string): string | null {
    const u = UPGRADE_MAP[id];
    const lvl = this.upgrades[id] || 0;
    if (lvl >= u.max) return 'Máximo';
    for (const [rid, rl] of u.req) if ((this.upgrades[rid] || 0) < rl) return `Requer ${UPGRADE_MAP[rid].name} ${rl}`;
    if (this.money < upgradeCost(u, lvl)) return 'Dinheiro insuficiente';
    return null;
  }

  upgradeReqsMet(id: string) {
    return UPGRADE_MAP[id].req.every(([rid, rl]) => (this.upgrades[rid] || 0) >= rl);
  }

  buyUpgrade(id: string): string | null {
    const p = this.canBuyUpgrade(id);
    if (p) { this.fx.sound('error'); return p; }
    const u = UPGRADE_MAP[id];
    this.money -= upgradeCost(u, this.upgrades[id] || 0);
    this.upgrades[id] = (this.upgrades[id] || 0) + 1;
    this.recompute();
    this.fx.sound('unlock');
    this.fx.burst(this.player.x, this.player.y - 10, 'unlock', 24);
    const unlocked = BUILD_ORDER.find((t) => MACHINES[t].unlock === id);
    if (unlocked) this.notify(`Nova máquina disponível: ${MACHINES[unlocked].name}. Abra o menu Construir.`);
    return null;
  }

  toolCost(tier: number) {
    const t = TOOLS[tier];
    return Math.ceil(t.cost * (t.id === 'advanced' && this.flags.alien ? 0.4 : 1));
  }

  buyTool(tier: number): string | null {
    if (tier !== this.toolTier + 1 || tier >= TOOLS.length) return 'Indisponível';
    const c = this.toolCost(tier);
    if (this.money < c) { this.fx.sound('error'); return 'Dinheiro insuficiente'; }
    this.money -= c;
    this.toolTier = tier;
    this.areaAcc = 0;
    this.fx.sound('unlock');
    this.fx.burst(this.player.x, this.player.y - 10, 'unlock', 30);
    this.fx.shake(4);
    this.notify(`Nova ferramenta: ${TOOLS[tier].name}! ${TOOLS[tier].mode === 'area' ? 'Ela coleta em área: segure o botão e passeie pelo lixo.' : ''}`);
    return null;
  }

  // ------------------------------------------------------------------ world helpers
  solidAt(tx: number, ty: number): boolean {
    if (!inWorld(tx, ty)) return true;
    const i = tileIndex(tx, ty);
    const o = this.world.occupant[i];
    if (o >= 0) {
      const m = this.machines.byId.get(o);
      if (m && MACHINES[m.type].solid) return true;
    }
    const s = this.world.specialAt[i];
    if (s >= 0 && this.specials[s].revealed && !(this.specials[s].opened && DISCOVERIES[this.world.specials[s].index].openTime > 0 && this.discoveryVanishes(s))) return true;
    return false;
  }

  discoveryVanishes(s: number) {
    const id = DISCOVERIES[this.world.specials[s].index].id;
    return id === 'beetle' || id === 'container' || id === 'robot';
  }

  private collides(x: number, y: number): boolean {
    const r = this.player.radius;
    const pts = [[x - r, y - r * 0.5], [x + r, y - r * 0.5], [x - r, y + r * 0.6], [x + r, y + r * 0.6]];
    for (const [px, py] of pts) if (this.solidAt(Math.floor(px), Math.floor(py))) return true;
    return false;
  }

  // ------------------------------------------------------------------ update
  update(dt: number, input: InputState) {
    if (dt <= 0) return;
    this.stats.playTime += dt;
    this.updatePlayer(dt, input);
    this.updateCollection(dt, input);
    this.machines.update(dt);
    this.updatePassive(dt);
    this.updateInteract(dt, input);
    this.updateDiscoveries(dt);
    this.updateMeta(dt);
  }

  /** Background-only simulation (offline progress or tests). */
  simulateMachines(seconds: number, step = 0.5) {
    const fx = this.fx;
    this.fx = NULL_FX;
    const saved = this.view;
    this.view = { x0: -1e9, y0: -1e9, x1: -1e9, y1: -1e9 };
    const before = this.world.remaining;
    for (let t = 0; t < seconds; t += step) {
      this.machines.update(step);
      this.updatePassive(step, true);
      this.updateDiscoveries(step, true);
    }
    this.machines.removedAcc = 0;
    this.stats.removedMachines += before - this.world.remaining;
    this.lastRemaining = this.world.remaining;
    this.view = saved;
    this.fx = fx;
    return before - this.world.remaining;
  }

  private updatePlayer(dt: number, input: InputState) {
    const p = this.player;
    let mx = input.moveX, my = input.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const tx = Math.floor(p.tx), ty = Math.floor(p.ty);
    const dens = inWorld(tx, ty) ? Math.min(1, this.world.garbage[tileIndex(tx, ty)] / 70) : 0;
    const speed = this.d.moveSpeed * (1 - this.d.garbageSlow * dens) * (p.collecting && this.tool.mode === 'area' ? 0.8 : 1);
    const tvx = mx * speed, tvy = my * speed;
    const acc = Math.min(1, dt * 14);
    p.vx += (tvx - p.vx) * acc;
    p.vy += (tvy - p.vy) * acc;
    const nx = p.tx + p.vx * dt, ny = p.ty + p.vy * dt;
    const ox = p.tx, oy = p.ty;
    const stuck = this.collides(p.tx, p.ty);
    if (stuck || !this.collides(nx, p.ty)) p.x = nx * TILE; else p.vx = 0;
    if (stuck || !this.collides(p.tx, ny)) p.y = ny * TILE; else p.vy = 0;
    const moved = Math.hypot(p.tx - ox, p.ty - oy);
    this.stats.walked += moved;
    p.speedNow = moved / dt;
    p.moving = ml > 0.1 && moved > 0.0005;
    if (p.moving) p.walk += dt * (6 + speed * 1.4);
    if (ml > 0.1) p.setFacing(mx, my);
    if (p.action > 0) p.action = Math.max(0, p.action - dt * 3.2);
    p.fullWarnT -= dt;
  }

  private aimDir(input: InputState): [number, number] {
    const p = this.player;
    if (input.aim) {
      const dx = input.aim.x - p.x, dy = input.aim.y - p.y;
      const l = Math.hypot(dx, dy);
      if (l > 4) return [dx / l, dy / l];
    }
    return [p.fx, p.fy];
  }

  findSingleTarget(input: InputState): number {
    const p = this.player;
    const reach = this.tool.reach * this.d.reachMult;
    const px = p.tx, py = p.ty;
    const w = this.world;
    let best = -1, bs = Infinity;
    const aim = input.aim;
    if (aim) {
      const mtx = Math.floor(aim.x / TILE), mty = Math.floor(aim.y / TILE);
      if (inWorld(mtx, mty) && w.garbage[tileIndex(mtx, mty)] > 0 && Math.hypot(mtx + 0.5 - px, mty + 0.5 - py) <= reach + 0.35) return tileIndex(mtx, mty);
    }
    const [ax, ay] = this.aimDir(input);
    const R = Math.ceil(reach + 1);
    for (let y = Math.floor(py) - R; y <= Math.floor(py) + R; y++) for (let x = Math.floor(px) - R; x <= Math.floor(px) + R; x++) {
      if (!inWorld(x, y)) continue;
      const i = tileIndex(x, y);
      if (w.garbage[i] === 0) continue;
      const dx = x + 0.5 - px, dy = y + 0.5 - py;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + 0.35) continue;
      let score: number;
      if (aim) score = Math.hypot(x + 0.5 - aim.x / TILE, y + 0.5 - aim.y / TILE);
      else score = dist - 0.9 * ((dx * ax + dy * ay) / (dist || 1));
      if (score < bs) { bs = score; best = i; }
    }
    return best;
  }

  private takeForPlayer(tile: number, n: number, bias = false): number {
    const p = this.player;
    const free = this.d.capacity - p.carried;
    if (free <= 0) {
      if (p.fullWarnT <= 0) {
        p.fullWarnT = 2.5;
        this.fx.sound('full');
        this.fx.text(p.x, p.y - 34, 'Mochila cheia!', '#ff8a65');
      }
      return 0;
    }
    const w = this.world;
    const before = w.garbage[tile];
    const r = w.remove(tile, Math.min(n, free), 'player');
    if (r <= 0) return 0;
    const mats = emptyMats();
    w.rollMaterials(tile, r, this.d.rareChance, mats);
    if (bias) {
      // magnetic tools: part of plastic/paper rolls become metal/electronics
      const conv = Math.floor((mats[0] + mats[2]) * 0.25);
      const take0 = Math.min(mats[0], Math.ceil(conv / 2)), take2 = Math.min(mats[2], conv - take0);
      mats[0] -= take0; mats[2] -= take2;
      mats[M_METAL] += Math.ceil((take0 + take2) * 0.7);
      mats[M_ELEC] += (take0 + take2) - Math.ceil((take0 + take2) * 0.7);
    }
    for (let k = 0; k < MAT_COUNT; k++) p.backpack[k] += mats[k];
    p.carried += r;
    this.stats.removedPlayer += r;
    if (mats[M_RARE] > 0) {
      this.stats.rareFound += mats[M_RARE];
      const tx = tile % WORLD_TILES, ty = (tile / WORLD_TILES) | 0;
      this.fx.text((tx + 0.5) * TILE, ty * TILE, '★ RARO!', '#f0abfc');
      this.fx.burst((tx + 0.5) * TILE, (ty + 0.5) * TILE, 'magic', 14);
      this.fx.sound('rare');
      if (Math.random() < 0.5) this.notify(`Você encontrou ${RARE_FINDS[Math.floor(Math.random() * RARE_FINDS.length)]}. Guardado como Raridade.`);
    }
    this.fx.removed(tile, before, before - r, p.x, p.y - 12);
    return r;
  }

  private updateCollection(dt: number, input: InputState) {
    const p = this.player;
    const tool = this.tool;
    p.collecting = input.collect;
    this.aimTile = -1;
    this.areaCenter = null;
    if (tool.mode === 'single') {
      const target = this.findSingleTarget(input);
      this.aimTile = target;
      if (!input.collect) { this.actionT = Math.min(this.actionT, tool.actionTime * 0.6); return; }
      this.actionT += dt * this.d.collectMult;
      if (this.actionT >= tool.actionTime) {
        this.actionT -= tool.actionTime;
        if (this.actionT > tool.actionTime) this.actionT = 0;
        if (target >= 0) {
          const tx = target % WORLD_TILES, ty = (target / WORLD_TILES) | 0;
          const n = tool.units + this.d.forceUnits;
          const got = this.takeForPlayer(target, n);
          if (got > 0) {
            p.action = 1;
            p.setFacing(tx + 0.5 - p.tx, ty + 0.5 - p.ty);
            this.fx.burst((tx + 0.5) * TILE, (ty + 0.5) * TILE, 'dust', 3 + Math.min(6, got));
            this.fx.sound(this.toolTier >= 1 ? 'pickMetal' : 'pick', (tx + 0.5) * TILE, (ty + 0.5) * TILE);
            if (this.toolTier >= 2) this.fx.shake(0.6);
          }
        }
      }
    } else {
      const [ax, ay] = this.aimDir(input);
      const reach = tool.reach * this.d.reachMult;
      const cx = p.tx + ax * reach, cy = p.ty + ay * reach;
      this.areaCenter = { x: cx, y: cy };
      if (!input.collect) { this.areaAcc = 0; return; }
      if (input.aim) p.setFacing(ax, ay);
      const radius = tool.radius * this.d.reachMult;
      this.areaAcc += tool.rate * this.d.collectMult * this.d.areaMult * dt;
      let n = Math.floor(this.areaAcc);
      if (n <= 0) return;
      this.areaAcc -= n;
      p.action = Math.max(p.action, 0.6);
      // gather dirty tiles nearest first
      const w = this.world;
      const tiles: [number, number][] = [];
      const R = Math.ceil(radius);
      for (let y = Math.floor(cy) - R; y <= Math.floor(cy) + R; y++) for (let x = Math.floor(cx) - R; x <= Math.floor(cx) + R; x++) {
        if (!inWorld(x, y)) continue;
        const i = tileIndex(x, y);
        if (!w.garbage[i]) continue;
        const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (dd <= radius + 0.3) tiles.push([i, dd]);
      }
      if (!tiles.length) return;
      tiles.sort((a, b) => a[1] - b[1]);
      const per = Math.max(1, Math.ceil(n / Math.min(tiles.length, 6)));
      let gotAny = 0;
      for (const [i] of tiles) {
        if (n <= 0) break;
        const got = this.takeForPlayer(i, Math.min(per, n), this.tool.id === 'magnet');
        if (got <= 0 && p.carried >= this.d.capacity) break;
        n -= got;
        gotAny += got;
      }
      if (gotAny > 0 && Math.random() < 0.35) this.fx.sound('pick', cx * TILE, cy * TILE);
    }
  }

  private updatePassive(dt: number, offline = false) {
    const p = this.player;
    const w = this.world;
    // passive pickup around the player
    if (!offline && this.d.autoRate > 0 && p.carried < this.d.capacity) {
      this.autoAcc += this.d.autoRate * dt;
      if (this.autoAcc >= 1) {
        const tx = Math.floor(p.tx), ty = Math.floor(p.ty);
        let done = false;
        for (let y = -1; y <= 1 && !done; y++) for (let x = -1; x <= 1; x++) {
          if (!inWorld(tx + x, ty + y)) continue;
          const i = tileIndex(tx + x, ty + y);
          if (w.garbage[i] > 0) { this.takeForPlayer(i, Math.floor(this.autoAcc)); done = true; break; }
        }
        this.autoAcc -= Math.floor(this.autoAcc);
      }
    }
    // orbital magnet: sweeps the whole map
    if (this.d.orbitalRate > 0 && w.remaining > 0) {
      this.orbitalAcc += this.d.orbitalRate * this.d.machineSpeed * dt;
      let n = Math.floor(this.orbitalAcc);
      if (n > 0) {
        this.orbitalAcc -= n;
        const mats = emptyMats();
        let guard = 0;
        const N = w.garbage.length;
        while (n > 0 && guard++ < N) {
          const i = this.orbitalCursor;
          if (w.garbage[i] > 0) {
            const before = w.garbage[i];
            const r = w.remove(i, n, 'machine');
            w.rollMaterials(i, r, this.d.rareChance, mats);
            n -= r;
            this.machines.removedAcc += r;
            const tx = i % WORLD_TILES, ty = (i / WORLD_TILES) | 0;
            if (!offline && this.isVisible((tx + 0.5) * TILE, (ty + 0.5) * TILE)) this.fx.removed(i, before, before - r, (tx + 0.5) * TILE, (ty - 6) * TILE);
          } else this.orbitalCursor = (this.orbitalCursor + 1) % N;
        }
        this.deliver(mats, 0, -1, -1);
      }
    }
  }

  private nearHub(): Machine | undefined {
    const p = this.player;
    for (const m of this.machines.machines) {
      if (!isHub(m.type)) continue;
      const s = MACHINES[m.type].size;
      if (Math.abs(p.tx - centerX(m)) <= s / 2 + 1.1 && Math.abs(p.ty - centerY(m)) <= s / 2 + 1.25) return m;
    }
    return undefined;
  }

  private updateInteract(dt: number, input: InputState) {
    const p = this.player;
    // unloading at hubs
    const hub = this.nearHub();
    if (hub && p.carried > 0) {
      this.unloadAcc += this.d.unloadRate * dt;
      const n = Math.min(p.carried, Math.floor(this.unloadAcc));
      if (n > 0) {
        this.unloadAcc -= n;
        const out = emptyMats();
        let left = n;
        for (let k = 0; k < MAT_COUNT && left > 0; k++) {
          const v = Math.min(left, p.backpack[k]);
          out[k] = v; p.backpack[k] -= v; left -= v;
        }
        p.carried -= n - left;
        let mat = 0;
        for (let k = 1; k < MAT_COUNT; k++) if (out[k] > out[mat]) mat = k;
        this.fx.fly(p.x, p.y - 14, centerX(hub) * TILE, centerY(hub) * TILE - 8, mat);
        this.fx.sound('unload');
        this.deliver(out, 0, -1, -1);
        if (p.carried <= 0) { p.carried = 0; p.backpack.fill(0); }
      }
    } else this.unloadAcc = 0;

    // remote drone
    if (this.d.remoteInterval > 0) {
      this.remoteT += dt;
      if (this.remoteT >= this.d.remoteInterval && p.carried >= this.d.capacity * 0.25 && !hub) {
        this.remoteT = 0;
        const out = p.backpack.slice();
        p.backpack.fill(0);
        p.carried = 0;
        this.deliver(out, 0, -1, -1);
        const h = this.machines.nearestHub(p.tx, p.ty) ?? this.depot;
        this.fx.drone(p.x, p.y, centerX(h) * TILE, centerY(h) * TILE);
        this.fx.sound('drone');
      }
    }

    // contextual interaction
    this.context = { kind: 'none', label: '' };
    const s = this.nearSpecial();
    const pressed = input.interact && !this.interactLatch;
    this.interactLatch = input.interact;
    if (s >= 0) {
      const st = this.specials[s];
      const def = DISCOVERIES[this.world.specials[s].index];
      this.context = { kind: 'special', label: `Abrir: ${def.name}`, progress: st.progress };
      if (input.interact) {
        st.progress += dt / def.openTime;
        p.action = Math.max(p.action, 0.5);
        if (Math.random() < dt * 6) this.fx.burst(this.specialCenterX(s), this.specialCenterY(s), 'spark', 2);
        if (st.progress >= 1) this.openSpecial(s);
      } else st.progress = Math.max(0, st.progress - dt * 0.5);
      return;
    }
    const m = this.nearMachine();
    if (m) {
      if (m.bufferTotal > 0) this.context = { kind: 'machine', label: `Esvaziar ${MACHINES[m.type].short} (${Math.floor(m.bufferTotal)})` };
      else this.context = { kind: 'machine', label: `Ver ${MACHINES[m.type].short}` };
      if (pressed) {
        if (m.bufferTotal > 0 && p.carried < this.d.capacity) this.emptyMachineIntoBackpack(m);
        else this.events.push({ type: 'openMachine', id: m.id });
      }
      return;
    }
    if (hub) {
      this.context = { kind: 'depot', label: 'Depósito: vender / inventário' };
      if (pressed) this.events.push({ type: 'openInventory' });
    }
  }

  nearMachine(): Machine | undefined {
    const p = this.player;
    let best: Machine | undefined, bd = 1.5;
    for (const m of this.machines.machines) {
      if (isHub(m.type) || m.type === 'conveyor') continue;
      const s = MACHINES[m.type].size;
      const d = Math.hypot(p.tx - centerX(m), p.ty - centerY(m)) - s / 2;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  specialCenterX(s: number) { const sp = this.world.specials[s]; return (sp.tx + sp.size / 2) * TILE; }
  specialCenterY(s: number) { const sp = this.world.specials[s]; return (sp.ty + sp.size / 2) * TILE; }

  nearSpecial(): number {
    const p = this.player;
    for (let s = 0; s < this.specials.length; s++) {
      const st = this.specials[s];
      if (!st.revealed || st.opened) continue;
      const sp = this.world.specials[s];
      if (Math.hypot(p.tx - (sp.tx + sp.size / 2), p.ty - (sp.ty + sp.size / 2)) < sp.size / 2 + 1.3) return s;
    }
    return -1;
  }

  private updateDiscoveries(dt: number, offline = false) {
    this.discoveryT -= dt;
    if (this.discoveryT > 0) return;
    this.discoveryT = 0.25;
    const w = this.world;
    for (let s = 0; s < this.specials.length; s++) {
      const st = this.specials[s];
      if (st.revealed) continue;
      const sp = w.specials[s];
      let clean = true;
      for (let y = 0; y < sp.size && clean; y++) for (let x = 0; x < sp.size; x++) if (w.garbage[tileIndex(sp.tx + x, sp.ty + y)] > 0) { clean = false; break; }
      if (!clean) continue;
      st.revealed = true;
      const def = DISCOVERIES[sp.index];
      if (!offline) {
        this.fx.burst(this.specialCenterX(s), this.specialCenterY(s), 'magic', 40);
        this.fx.sound('discover');
      }
      if (def.openTime === 0) this.openSpecial(s, offline);
      else this.notify(`Algo apareceu sob o lixo: ${def.name}! Chegue perto e segure INTERAGIR (E) para abrir.`, 'Detector de Curiosidades');
    }
  }

  openSpecial(s: number, quiet = false) {
    const st = this.specials[s];
    if (st.opened) return;
    st.opened = true;
    st.progress = 1;
    const sp = this.world.specials[s];
    const def = DISCOVERIES[sp.index];
    if (def.money) this.earn(def.money);
    if (def.mats) for (let k = 0; k < MAT_COUNT; k++) this.storage[k] += def.mats[k] || 0;
    switch (def.effect) {
      case 'tvAds': this.flags.tvAds = true; break;
      case 'robotBonus': this.flags.robotBonus = true; break;
      case 'radar': this.flags.radar = true; break;
      case 'statue': this.flags.statue = true; break;
      case 'alien': this.flags.alien = true; break;
      case 'crown': this.flags.crown = true; break;
      case 'ancientMachine': {
        this.world.specialAt[tileIndex(sp.tx, sp.ty)] = -1;
        if (this.world.occupant[tileIndex(sp.tx, sp.ty)] < 0) this.machines.create('ancient', sp.tx, sp.ty);
        break;
      }
      default: break;
    }
    this.recompute();
    if (!quiet) {
      this.fx.sound('open');
      this.fx.burst(this.specialCenterX(s), this.specialCenterY(s), 'coin', 30);
      if (def.money) this.fx.text(this.specialCenterX(s), this.specialCenterY(s) - 20, '+$' + def.money.toLocaleString('pt-BR'), '#ffe082');
    }
    this.events.push({ type: 'discovery', special: s });
  }

  private updateMeta(dt: number) {
    // rate tracking
    const removedNow = this.lastRemaining - this.world.remaining;
    this.lastRemaining = this.world.remaining;
    this.secondRemoved += removedNow;
    this.stats.removedMachines += this.machines.removedAcc;
    this.machines.removedAcc = 0;
    this.secondT += dt;
    if (this.secondT >= 1) {
      this.secondT -= 1;
      this.rateHistory.push(this.secondRemoved);
      if (this.rateHistory.length > 60) this.rateHistory.shift();
      this.secondRemoved = 0;
      this.stats.peakRate = Math.max(this.stats.peakRate, this.ratePerSec);
      this.checkMilestones();
      this.randomMsgT -= 1;
      if (this.randomMsgT <= 0) {
        this.randomMsgT = 150 + Math.random() * 120;
        if (this.flags.tvAds && Math.random() < 0.5) this.notify(TV_ADS[Math.floor(Math.random() * TV_ADS.length)], 'TV Achada no Lixo');
        else this.notify(RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)]);
      }
    }
    // floating money at the depot
    this.moneyPopupT -= dt;
    if (this.moneyPopupT <= 0) {
      this.moneyPopupT = 0.6;
      if (this.moneyPopup >= 1) {
        const h = this.depot;
        if (this.isVisible(centerX(h) * TILE, centerY(h) * TILE)) {
          this.fx.text(centerX(h) * TILE + (Math.random() - 0.5) * 30, h.ty * TILE - 6, '+$' + (this.moneyPopup < 100 ? this.moneyPopup.toFixed(1) : Math.round(this.moneyPopup).toLocaleString('pt-BR')), '#ffe082');
          this.fx.sound('coin');
        }
      }
      this.moneyPopup = 0;
    }
    // locator
    this.locatorT -= dt;
    if (this.locatorT <= 0) {
      this.locatorT = 0.5;
      this.locator = this.d.radar && this.world.remaining > 0 ? this.findNearestGarbage() : null;
    }
    if (!this.ended && this.world.remaining <= 0) {
      this.ended = true;
      this.fx.sound('win');
      this.events.push({ type: 'ending' });
    }
  }

  private checkMilestones() {
    const frac = this.removed / TOTAL_GARBAGE;
    while (this.milestone < MILESTONES.length && frac >= MILESTONES[this.milestone].pct) {
      this.notify(MILESTONES[this.milestone].text);
      this.fx.sound('milestone');
      this.milestone++;
    }
  }

  findNearestGarbage(): { tx: number; ty: number } | null {
    const w = this.world;
    const p = this.player;
    const pcx = p.tx / CHUNK, pcy = p.ty / CHUNK;
    const chunks: [number, number][] = [];
    for (let c = 0; c < CHUNKS * CHUNKS; c++) if (w.chunkRemaining[c] > 0) {
      const cx = c % CHUNKS + 0.5, cy = Math.floor(c / CHUNKS) + 0.5;
      chunks.push([c, (cx - pcx) ** 2 + (cy - pcy) ** 2]);
    }
    if (!chunks.length) return null;
    chunks.sort((a, b) => a[1] - b[1]);
    let best: { tx: number; ty: number } | null = null, bd = Infinity;
    for (let k = 0; k < Math.min(4, chunks.length); k++) {
      const c = chunks[k][0];
      const cx = (c % CHUNKS) * CHUNK, cy = Math.floor(c / CHUNKS) * CHUNK;
      for (let y = cy; y < cy + CHUNK; y++) for (let x = cx; x < cx + CHUNK; x++) {
        if (!w.garbage[tileIndex(x, y)]) continue;
        const d = (x + 0.5 - p.tx) ** 2 + (y + 0.5 - p.ty) ** 2;
        if (d < bd) { bd = d; best = { tx: x, ty: y }; }
      }
    }
    return best;
  }

  /** cost to drive progress UI */
  nextGoal(): string {
    if (this.toolTier === 0 && this.money < 60) return 'Colete lixo e descarregue no depósito para ganhar dinheiro.';
    if (this.toolTier === 0) return 'Compre a Pá Improvisada no menu Ferramentas.';
    if (this.machines.count('collector') === 0) return 'Construa seu primeiro Coletor Automático (menu Construir).';
    return '';
  }

  clampCam(x: number) { return clamp(x, 0, WORLD_TILES * TILE); }
}

export { UPGRADES };
