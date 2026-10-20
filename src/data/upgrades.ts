export type Branch = 'coleta' | 'automacao' | 'reciclagem';

export interface UpgradeDef {
  id: string;
  branch: Branch;
  name: string;
  desc: string;
  /** describes the effect per level */
  effect: string;
  icon: string;
  max: number;
  base: number;
  growth: number;
  req: [string, number][];
  col: number;
  row: number;
}

export const BRANCHES: { id: Branch; name: string; color: string }[] = [
  { id: 'coleta', name: 'Coleta', color: '#ffb02e' },
  { id: 'automacao', name: 'Automação', color: '#38bdf8' },
  { id: 'reciclagem', name: 'Reciclagem', color: '#4ade80' },
];

export const UPGRADES: UpgradeDef[] = [
  // ---- COLETA ----
  { id: 'c_bag', branch: 'coleta', name: 'Mochila Reforçada', icon: '🎒', desc: 'Costuramos outra mochila por cima da mochila.', effect: '+55% capacidade', max: 14, base: 18, growth: 1.75, req: [], col: 1, row: 0 },
  { id: 'c_speed', branch: 'coleta', name: 'Luvas Turbinadas', icon: '🧤', desc: 'Luvas com fita isolante nos dedos. Aerodinâmica.', effect: '+15% velocidade de coleta', max: 10, base: 30, growth: 1.7, req: [], col: 0, row: 1 },
  { id: 'c_move', branch: 'coleta', name: 'Botas de Borracha', icon: '🥾', desc: 'Atravesse pilhas de lixo sem perder o ritmo (nem as meias).', effect: '+10% movimento, menos lentidão no lixo', max: 6, base: 45, growth: 2.1, req: [['c_bag', 1]], col: 2, row: 1 },
  { id: 'c_unload', branch: 'coleta', name: 'Descarga Rápida', icon: '⏬', desc: 'Virar a mochila de cabeça para baixo. Técnica milenar.', effect: '×1,8 velocidade de descarga', max: 5, base: 120, growth: 2.4, req: [['c_bag', 2]], col: 1, row: 2 },
  { id: 'c_force', branch: 'coleta', name: 'Força Bruta', icon: '💪', desc: 'Academia? Não. Só carregar geladeira o dia todo.', effect: '+1 objeto por ação, +10% coleta em área', max: 8, base: 260, growth: 2.2, req: [['c_speed', 3]], col: 0, row: 2 },
  { id: 'c_reach', branch: 'coleta', name: 'Braço Extensor', icon: '🦾', desc: 'Um cabo de vassoura colado no cotovelo.', effect: '+15% alcance e raio', max: 5, base: 400, growth: 2.5, req: [['c_force', 1]], col: 0, row: 3 },
  { id: 'c_auto', branch: 'coleta', name: 'Ímã de Bolso', icon: '🧲', desc: 'Coisas pequenas grudam em você. Higiene questionável.', effect: 'Coleta passiva ao redor (+1,5/s)', max: 6, base: 700, growth: 2.3, req: [['c_unload', 1], ['c_speed', 2]], col: 1, row: 3 },
  { id: 'c_remote', branch: 'coleta', name: 'Drone de Entrega', icon: '🛸', desc: 'Um drone de segunda mão leva sua mochila ao depósito. Às vezes volta.', effect: 'Esvazia a mochila remotamente', max: 5, base: 2500, growth: 2.6, req: [['c_unload', 2], ['c_bag', 5]], col: 2, row: 3 },
  { id: 'c_treasure', branch: 'coleta', name: 'Faro para Tesouro', icon: '💎', desc: 'Você desenvolve um sexto sentido para coisas caras no meio do lixo.', effect: '+35% chance de raridades', max: 5, base: 1500, growth: 2.4, req: [['c_auto', 1]], col: 1, row: 4 },
  { id: 'c_radar', branch: 'coleta', name: 'Radar de Lixo', icon: '📡', desc: 'Detecta lixo escondido. Bipa de forma irritante.', effect: 'Mapa de calor e seta para o lixo mais próximo', max: 1, base: 60000, growth: 1, req: [['c_treasure', 2], ['c_remote', 1]], col: 1, row: 5 },
  { id: 'c_orbital', branch: 'coleta', name: 'Ímã Orbital', icon: '🛰️', desc: 'Um satélite com um ímã. Aprovado por ninguém.', effect: 'Puxa lixo de qualquer lugar do mapa (+12/s)', max: 6, base: 250000, growth: 2.2, req: [['c_radar', 1], ['a_integr', 1]], col: 2, row: 5 },

  // ---- AUTOMAÇÃO ----
  { id: 'a_speed', branch: 'automacao', name: 'Óleo de Primeira', icon: '🛢️', desc: 'As máquinas agradecem. Os ouvidos também.', effect: '+10% velocidade das máquinas', max: 12, base: 150, growth: 1.8, req: [], col: 1, row: 0 },
  { id: 'a_arm', branch: 'automacao', name: 'Engrenagens', icon: '⚙️', desc: 'Engrenagens recuperadas de 47 bicicletas.', effect: 'Desbloqueia o Braço Mecânico (ergue entulho pesado)', max: 1, base: 400, growth: 1, req: [], col: 0, row: 0 },
  { id: 'a_buffer', branch: 'automacao', name: 'Caçambas Maiores', icon: '🗑️', desc: 'Caçambas maiores. Literalmente só isso.', effect: '+50% armazenamento das máquinas', max: 6, base: 300, growth: 2.1, req: [['a_speed', 1]], col: 2, row: 2 },
  { id: 'a_belts', branch: 'automacao', name: 'Logística', icon: '➡️', desc: 'Descobrimos que coisas podem andar sozinhas em cima de borracha.', effect: 'Desbloqueia Esteiras', max: 1, base: 1200, growth: 1, req: [['a_arm', 1]], col: 0, row: 1 },
  { id: 'a_radius', branch: 'automacao', name: 'Antenas Longas', icon: '📶', desc: 'Antenas de TV soldadas nas máquinas. Alcance e estilo.', effect: '+12% raio das máquinas', max: 5, base: 900, growth: 2.3, req: [['a_speed', 2]], col: 1, row: 1 },
  { id: 'a_beltspeed', branch: 'automacao', name: 'Esteiras Lubrificadas', icon: '⏩', desc: 'Sabão de coco nas esteiras. Funciona.', effect: '+35% velocidade das esteiras', max: 5, base: 2000, growth: 2.2, req: [['a_belts', 1]], col: 0, row: 2 },
  { id: 'a_robots', branch: 'automacao', name: 'Robótica Básica', icon: '🤖', desc: 'Robôs feitos de liquidificadores e boa intenção.', effect: 'Desbloqueia Estação de Robôs', max: 1, base: 4500, growth: 1, req: [['a_belts', 1], ['a_speed', 3]], col: 1, row: 2 },
  { id: 'a_robotcount', branch: 'automacao', name: 'Mais Robôs', icon: '👾', desc: 'Os robôs se reproduzem. Não pergunte como.', effect: '+1 robô por estação', max: 5, base: 9000, growth: 2.4, req: [['a_robots', 1]], col: 1, row: 3 },
  { id: 'a_crusher', branch: 'automacao', name: 'Trituração', icon: '🔩', desc: 'Lâminas industriais encontradas, ironicamente, no lixo.', effect: 'Desbloqueia o Triturador (processa o pátio do depósito)', max: 1, base: 1500, growth: 1, req: [['a_arm', 1]], col: 2, row: 1 },
  { id: 'a_excav', branch: 'automacao', name: 'Maquinário Pesado', icon: '🚜', desc: 'Uma escavadeira autônoma. O sindicato dos catadores está preocupado.', effect: 'Desbloqueia a Escavadeira Automatizada', max: 1, base: 90000, growth: 1, req: [['a_robots', 1], ['a_radius', 2]], col: 1, row: 4 },
  { id: 'a_integr', branch: 'automacao', name: 'Integração Total', icon: '🔗', desc: 'Todas as máquinas num grupo de WhatsApp. A produtividade subiu.', effect: '+20% velocidade de máquinas e robôs', max: 4, base: 200000, growth: 2.5, req: [['a_excav', 1]], col: 1, row: 5 },

  // ---- RECICLAGEM ----
  { id: 'r_value', branch: 'reciclagem', name: 'Triagem Manual', icon: '♻️', desc: 'Separar o lixo do lixo. Mais valioso do que parece.', effect: '+10% valor dos materiais', max: 12, base: 60, growth: 1.75, req: [], col: 1, row: 0 },
  { id: 'r_depot', branch: 'reciclagem', name: 'Depósito Ampliado', icon: '🏚️', desc: 'Mais lona, mais estacas, mais área de serviço.', effect: '+2 raio de serviço, +6/s de vazão e +120 de pátio', max: 6, base: 250, growth: 2.2, req: [['r_value', 1]], col: 0, row: 1 },
  { id: 'r_rare', branch: 'reciclagem', name: 'Olho Clínico', icon: '🔍', desc: 'Aquela tampinha? Edição limitada.', effect: '+40% chance de raridades', max: 5, base: 800, growth: 2.3, req: [['r_value', 2]], col: 2, row: 1 },
  { id: 'r_sep', branch: 'reciclagem', name: 'Separação Óptica', icon: '👁️', desc: 'Uma câmera de segurança velha que reconhece cores.', effect: 'Desbloqueia o Separador', max: 1, base: 3000, growth: 1, req: [['r_value', 3], ['a_belts', 1]], col: 1, row: 2 },
  { id: 'r_discount', branch: 'reciclagem', name: 'Economia Circular', icon: '🔄', desc: 'Construir máquinas com peças de máquinas. Genial.', effect: '-7% custo de máquinas', max: 5, base: 2500, growth: 2.3, req: [['r_value', 4]], col: 0, row: 2 },
  { id: 'r_sepbonus', branch: 'reciclagem', name: 'Classificação Fina', icon: '🧪', desc: 'Separamos plástico por cor, humor e signo.', effect: '+20% bônus do Separador', max: 5, base: 6000, growth: 2.2, req: [['r_sep', 1]], col: 2, row: 2 },
  { id: 'r_metal', branch: 'reciclagem', name: 'Fundição Improvisada', icon: '🔥', desc: 'Uma churrasqueira muito, muito quente.', effect: '+25% valor de metal e eletrônicos', max: 5, base: 9000, growth: 2.3, req: [['r_sep', 1]], col: 1, row: 3 },
  { id: 'r_center', branch: 'reciclagem', name: 'Planta de Reciclagem', icon: '🏭', desc: 'Planta baixa desenhada num guardanapo.', effect: 'Desbloqueia a Central de Reciclagem', max: 1, base: 150000, growth: 1, req: [['r_metal', 2], ['a_crusher', 1]], col: 1, row: 4 },
  { id: 'r_quality', branch: 'reciclagem', name: 'Qualidade Premium', icon: '🏅', desc: 'Lixo gourmet. Os clientes pagam mais pelo storytelling.', effect: '+15% valor dos materiais', max: 5, base: 300000, growth: 2.3, req: [['r_center', 1]], col: 1, row: 5 },
];

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(u: UpgradeDef, level: number): number {
  return Math.ceil(u.base * Math.pow(u.growth, level));
}
