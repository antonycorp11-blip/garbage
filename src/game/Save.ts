import { SAVE_KEY, SAVE_VERSION, tileIndex } from '../core/constants';
import { MAT_COUNT } from '../data/materials';
import { MACHINES, MachineType } from '../data/machines';
import { TOOLS } from '../data/tools';
import { UPGRADE_MAP } from '../data/upgrades';
import { Game } from './Game';

export interface SaveData {
  version: number;
  savedAt: number;
  garbage: string;
  money: number;
  storage: number[];
  yard?: number[];
  autoSell: boolean[];
  reserve: number[];
  toolTier: number;
  upgrades: Record<string, number>;
  flags: Record<string, boolean>;
  player: { x: number; y: number; backpack: number[]; carried: number };
  machines: { id: number; type: MachineType; tx: number; ty: number; dir: number; level: number; buffer: number[]; collected: number; belt: { mat: number; units: number; sorted: boolean; t: number }[] }[];
  specials: { revealed: boolean; opened: boolean }[];
  stats: Game['stats'];
  milestone: number;
  ended: boolean;
}

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const num = (v: unknown, def = 0) => (typeof v === 'number' && isFinite(v) ? v : def);
const mats = (v: unknown) => Array.from({ length: MAT_COUNT }, (_, i) => Math.max(0, num(Array.isArray(v) ? v[i] : 0)));

export function serialize(g: Game): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    garbage: g.world.serializeGarbage(),
    money: g.money,
    storage: g.storage.slice(),
    yard: g.yard.slice(),
    autoSell: g.autoSell.slice(),
    reserve: g.reserve.slice(),
    toolTier: g.toolTier,
    upgrades: { ...g.upgrades },
    flags: { ...g.flags },
    player: { x: g.player.x, y: g.player.y, backpack: g.player.backpack.slice(), carried: g.player.carried },
    machines: g.machines.machines.filter((m) => m.type !== 'depot').map((m) => {
      const buffer = m.buffer.slice();
      // robots carry loads home on reload
      for (const b of m.bots) for (let k = 0; k < MAT_COUNT; k++) buffer[k] += b.carry[k];
      return { id: m.id, type: m.type, tx: m.tx, ty: m.ty, dir: m.dir, level: m.level, buffer, collected: m.collected, belt: m.belt.map((p) => ({ ...p })) };
    }),
    specials: g.specials.map((s) => ({ revealed: s.revealed, opened: s.opened })),
    stats: { ...g.stats },
    milestone: g.milestone,
    ended: g.ended,
  };
}

/** Applies save data to a fresh game. Throws on invalid data. */
export function applySave(g: Game, raw: unknown): void {
  const s = raw as SaveData;
  if (!s || typeof s !== 'object' || s.version !== SAVE_VERSION) throw new Error('versão de save incompatível');
  if (typeof s.garbage !== 'string' || !g.world.loadGarbage(s.garbage)) throw new Error('mundo corrompido');
  g.money = Math.max(0, num(s.money));
  g.storage = mats(s.storage);
  g.yard = mats(s.yard);
  if (Array.isArray(s.autoSell)) g.autoSell = Array.from({ length: MAT_COUNT }, (_, i) => s.autoSell[i] !== false);
  g.reserve = mats(s.reserve);
  g.toolTier = Math.max(0, Math.min(TOOLS.length - 1, Math.floor(num(s.toolTier))));
  g.upgrades = {};
  for (const [k, v] of Object.entries(s.upgrades || {})) if (UPGRADE_MAP[k]) g.upgrades[k] = Math.max(0, Math.min(UPGRADE_MAP[k].max, Math.floor(num(v))));
  g.flags = {};
  for (const [k, v] of Object.entries(s.flags || {})) g.flags[k] = !!v;
  if (s.player) {
    g.player.x = num(s.player.x, g.player.x);
    g.player.y = num(s.player.y, g.player.y);
    g.player.backpack = mats(s.player.backpack);
    g.player.carried = g.player.backpack.reduce((a, b) => a + b, 0);
  }
  if (Array.isArray(s.specials)) s.specials.forEach((sp, i) => {
    if (!g.specials[i]) return;
    g.specials[i].revealed = !!sp.revealed;
    g.specials[i].opened = !!sp.opened;
    g.specials[i].progress = sp.opened ? 1 : 0;
  });
  for (const ms of s.machines || []) {
    if (!MACHINES[ms.type] || ms.type === 'depot') continue;
    if (g.placeProblemIgnoringPlayer(ms.type, ms.tx, ms.ty)) continue;
    const m = g.machines.create(ms.type, ms.tx, ms.ty, num(ms.dir) & 3, Math.max(1, Math.min(5, Math.floor(num(ms.level, 1)))), ms.id);
    m.buffer = mats(ms.buffer);
    m.bufferTotal = m.buffer.reduce((a, b) => a + b, 0);
    m.collected = num(ms.collected);
    m.built = 1;
    if (Array.isArray(ms.belt)) m.belt = ms.belt.slice(0, 8).map((p) => ({ mat: Math.max(0, Math.min(MAT_COUNT - 1, num(p.mat))), units: Math.max(0, num(p.units)), sorted: !!p.sorted, t: Math.max(0, Math.min(1, num(p.t))) }));
  }
  // special tiles turned into machines
  for (let i = 0; i < g.specials.length; i++) {
    const sp = g.world.specials[i];
    const occ = g.world.occupant[tileIndex(sp.tx, sp.ty)];
    if (g.specials[i].opened && occ >= 0 && g.machines.byId.get(occ)?.type === 'ancient') g.world.specialAt[tileIndex(sp.tx, sp.ty)] = -1;
  }
  Object.assign(g.stats, s.stats || {});
  g.milestone = Math.max(0, Math.floor(num(s.milestone)));
  g.ended = !!s.ended;
  g.recompute();
}

export class SaveManager {
  constructor(private store: KV) {}

  save(g: Game): boolean {
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(serialize(g)));
      return true;
    } catch {
      return false;
    }
  }

  /** Returns seconds since save if loaded, -1 if no save, throws never. */
  load(g: Game): { ok: boolean; elapsed: number; error?: string } {
    const raw = this.store.getItem(SAVE_KEY);
    if (!raw) return { ok: false, elapsed: 0 };
    try {
      const data = JSON.parse(raw);
      applySave(g, data);
      return { ok: true, elapsed: Math.max(0, (Date.now() - num(data.savedAt, Date.now())) / 1000) };
    } catch (e) {
      try { this.store.setItem(SAVE_KEY + '-corrupt', raw); } catch { /* ignore */ }
      this.store.removeItem(SAVE_KEY);
      return { ok: false, elapsed: 0, error: String(e) };
    }
  }

  reset() {
    this.store.removeItem(SAVE_KEY);
  }
}
