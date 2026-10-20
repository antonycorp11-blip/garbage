export const G_DIRT = 0, G_EARTH = 1, G_CONCRETE = 2, G_ASPHALT = 3, G_GRAVEL = 4, G_RUINFLOOR = 5;
export const GROUND_COUNT = 6;

export const R_CLEARING = 0, R_DOMESTIC = 1, R_TIRES = 2, R_ELECTRONICS = 3, R_CARS = 4, R_CONSTRUCTION = 5, R_INDUSTRIAL = 6, R_MYSTERY = 7;

export type ItemKind =
  | 'bag' | 'bottle' | 'glassbottle' | 'can' | 'paper' | 'newspaper' | 'box' | 'tire' | 'chair' | 'fridge'
  | 'washer' | 'crt' | 'monitor' | 'wires' | 'brick' | 'rubble' | 'scrap' | 'barrel' | 'cardoor' | 'carwreck'
  | 'pallet' | 'sofa' | 'pipe' | 'keyboard' | 'circuit' | 'hubcap' | 'engine' | 'cone' | 'mattress' | 'tvset'
  | 'duck' | 'shoe' | 'heap';

export interface RegionDef {
  name: string;
  density: number;
  /** weights for plastic, metal, paper, glass, electronics */
  mats: [number, number, number, number, number];
  items: [ItemKind, number][];
  ground: number;
  rareMult: number;
}

export const REGIONS: RegionDef[] = [
  { name: 'Clareira', density: 0, mats: [1, 1, 1, 1, 0], items: [['bag', 1]], ground: G_EARTH, rareMult: 1 },
  {
    name: 'Lixão Doméstico', density: 1, mats: [40, 12, 30, 15, 3], ground: G_DIRT, rareMult: 1,
    items: [['bag', 30], ['bottle', 14], ['glassbottle', 8], ['can', 12], ['paper', 12], ['newspaper', 8], ['box', 14], ['chair', 4], ['shoe', 4], ['duck', 1], ['mattress', 2], ['sofa', 2], ['fridge', 2], ['washer', 1], ['tvset', 1]],
  },
  {
    name: 'Mar de Pneus', density: 1.15, mats: [55, 25, 8, 6, 6], ground: G_GRAVEL, rareMult: 0.8,
    items: [['tire', 60], ['hubcap', 8], ['can', 6], ['bag', 8], ['scrap', 6], ['barrel', 4], ['cone', 4]],
  },
  {
    name: 'Cemitério Eletrônico', density: 1.05, mats: [20, 22, 6, 12, 40], ground: G_CONCRETE, rareMult: 1.6,
    items: [['crt', 18], ['monitor', 16], ['keyboard', 12], ['circuit', 14], ['wires', 18], ['tvset', 8], ['box', 8], ['bag', 6], ['washer', 2]],
  },
  {
    name: 'Cemitério de Automóveis', density: 1.2, mats: [18, 55, 4, 15, 8], ground: G_ASPHALT, rareMult: 1.2,
    items: [['carwreck', 10], ['cardoor', 12], ['tire', 18], ['hubcap', 10], ['engine', 8], ['scrap', 18], ['barrel', 6], ['can', 6]],
  },
  {
    name: 'Entulho de Obra', density: 1.1, mats: [10, 30, 25, 30, 5], ground: G_GRAVEL, rareMult: 0.9,
    items: [['rubble', 30], ['brick', 25], ['pallet', 12], ['pipe', 10], ['cone', 6], ['box', 6], ['bag', 6], ['scrap', 6]],
  },
  {
    name: 'Zona Industrial', density: 1.25, mats: [15, 45, 8, 12, 20], ground: G_CONCRETE, rareMult: 1.3,
    items: [['barrel', 20], ['scrap', 22], ['pipe', 14], ['engine', 6], ['pallet', 10], ['wires', 10], ['circuit', 4], ['box', 6], ['tire', 6]],
  },
  {
    name: 'Ruínas Soterradas', density: 0.95, mats: [20, 20, 20, 20, 20], ground: G_RUINFLOOR, rareMult: 3,
    items: [['rubble', 20], ['brick', 14], ['tvset', 8], ['crt', 6], ['box', 8], ['bag', 10], ['scrap', 8], ['duck', 3], ['newspaper', 8], ['glassbottle', 8], ['mattress', 4]],
  },
];

export const BIG_ITEMS = new Set<ItemKind>(['fridge', 'washer', 'carwreck', 'sofa', 'mattress', 'engine']);
