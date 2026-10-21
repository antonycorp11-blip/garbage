import { M_ELEC, M_METAL, MATERIALS } from '../data/materials';
import { MODULE_MAP, ModuleEffects } from '../data/modules';

export interface Derived {
  capacity: number;
  collectMult: number;
  moveSpeed: number;
  garbageSlow: number;
  reachMult: number;
  /** extra reach (tiles) from modules */
  reachAdd: number;
  /** seconds between backpack teleports to the depot (0 = off) */
  teleport: number;
  forceUnits: number;
  areaMult: number;
  unloadRate: number;
  autoRate: number;
  remoteInterval: number;
  rareChance: number;
  radar: boolean;
  /** discoveries shown on the map */
  findRadar: boolean;
  orbitalRate: number;
  machineSpeed: number;
  machineRadiusMult: number;
  bufferMult: number;
  beltSpeed: number;
  extraRobots: number;
  value: number[];
  sepBonus: number;
  serviceBonus: number;
  processBonus: number;
  yardBonus: number;
  costMult: number;
}

export interface DerivedInput {
  up: Record<string, number>;
  flags: Record<string, boolean>;
  recyclers: number;
  /** equipped module ids */
  loadout?: string[];
  /** rarity stars of the equipped locomotion, tank and sensor */
  stars?: { move: number; tank: number; sensor: number };
  /** temporary machine boost (ion storm) */
  boost?: number;
}

export function computeDerived({ up, flags, recyclers, loadout = [], stars = { move: 0, tank: 0, sensor: 0 }, boost = 1 }: DerivedInput): Derived {
  const L = (id: string) => up[id] || 0;
  const fx: ModuleEffects[] = loadout.map((id) => MODULE_MAP[id]?.fx).filter((f): f is ModuleEffects => !!f);
  const mul = (k: 'speed' | 'slow' | 'cap' | 'value' | 'rare') => fx.reduce((a, f) => a * (f[k] ?? 1), 1);
  const reachAdd = fx.reduce((a, f) => a + (f.reach ?? 0), 0);
  const teleport = fx.reduce((a, f) => (f.teleport ? f.teleport : a), 0);
  const rec = Math.min(3, recyclers);
  const statue = flags.statue ? 1.15 : 1;
  const valueBase = (1 + 0.1 * L('r_value')) * (1 + 0.15 * L('r_quality')) * (1 + 0.15 * rec) * (flags.crown ? 1.25 : 1);
  return {
    capacity: Math.round(20 * Math.pow(1.55, L('c_bag')) * mul('cap') * (1 + 0.12 * stars.tank)),
    collectMult: (1 + 0.15 * L('c_speed')) * statue,
    moveSpeed: 4.4 * (1 + 0.1 * L('c_move')) * mul('speed') * (1 + 0.07 * stars.move),
    garbageSlow: 0.5 * (1 - 0.13 * L('c_move')) * mul('slow'),
    reachMult: 1 + 0.15 * L('c_reach'),
    reachAdd,
    teleport,
    forceUnits: L('c_force'),
    areaMult: 1 + 0.1 * L('c_force'),
    unloadRate: 25 * Math.pow(1.8, L('c_unload')) * (1 + 0.3 * L('r_depot')),
    autoRate: 1.5 * L('c_auto'),
    remoteInterval: L('c_remote') > 0 ? 24 / (1 + 0.7 * (L('c_remote') - 1)) : 0,
    rareChance: 0.003 * (1 + 0.35 * L('c_treasure')) * (1 + 0.4 * L('r_rare')) * mul('rare'),
    radar: L('c_radar') > 0 || !!flags.radar,
    findRadar: fx.some((f) => f.radar),
    orbitalRate: 12 * L('c_orbital'),
    machineSpeed: (1 + 0.1 * L('a_speed')) * (1 + 0.2 * L('a_integr')) * (1 + 0.1 * rec) * statue * (flags.alien ? 1.25 : 1) * boost,
    machineRadiusMult: 1 + 0.12 * L('a_radius'),
    bufferMult: 1 + 0.5 * L('a_buffer'),
    beltSpeed: 1.6 * (1 + 0.35 * L('a_beltspeed')),
    extraRobots: L('a_robotcount') + (flags.robotBonus ? 1 : 0),
    value: MATERIALS.map((m, i) => m.value * valueBase * mul('value') * (1 + 0.06 * stars.sensor) * (i === M_METAL || i === M_ELEC ? 1 + 0.25 * L('r_metal') : 1)),
    sepBonus: 0.35 * (1 + 0.2 * L('r_sepbonus')),
    serviceBonus: 2 * L('r_depot'),
    processBonus: 6 * L('r_depot'),
    yardBonus: 120 * L('r_depot'),
    costMult: 1 - 0.07 * L('r_discount'),
  };
}
