import { M_ELEC, M_METAL, MATERIALS } from '../data/materials';

export interface Derived {
  capacity: number;
  collectMult: number;
  moveSpeed: number;
  garbageSlow: number;
  reachMult: number;
  forceUnits: number;
  areaMult: number;
  unloadRate: number;
  autoRate: number;
  remoteInterval: number;
  rareChance: number;
  radar: boolean;
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
}

export function computeDerived({ up, flags, recyclers }: DerivedInput): Derived {
  const L = (id: string) => up[id] || 0;
  const rec = Math.min(3, recyclers);
  const statue = flags.statue ? 1.15 : 1;
  const valueBase = (1 + 0.1 * L('r_value')) * (1 + 0.15 * L('r_quality')) * (1 + 0.15 * rec) * (flags.crown ? 1.25 : 1);
  return {
    capacity: Math.round(20 * Math.pow(1.55, L('c_bag'))),
    collectMult: (1 + 0.15 * L('c_speed')) * statue,
    moveSpeed: 4.4 * (1 + 0.1 * L('c_move')),
    garbageSlow: 0.5 * (1 - 0.13 * L('c_move')),
    reachMult: 1 + 0.15 * L('c_reach'),
    forceUnits: L('c_force'),
    areaMult: 1 + 0.1 * L('c_force'),
    unloadRate: 25 * Math.pow(1.8, L('c_unload')) * (1 + 0.3 * L('r_depot')),
    autoRate: 1.5 * L('c_auto'),
    remoteInterval: L('c_remote') > 0 ? 24 / (1 + 0.7 * (L('c_remote') - 1)) : 0,
    rareChance: 0.003 * (1 + 0.35 * L('c_treasure')) * (1 + 0.4 * L('r_rare')),
    radar: L('c_radar') > 0 || !!flags.radar,
    orbitalRate: 12 * L('c_orbital'),
    machineSpeed: (1 + 0.1 * L('a_speed')) * (1 + 0.2 * L('a_integr')) * (1 + 0.1 * rec) * statue * (flags.alien ? 1.25 : 1),
    machineRadiusMult: 1 + 0.12 * L('a_radius'),
    bufferMult: 1 + 0.5 * L('a_buffer'),
    beltSpeed: 1.6 * (1 + 0.35 * L('a_beltspeed')),
    extraRobots: L('a_robotcount') + (flags.robotBonus ? 1 : 0),
    value: MATERIALS.map((m, i) => m.value * valueBase * (i === M_METAL || i === M_ELEC ? 1 + 0.25 * L('r_metal') : 1)),
    sepBonus: 0.35 * (1 + 0.2 * L('r_sepbonus')),
    serviceBonus: 2 * L('r_depot'),
    processBonus: 6 * L('r_depot'),
    yardBonus: 120 * L('r_depot'),
    costMult: 1 - 0.07 * L('r_discount'),
  };
}
