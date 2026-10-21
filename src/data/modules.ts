/**
 * BIP's swappable modules. The arm slot is the tool line (TOOLS); the other slots hold one
 * module each, chosen in the workshop. Every module changes how BIP looks and plays.
 */
export type ModuleSlot = 'move' | 'tank' | 'sensor';

export interface ModuleEffects {
  /** multiplies move speed */
  speed?: number;
  /** multiplies how much junk slows BIP down (0 = ignores junk) */
  slow?: number;
  /** multiplies backpack capacity */
  cap?: number;
  /** extra reach for single-target arms (tiles) */
  reach?: number;
  /** multiplies material value */
  value?: number;
  /** multiplies relic find chance */
  rare?: number;
  /** shows discoveries on the map/compass */
  radar?: boolean;
  /** seconds between automatic teleports of the backpack to the depot (0 = off) */
  teleport?: number;
}

export interface ModuleDef {
  id: string;
  slot: ModuleSlot;
  name: string;
  desc: string;
  money: number;
  mats: number[];
  /** unlocked by a contract reward (blueprint) instead of being available from the start */
  blueprint: boolean;
  fx: ModuleEffects;
}

export const SLOT_NAMES: Record<ModuleSlot, string> = { move: 'Locomoção', tank: 'Tanque', sensor: 'Sensor' };

export const MODULES: ModuleDef[] = [
  // locomotion
  { id: 'wheel', slot: 'move', name: 'Monociclo', desc: 'Uma roda, muita fé. Rápido no chão limpo, sofre no meio da sucata.', money: 0, mats: [0, 0, 0, 0, 0, 0], blueprint: false, fx: {} },
  { id: 'treads', slot: 'move', name: 'Esteiras de Trator', desc: 'Passa por cima de qualquer pilha sem perder velocidade. Um pouco mais lento no limpo.', money: 900, mats: [0, 60, 0, 0, 10, 0], blueprint: false, fx: { speed: 0.92, slow: 0 } },
  { id: 'legs', slot: 'move', name: 'Patas de Aranha', desc: 'Seis patas articuladas: alcança mais longe e tropeça menos.', money: 6000, mats: [0, 160, 0, 40, 40, 0], blueprint: true, fx: { speed: 1.08, slow: 0.4, reach: 0.6 } },
  { id: 'hover', slot: 'move', name: 'Propulsor Hover', desc: 'Flutua acima de tudo. O mais rápido de todos, mas o jato ocupa espaço do tanque.', money: 40000, mats: [300, 500, 0, 0, 200, 0], blueprint: true, fx: { speed: 1.45, slow: 0.3, cap: 0.85 } },
  // tanks
  { id: 'tank', slot: 'tank', name: 'Tanque Padrão', desc: 'Um balde de metal com ambições.', money: 0, mats: [0, 0, 0, 0, 0, 0], blueprint: false, fx: {} },
  { id: 'compactor', slot: 'tank', name: 'Compactador', desc: 'Esmaga a carga: +60% de capacidade, mas o peso deixa BIP mais lento.', money: 2500, mats: [0, 120, 0, 0, 20, 0], blueprint: false, fx: { cap: 1.6, speed: 0.9 } },
  { id: 'quantum', slot: 'tank', name: 'Tanque Quântico', desc: 'A cada 15 s teleporta a carga direto para o depósito. Física? Nunca ouvi falar.', money: 90000, mats: [800, 600, 400, 400, 400, 2], blueprint: true, fx: { cap: 1.2, teleport: 15 } },
  // sensors
  { id: 'eye', slot: 'sensor', name: 'Olho Básico', desc: 'Enxerga. Na maioria dos dias.', money: 0, mats: [0, 0, 0, 0, 0, 0], blueprint: false, fx: {} },
  { id: 'radar', slot: 'sensor', name: 'Antena Radar', desc: 'Mostra no mapa onde estão as descobertas enterradas.', money: 3000, mats: [0, 80, 0, 0, 40, 0], blueprint: false, fx: { radar: true } },
  { id: 'scanner', slot: 'sensor', name: 'Scanner Prismático', desc: 'Lê a composição de tudo: +12% de valor nos materiais e o dobro de relíquias.', money: 25000, mats: [200, 0, 0, 200, 150, 1], blueprint: true, fx: { value: 1.12, rare: 2, radar: true } },
];

export const MODULE_MAP: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const DEFAULT_LOADOUT: Record<ModuleSlot, string> = { move: 'wheel', tank: 'tank', sensor: 'eye' };
