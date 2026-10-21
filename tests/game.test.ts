import { describe, expect, it } from 'vitest';
import { Game, InputState } from '../src/game/Game';
import { CENTER, TOTAL_GARBAGE, TILE, tileIndex, WORLD_TILES } from '../src/core/constants';
import { SaveManager, KV } from '../src/game/Save';
import { sumMats } from '../src/data/materials';

const idle: InputState = { moveX: 0, moveY: 0, collect: false, interact: false, aim: null };
const mem = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };

function clearArea(g: Game, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.world.remove(tileIndex(x, y), 255, 'player');
}

function walkTo(g: Game, tx: number, ty: number) {
  g.player.x = tx * TILE; g.player.y = ty * TILE;
}

describe('Game', () => {
  it('player moves', () => {
    const g = new Game();
    const x0 = g.player.x;
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...idle, moveX: 1 });
    expect(g.player.x).toBeGreaterThan(x0);
  });

  it('collects, fills backpack, unloads and sells', () => {
    const g = new Game();
    // stand at the edge of the clearing facing east into garbage
    let tx = CENTER + 4;
    while (g.world.at(tx + 1, CENTER) === 0) tx++;
    walkTo(g, tx + 0.5, CENTER + 0.5);
    g.player.setFacing(1, 0);
    const before = g.remaining;
    for (let i = 0; i < 60 * 30; i++) g.update(1 / 60, { ...idle, collect: true, moveX: i % 60 < 6 ? 1 : 0 });
    expect(g.player.carried).toBe(g.d.capacity);
    expect(g.remaining).toBe(before - g.d.capacity);
    expect(sumMats(g.player.backpack)).toBe(g.player.carried);
    // go to depot
    walkTo(g, CENTER + 0.5, CENTER + 2.3);
    const m0 = g.money;
    for (let i = 0; i < 60 * 5; i++) g.update(1 / 60, idle);
    expect(g.player.carried).toBe(0);
    expect(g.money).toBeGreaterThan(m0);
    expect(g.stats.unitsSold + sumMats(g.storage)).toBe(g.d.capacity);
  });

  it('upgrades change real parameters', () => {
    const g = new Game();
    g.money = 1e6;
    const cap = g.d.capacity;
    expect(g.buyUpgrade('c_bag')).toBeNull();
    expect(g.d.capacity).toBeGreaterThan(cap);
    expect(g.buyUpgrade('a_robots')).not.toBeNull(); // locked by prerequisites
  });

  it('machines remove garbage off-screen, never more than exists', () => {
    const g = new Game();
    g.money = 1e9;
    g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    const tx = CENTER + 30, ty = CENTER;
    clearArea(g, tx, ty, tx, ty);
    expect(g.build('collector', tx, ty)).toBeNull();
    const m = g.machines.machines.find((m) => m.type === 'collector')!;
    let inRange = 0;
    g.machines.ensureTargets(m);
    for (const t of m.targets!) inRange += g.world.garbage[t];
    g.view = { x0: 0, y0: 0, x1: 10, y1: 10 };
    const r0 = g.remaining;
    // empty the buffer each step so it never blocks
    for (let i = 0; i < 4000; i++) { g.update(0.5, idle); m.buffer.fill(0); m.bufferTotal = 0; }
    expect(r0 - g.remaining).toBe(inRange);
    expect(g.remaining).toBeGreaterThanOrEqual(0);
    for (const t of m.targets!) expect(g.world.garbage[t]).toBe(0);
  });

  it('conveyors carry materials to the depot', () => {
    const g = new Game();
    g.money = 1e9;
    g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    g.upgrades.a_belts = 1; g.upgrades.a_arm = 1;
    g.autoSell = [false, false, false, false, false, false];
    g.contracts.started = true; // keep the welcome contract from eating the storage
    g.recompute();
    // a straight line from x=CENTER+2 (depot right edge is CENTER+1) east
    const y = CENTER;
    const x0 = CENTER + 2, x1 = CENTER + 20;
    clearArea(g, x0, y, x1 + 1, y);
    for (let x = x0; x <= x1; x++) expect(g.build('conveyor', x, y, 2)).toBeNull();
    expect(g.build('collector', x1 + 1, y)).toBeNull();
    const m = g.machines.machines.find((m) => m.type === 'collector')!;
    const st0 = sumMats(g.storage);
    for (let i = 0; i < 600; i++) g.update(0.1, idle);
    expect(m.outConveyor).toBeGreaterThan(0);
    expect(m.linked).toBe(true);
    expect(m.inService).toBe(false);
    expect(sumMats(g.storage)).toBeGreaterThan(st0);
    // conservation: delivered + in buffers + on belts == collected
    let onBelts = 0;
    for (const c of g.machines.machines) for (const p of c.belt) onBelts += p.units;
    expect(sumMats(g.storage) - st0 + onBelts + m.bufferTotal).toBe(m.collected);
  });

  it('robots and counter stay consistent', () => {
    const g = new Game();
    g.money = 1e9; g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    g.upgrades = { a_robots: 1, a_belts: 1, a_arm: 1, a_crusher: 1, a_excav: 1 };
    g.recompute();
    clearArea(g, CENTER + 6, CENTER - 1, CENTER + 7, CENTER + 2);
    expect(g.build('robots', CENTER + 6, CENTER)).toBeNull();
    expect(g.build('excavator', CENTER + 6, CENTER + 1 - 2 + 1)).not.toBeNull(); // overlapping
    for (let i = 0; i < 2000; i++) g.update(0.1, idle);
    let s = 0;
    for (const v of g.world.garbage) s += v;
    expect(s).toBe(g.remaining);
    expect(g.remaining).toBeLessThan(TOTAL_GARBAGE);
  });

  it('save preserves the world and machines', () => {
    const g = new Game();
    g.money = 1e9; g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    const tx = CENTER + 4;
    clearArea(g, tx, CENTER + 4, tx + 3, CENTER + 6);
    expect(g.build('collector', tx, CENTER + 5)).toBeNull();
    for (let i = 0; i < 100; i++) g.update(0.1, idle);
    const kv = mem();
    const sm = new SaveManager(kv);
    expect(sm.save(g)).toBe(true);
    const g2 = new Game();
    const r = sm.load(g2);
    expect(r.ok).toBe(true);
    expect(g2.remaining).toBe(g.remaining);
    expect(g2.machines.count('collector')).toBe(1);
    expect(g2.world.garbage[tileIndex(tx + 1, CENTER + 4)]).toBe(0);
    expect(Math.round(g2.money)).toBe(Math.round(g.money));
    // corrupt data falls back gracefully
    kv.setItem('garbage-kingdom-save', '{bad json');
    const g3 = new Game();
    expect(sm.load(g3).ok).toBe(false);
    expect(g3.remaining).toBe(TOTAL_GARBAGE);
    expect(WORLD_TILES).toBe(192);
  });

  it('auto-connects a far machine to the depot with conveyors', () => {
    const g = new Game();
    g.money = 1e9; g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    g.upgrades.a_arm = 1; g.upgrades.a_belts = 1;
    g.autoSell = [false, false, false, false, false, false];
    g.recompute();
    // an L-shaped clean corridor from the depot to a far spot
    clearArea(g, CENTER + 2, CENTER, CENTER + 18, CENTER);
    clearArea(g, CENTER + 18, CENTER, CENTER + 18, CENTER + 10);
    clearArea(g, CENTER + 17, CENTER + 11, CENTER + 19, CENTER + 12);
    expect(g.build('collector', CENTER + 18, CENTER + 12)).toBeNull();
    const m = g.machines.machines.find((x) => x.type === 'collector')!;
    g.update(0.1, idle);
    expect(m.inService).toBe(false);
    const plan = g.planConnection(m)!;
    expect(plan).not.toBeNull();
    expect(g.connectToDepot(m)).toBeNull();
    const st0 = sumMats(g.storage);
    for (let i = 0; i < 400; i++) g.update(0.1, idle);
    expect(m.linked).toBe(true);
    expect(sumMats(g.storage)).toBeGreaterThan(st0);
  });

  it('light machines leave the heavy base of dense piles; heavy ones lift it', () => {
    const g = new Game();
    g.money = 1e9; g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    g.upgrades.a_arm = 1; g.recompute();
    // find a dense tile with a clean spot next to it
    let tile = -1;
    for (let i = 0; i < g.world.garbage.length && tile < 0; i++) if (g.world.initial[i] >= 40) tile = i;
    const tx = tile % WORLD_TILES, ty = Math.floor(tile / WORLD_TILES);
    clearArea(g, tx + 1, ty, tx + 1, ty);
    const floor = g.world.heavyFloor(tile);
    expect(floor).toBeGreaterThan(0);
    expect(g.build('collector', tx + 1, ty)).toBeNull();
    const c = g.machines.machines.find((m) => m.type === 'collector')!;
    for (let i = 0; i < 3000; i++) { g.update(0.5, idle); c.buffer.fill(0); c.bufferTotal = 0; }
    expect(g.world.garbage[tile]).toBe(floor);
    g.machines.remove(c);
    expect(g.build('arm', tx + 1, ty)).toBeNull();
    const a = g.machines.machines.find((m) => m.type === 'arm')!;
    for (let i = 0; i < 3000; i++) { g.update(0.5, idle); a.buffer.fill(0); a.bufferTotal = 0; }
    expect(g.world.garbage[tile]).toBe(0);
  });

  it('the depot yard fills up and crushers raise its throughput', () => {
    const g = new Game();
    g.autoSell = [false, false, false, false, false, false];
    const cap = g.yardCap(), rate = g.processRate();
    g.deliver([cap, 0, 0, 0, 0, 0], 0, -1, -1);
    expect(g.yardSpace()).toBe(0);
    for (let i = 0; i < 10; i++) g.update(0.1, idle);
    expect(g.yardTotal).toBeLessThan(cap);
    expect(g.storage[0]).toBeGreaterThan(0);
    g.money = 1e9; g.storage = [1e6, 1e6, 1e6, 1e6, 1e6, 0];
    g.upgrades.a_arm = 1; g.upgrades.a_crusher = 1; g.recompute();
    clearArea(g, CENTER + 3, CENTER - 4, CENTER + 4, CENTER - 3);
    expect(g.build('crusher', CENTER + 3, CENTER - 4)).toBeNull();
    expect(g.processRate()).toBeGreaterThan(rate);
    expect(g.yardCap()).toBeGreaterThan(cap);
    clearArea(g, CENTER + 40, CENTER, CENTER + 41, CENTER + 1);
    expect(g.build('crusher', CENTER + 40, CENTER)).not.toBeNull(); // must be inside a depot circle
  });

  it('contracts: welcome contract, completion, failure and save', () => {
    const g = new Game();
    g.autoSell = [false, false, false, false, false, false];
    for (let i = 0; i < 450; i++) g.update(0.1, idle);
    expect(g.contracts.active.length).toBe(1);
    const c = g.contracts.active[0];
    expect(c.req[1]).toBe(25);
    // reserve keeps the contract material from auto-sell
    expect(g.autoReserve()[1]).toBeGreaterThanOrEqual(25);
    g.storage[1] = 30;
    const m0 = g.money;
    for (let i = 0; i < 10; i++) g.update(0.1, idle);
    expect(g.contracts.completed).toBe(1);
    expect(g.money).toBeGreaterThan(m0);
    expect(g.storage[1]).toBe(5);
    expect(g.shuttleT).toBeGreaterThan(0);
    // offers arrive after the first delivery
    for (let i = 0; i < 10; i++) g.update(0.1, idle);
    expect(g.contracts.offers.length).toBe(3);
    const offer = g.contracts.offers[2];
    expect(g.acceptContract(offer.id)).toBeNull();
    // and expire if ignored
    const rep = g.contracts.rep;
    g.stats.playTime = offer.deadline + 1;
    g.update(0.6, idle);
    expect(g.contracts.active.length).toBe(0);
    expect(g.contracts.rep).toBe(rep - 1);
    // persisted
    const kv = mem();
    new SaveManager(kv).save(g);
    const g2 = new Game();
    expect(new SaveManager(kv).load(g2).ok).toBe(true);
    expect(g2.contracts.completed).toBe(1);
    expect(g2.contracts.offers.length).toBe(g.contracts.offers.length);
  });

  it('modules change stats and persist', () => {
    const g = new Game();
    const cap = g.d.capacity, slow = g.d.garbageSlow;
    g.money = 1e6; g.storage = [1e4, 1e4, 1e4, 1e4, 1e4, 10];
    expect(g.buyModule('treads')).toBeNull();
    expect(g.loadout.move).toBe('treads');
    expect(g.d.garbageSlow).toBe(0);
    expect(slow).toBeGreaterThan(0);
    expect(g.buyModule('compactor')).toBeNull();
    expect(g.d.capacity).toBeGreaterThan(cap);
    expect(g.buyModule('hover')).not.toBeNull(); // needs a blueprint
    g.blueprints.push('hover');
    expect(g.buyModule('hover')).toBeNull();
    g.equipModule('treads');
    const kv = mem();
    new SaveManager(kv).save(g);
    const g2 = new Game();
    new SaveManager(kv).load(g2);
    expect(g2.loadout.move).toBe('treads');
    expect(g2.ownedModules).toContain('hover');
    expect(g2.d.garbageSlow).toBe(0);
  });
});
