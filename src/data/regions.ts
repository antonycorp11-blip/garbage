export const G_DIRT = 0, G_EARTH = 1, G_CONCRETE = 2, G_ASPHALT = 3, G_GRAVEL = 4, G_RUINFLOOR = 5;
export const GROUND_COUNT = 6;

export const R_CLEARING = 0, R_DOMESTIC = 1, R_TIRES = 2, R_ELECTRONICS = 3, R_CARS = 4, R_CONSTRUCTION = 5, R_INDUSTRIAL = 6, R_MYSTERY = 7;

/** Space-junk kinds. Visuals live in render/sprites.ts. */
export type ItemKind =
  | 'crystal' | 'shard' | 'capsule' | 'canister' | 'goo' | 'pod' | 'amber' | 'ring' | 'bolt' | 'plate'
  | 'chip' | 'cube' | 'cell' | 'droidhead' | 'droidarm' | 'antenna' | 'dish' | 'crate' | 'meteor' | 'pipe'
  | 'gear' | 'ufo' | 'hull' | 'thruster' | 'wreck' | 'droid' | 'satellite' | 'boulder' | 'heap';

export interface RegionDef {
  name: string;
  density: number;
  /** weights for cristal, liga estelar, biogel, âmbar, plasma */
  mats: [number, number, number, number, number];
  items: [ItemKind, number][];
  ground: number;
  rareMult: number;
}

export const REGIONS: RegionDef[] = [
  { name: 'Clareira do Posto', density: 0, mats: [1, 1, 1, 1, 0], items: [['shard', 1]], ground: G_EARTH, rareMult: 1 },
  {
    name: 'Campo de Cápsulas', density: 1, mats: [40, 12, 30, 15, 3], ground: G_DIRT, rareMult: 1,
    items: [['capsule', 22], ['crystal', 12], ['shard', 10], ['goo', 12], ['pod', 10], ['crate', 12], ['canister', 8], ['amber', 5], ['ufo', 1], ['droid', 2], ['hull', 1]],
  },
  {
    name: 'Mar de Anéis', density: 1.15, mats: [55, 25, 8, 6, 6], ground: G_GRAVEL, rareMult: 0.8,
    items: [['ring', 60], ['bolt', 8], ['gear', 6], ['canister', 6], ['shard', 6], ['plate', 6], ['crystal', 4]],
  },
  {
    name: 'Cemitério de Droides', density: 1.05, mats: [20, 22, 6, 12, 40], ground: G_CONCRETE, rareMult: 1.6,
    items: [['droidhead', 16], ['droidarm', 14], ['chip', 14], ['cube', 10], ['cell', 12], ['antenna', 10], ['gear', 8], ['plate', 6], ['droid', 6], ['satellite', 2], ['dish', 4]],
  },
  {
    name: 'Ferro-Velho de Naves', density: 1.2, mats: [18, 55, 4, 15, 8], ground: G_ASPHALT, rareMult: 1.2,
    items: [['wreck', 10], ['hull', 10], ['thruster', 8], ['plate', 18], ['bolt', 12], ['pipe', 10], ['ring', 8], ['canister', 6], ['gear', 8]],
  },
  {
    name: 'Pedreira de Meteoros', density: 1.1, mats: [10, 30, 25, 30, 5], ground: G_GRAVEL, rareMult: 0.9,
    items: [['meteor', 30], ['amber', 22], ['shard', 14], ['crystal', 10], ['boulder', 6], ['crate', 6], ['pipe', 4]],
  },
  {
    name: 'Refinaria Abandonada', density: 1.25, mats: [15, 45, 8, 12, 20], ground: G_CONCRETE, rareMult: 1.3,
    items: [['canister', 18], ['pipe', 16], ['cell', 10], ['plate', 12], ['gear', 10], ['crate', 10], ['thruster', 4], ['goo', 8], ['satellite', 3], ['dish', 4]],
  },
  {
    name: 'Ruínas Ancestrais', density: 0.95, mats: [20, 20, 20, 20, 20], ground: G_RUINFLOOR, rareMult: 3,
    items: [['cube', 16], ['amber', 10], ['crystal', 12], ['meteor', 10], ['chip', 8], ['pod', 8], ['antenna', 6], ['ufo', 3], ['shard', 10], ['boulder', 2]],
  },
];

export const BIG_ITEMS = new Set<ItemKind>(['hull', 'thruster', 'wreck', 'droid', 'satellite', 'boulder']);
