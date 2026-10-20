export type MachineType = 'collector' | 'arm' | 'conveyor' | 'separator' | 'crusher' | 'robots' | 'excavator' | 'recycler' | 'ancient' | 'depot';

export interface MachineDef {
  type: MachineType;
  name: string;
  short: string;
  desc: string;
  size: number;
  money: number;
  mats: number[];
  costGrowth: number;
  rate: number;
  radius: number;
  buffer: number;
  unlock: string | null;
  solid: boolean;
  buildable: boolean;
}

export const MACHINES: Record<MachineType, MachineDef> = {
  collector: {
    type: 'collector', name: 'Coletor Automático', short: 'Coletor', size: 1, money: 120, mats: [0, 15, 0, 0, 0, 0], costGrowth: 1.13,
    rate: 1.3, radius: 3, buffer: 60, unlock: null, solid: false, buildable: true,
    desc: 'Pequeno, barulhento e incansável. Suga o lixo ao redor e guarda numa caçamba.',
  },
  arm: {
    type: 'arm', name: 'Braço Mecânico', short: 'Braço', size: 1, money: 900, mats: [0, 45, 0, 0, 8, 0], costGrowth: 1.14,
    rate: 4.5, radius: 2.3, buffer: 140, unlock: 'a_arm', solid: false, buildable: true,
    desc: 'Um braço hidráulico que agarra objetos próximos com precisão cirúrgica e zero empatia.',
  },
  conveyor: {
    type: 'conveyor', name: 'Esteira Transportadora', short: 'Esteira', size: 1, money: 6, mats: [0, 1, 0, 0, 0, 0], costGrowth: 1,
    rate: 0, radius: 0, buffer: 0, unlock: 'a_belts', solid: false, buildable: true,
    desc: 'Leva materiais das máquinas até o depósito. Arraste para construir em linha.',
  },
  separator: {
    type: 'separator', name: 'Separador de Materiais', short: 'Separador', size: 1, money: 1800, mats: [0, 60, 0, 0, 30, 0], costGrowth: 1.25,
    rate: 0, radius: 0, buffer: 0, unlock: 'r_sep', solid: false, buildable: true,
    desc: 'Instale no meio de uma esteira. Classifica o que passa e aumenta o valor pago no depósito.',
  },
  crusher: {
    type: 'crusher', name: 'Triturador Industrial', short: 'Triturador', size: 2, money: 15000, mats: [0, 400, 0, 0, 60, 0], costGrowth: 1.3,
    rate: 32, radius: 5.2, buffer: 900, unlock: 'a_crusher', solid: true, buildable: true,
    desc: 'Mastiga pilhas inteiras. Faz um barulho que assusta até as ratazanas.',
  },
  robots: {
    type: 'robots', name: 'Estação de Robôs Catadores', short: 'Robôs', size: 1, money: 6000, mats: [0, 120, 0, 0, 80, 0], costGrowth: 1.28,
    rate: 6, radius: 12, buffer: 600, unlock: 'a_robots', solid: false, buildable: true,
    desc: 'Robôs autônomos voam até o lixo, enchem a barriga e voltam para a estação.',
  },
  excavator: {
    type: 'excavator', name: 'Escavadeira Automatizada', short: 'Escavadeira', size: 2, money: 120000, mats: [0, 2500, 0, 0, 400, 0], costGrowth: 1.35,
    rate: 90, radius: 22, buffer: 5000, unlock: 'a_excav', solid: true, buildable: true,
    desc: 'Uma garagem com uma escavadeira que não precisa de motorista nem de café.',
  },
  recycler: {
    type: 'recycler', name: 'Central de Reciclagem', short: 'Central', size: 3, money: 400000, mats: [3000, 6000, 3000, 3000, 1500, 0], costGrowth: 2.5,
    rate: 0, radius: 10, buffer: 0, unlock: 'r_center', solid: true, buildable: true,
    desc: 'Um novo depósito: recebe materiais e esteiras, +15% valor dos materiais e +10% velocidade das máquinas (até 3).',
  },
  ancient: {
    type: 'ancient', name: 'Coletor Ancestral', short: 'Ancestral', size: 1, money: 0, mats: [0, 0, 0, 0, 0, 0], costGrowth: 1,
    rate: 6, radius: 5, buffer: 0, unlock: null, solid: false, buildable: false,
    desc: 'Ninguém sabe quem construiu. O material coletado aparece direto no depósito.',
  },
  depot: {
    type: 'depot', name: 'Depósito Improvisado', short: 'Depósito', size: 3, money: 0, mats: [0, 0, 0, 0, 0, 0], costGrowth: 1,
    rate: 0, radius: 6, buffer: 0, unlock: null, solid: true, buildable: false,
    desc: 'Lona, estacas e uma balança enferrujada. Descarregue aqui. Máquinas próximas entregam sozinhas.',
  },
};

export const BUILD_ORDER: MachineType[] = ['collector', 'arm', 'conveyor', 'separator', 'robots', 'crusher', 'excavator', 'recycler'];
export const MAX_MACHINE_LEVEL = 5;

export function machineUpgradeCost(type: MachineType, level: number): number {
  const d = MACHINES[type];
  return Math.ceil(Math.max(80, d.money) * 0.75 * Math.pow(1.9, level - 1));
}
