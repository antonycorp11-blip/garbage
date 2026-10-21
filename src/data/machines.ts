export type MachineType = 'collector' | 'arm' | 'conveyor' | 'separator' | 'crusher' | 'robots' | 'excavator' | 'recycler' | 'ancient' | 'depot' | 'beacon' | 'harvester' | 'drill' | 'vortex';

export type MachineRole = 'coleta' | 'logistica' | 'processamento' | 'deposito';

export interface MachineDef {
  type: MachineType;
  name: string;
  short: string;
  role: MachineRole;
  /** one line: what problem this machine solves */
  func: string;
  desc: string;
  size: number;
  money: number;
  mats: number[];
  costGrowth: number;
  /** garbage removed per second (collection machines) */
  rate: number;
  radius: number;
  buffer: number;
  /** can lift heavy rubble (the base of dense piles) */
  heavy: boolean;
  /** units/s the depot yard processes thanks to this building */
  process: number;
  /** extra yard capacity */
  yard: number;
  /** must be built inside a depot's service circle */
  needsService: boolean;
  unlock: string | null;
  solid: boolean;
  buildable: boolean;
}

const D = { heavy: false, process: 0, yard: 0, needsService: false };

export const MACHINES: Record<MachineType, MachineDef> = {
  collector: {
    ...D, type: 'collector', name: 'Coletor de Sucata', short: 'Coletor', role: 'coleta', size: 1, money: 120, mats: [0, 15, 0, 0, 0, 0], costGrowth: 1.17,
    rate: 1.8, radius: 3.5, buffer: 80, unlock: null, solid: false, buildable: true,
    func: 'Aspira a sucata leve ao redor e, quando acaba, anda sozinho até a próxima pilha da sua zona.',
    desc: 'Barato e incansável. Fica dentro da zona onde foi construído (ela cresce com o nível). Se estiver ligado a uma esteira, fica parado.',
  },
  arm: {
    ...D, type: 'arm', name: 'Guindaste Hidráulico', short: 'Guindaste', role: 'coleta', size: 1, money: 900, mats: [0, 45, 0, 0, 8, 0], costGrowth: 1.18,
    rate: 3.5, radius: 3, buffer: 160, heavy: true, unlock: 'a_arm', solid: false, buildable: true,
    func: 'Ergue a sucata pesada: a base das pilhas que coletores e drones não conseguem.',
    desc: 'Cascos de nave, motores e satélites? Ele ergue. Coloque no meio das pilhas grandes que sobraram.',
  },
  conveyor: {
    ...D, type: 'conveyor', name: 'Esteira de Energia', short: 'Esteira', role: 'logistica', size: 1, money: 6, mats: [0, 1, 0, 0, 0, 0], costGrowth: 1,
    rate: 0, radius: 0, buffer: 0, unlock: 'a_belts', solid: false, buildable: true,
    func: 'Leva o material de máquinas distantes até o posto.',
    desc: 'Sem ela, máquinas fora do círculo do posto enchem a caçamba e param. Dica: use "Conectar ao posto" no painel da máquina.',
  },
  separator: {
    ...D, type: 'separator', name: 'Separador de Materiais', short: 'Separador', role: 'processamento', size: 1, money: 1800, mats: [0, 60, 0, 0, 30, 0], costGrowth: 1.25,
    rate: 0, radius: 0, buffer: 0, unlock: 'r_sep', solid: false, buildable: true,
    func: 'Peça de esteira: tudo que passa por ele chega aos silos já separado, pula a fila do pátio e vale +35%.',
    desc: 'Coloque no lugar de uma esteira, no meio da linha e apontando para o posto. Sem ele, o que as esteiras trazem entra no pátio e espera ser processado. Com ele, vai direto para os silos.',
  },
  crusher: {
    ...D, type: 'crusher', name: 'Prensa Compactadora', short: 'Prensa', role: 'processamento', size: 2, money: 4000, mats: [0, 180, 0, 0, 30, 0], costGrowth: 1.3,
    rate: 0, radius: 0, buffer: 0, process: 25, yard: 350, needsService: true, unlock: 'a_crusher', solid: true, buildable: true,
    func: 'Processa o pátio do posto: +25/s de vazão e +350 de espaço.',
    desc: 'Quando o pátio lota, as máquinas param de entregar. A prensa mastiga a fila e enche os silos. Precisa ficar dentro do círculo do posto.',
  },
  robots: {
    ...D, type: 'robots', name: 'Hangar de Drones', short: 'Drones', role: 'coleta', size: 1, money: 6000, mats: [0, 120, 0, 0, 80, 0], costGrowth: 1.32,
    rate: 4, radius: 14, buffer: 800, unlock: 'a_robots', solid: false, buildable: true,
    func: 'Drones caçam sucata leve numa área grande e voam direto até o posto mais próximo. Sem esteiras.',
    desc: 'Perfeitos para os restos que as máquinas fixas não alcançam. Preferem pilhas pequenas e espalhadas.',
  },
  excavator: {
    ...D, type: 'excavator', name: 'Mineradora Rotativa', short: 'Mineradora', role: 'coleta', size: 2, money: 120000, mats: [0, 2500, 0, 0, 400, 0], costGrowth: 1.4,
    rate: 45, radius: 24, buffer: 5000, heavy: true, unlock: 'a_excav', solid: true, buildable: true,
    func: 'Demole as montanhas mais densas, inclusive a sucata pesada, em alta velocidade.',
    desc: 'Vai direto nas maiores pilhas da área. Gera tanto material que vai precisar de esteiras e trituradores.',
  },
  recycler: {
    ...D, type: 'recycler', name: 'Refinaria Estelar', short: 'Refinaria', role: 'deposito', size: 3, money: 400000, mats: [3000, 6000, 3000, 3000, 1500, 0], costGrowth: 2.5,
    rate: 0, radius: 10, buffer: 0, process: 300, yard: 3000, unlock: 'r_center', solid: true, buildable: true,
    func: 'Um segundo posto gigante: +300/s de vazão, recebe esteiras e dá +15% de valor.',
    desc: 'Para o fluxo massivo do fim do jogo. Também acelera as máquinas em 10% (até 3 refinarias).',
  },
  harvester: {
    ...D, type: 'harvester', name: 'Colheitadeira Autônoma', short: 'Colheitadeira', role: 'coleta', size: 2, money: 18000, mats: [0, 400, 100, 0, 120, 0], costGrowth: 1.35,
    rate: 22, radius: 20, buffer: 0, unlock: 'a_harvest', solid: true, buildable: true,
    func: 'Uma garagem com um rover que varre a sucata leve numa área enorme e leva direto ao posto. Sem esteiras.',
    desc: 'O rover vai nas pilhas mais cheias, enche a caçamba de 300 e volta sozinho. No nível 3 e 5 a garagem ganha mais um rover.',
  },
  drill: {
    ...D, type: 'drill', name: 'Perfuratriz Sísmica', short: 'Perfuratriz', role: 'coleta', size: 3, money: 120000, mats: [0, 1500, 0, 500, 400, 0], costGrowth: 1.45,
    rate: 90, radius: 7, buffer: 4000, heavy: true, unlock: 'a_drill', solid: true, buildable: true,
    func: 'Arranca tudo, até a sucata pesada, num raio de 7 m e muito rápido (90/s). Precisa entregar por esteira, Teleportador ou círculo do posto.',
    desc: 'Cada pulso sísmico solta a sucata do chão. Coloque no meio das montanhas mais densas e ligue a uma linha com separador.',
  },
  vortex: {
    ...D, type: 'vortex', name: 'Vórtice Coletor', short: 'Vórtice', role: 'coleta', size: 2, money: 1200000, mats: [3000, 3000, 2000, 2000, 2000, 10], costGrowth: 1.6,
    rate: 160, radius: 28, buffer: 0, heavy: true, unlock: 'a_vortex', solid: true, buildable: true,
    func: 'Um redemoinho de plasma passeia pela área devorando tudo e teletransporta direto para os silos.',
    desc: 'Tecnologia dos antigos donos do planeta. Os Glubs se escondem quando ele passa.',
  },
  beacon: {
    ...D, type: 'beacon', name: 'Teleportador de Carga', short: 'Teleportador', role: 'deposito', size: 2, money: 2500, mats: [0, 120, 0, 0, 40, 0], costGrowth: 1.6,
    rate: 0, radius: 5, buffer: 0, unlock: 'a_belts', solid: true, buildable: true,
    func: 'Um mini-posto longe da base: recebe esteiras, máquinas no círculo e a sua descarga, e teletransporta tudo para os silos.',
    desc: 'Construa nas frentes de trabalho distantes. Não processa nada sozinho: o material entra no pátio do posto principal.',
  },
  ancient: {
    ...D, type: 'ancient', name: 'Obelisco Ancestral', short: 'Obelisco', role: 'coleta', size: 1, money: 0, mats: [0, 0, 0, 0, 0, 0], costGrowth: 1,
    rate: 6, radius: 5, buffer: 0, heavy: true, unlock: null, solid: false, buildable: false,
    func: 'Coleta qualquer coisa e entrega direto no posto.',
    desc: 'Os Glubs dizem que sempre esteve aqui. O material coletado aparece direto nos silos.',
  },
  depot: {
    ...D, type: 'depot', name: 'Posto Avançado', short: 'Posto', role: 'deposito', size: 3, money: 0, mats: [0, 0, 0, 0, 0, 0], costGrowth: 1,
    rate: 0, radius: 6, buffer: 0, process: 10, yard: 250, unlock: null, solid: true, buildable: false,
    func: 'Recebe e processa os materiais nos silos. Máquinas no círculo entregam sozinhas.',
    desc: 'O posto do Valdemar: silos, um escritório-cápsula e a plataforma do ônibus da MÃE. Descarregue aqui.',
  },
};

export const BUILD_ORDER: MachineType[] = ['collector', 'arm', 'robots', 'harvester', 'excavator', 'drill', 'vortex', 'conveyor', 'separator', 'crusher', 'beacon', 'recycler'];
export const ROLE_NAMES: Record<MachineRole, string> = {
  coleta: 'Coleta — tiram a sucata do terreno',
  logistica: 'Logística — levam o material até o posto',
  processamento: 'Processamento — o posto dar conta de tudo',
  deposito: 'Postos',
};
export const MAX_MACHINE_LEVEL = 5;

export function machineUpgradeCost(type: MachineType, level: number): number {
  const d = MACHINES[type];
  return Math.ceil(Math.max(80, d.money) * 0.75 * Math.pow(1.9, level - 1));
}
