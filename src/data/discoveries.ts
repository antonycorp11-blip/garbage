export type DiscoveryEffect =
  | 'tvAds' | 'robotBonus' | 'ancientMachine' | 'radar' | 'statue' | 'alien' | 'crown' | 'none';

export interface DiscoveryDef {
  id: string;
  name: string;
  size: number;
  dist: [number, number];
  mystery?: boolean;
  /** seconds of holding interact to open; 0 = revealed instantly */
  openTime: number;
  text: string;
  money?: number;
  mats?: number[];
  effect: DiscoveryEffect;
  effectText?: string;
}

export const DISCOVERIES: DiscoveryDef[] = [
  {
    id: 'diary1', name: 'Página de Diário Amassada', size: 1, dist: [8, 13], openTime: 0, effect: 'none', money: 40,
    text: '"Dia 1. Comprei o terreno por R$ 1,00. O corretor riu muito. Eu também ri. Acho que rimos de coisas diferentes."',
  },
  {
    id: 'tv', name: 'Televisão Ainda Ligada', size: 1, dist: [12, 20], openTime: 0, effect: 'tvAds', money: 150,
    text: 'Uma TV de tubo, sem tomada, transmitindo propaganda de 1987. Ninguém sabe como. Ninguém quer saber.',
    effectText: 'A TV agora transmite "ofertas" de vez em quando.',
  },
  {
    id: 'safe', name: 'Cofre Trancado', size: 1, dist: [15, 24], openTime: 3, effect: 'none', money: 3000,
    text: 'Depois de muito chacoalhar, o cofre cede. Dentro: dinheiro e um bilhete escrito "NÃO É MEU".',
  },
  {
    id: 'robot', name: 'Robô Abandonado "Zezinho"', size: 1, dist: [20, 32], openTime: 2, effect: 'robotBonus', money: 500,
    text: 'Zezinho ligou, olhou em volta e disse: "De novo isso?". Ele agora ensina seus robôs a trabalhar em equipe.',
    effectText: '+1 robô em cada estação.',
  },
  {
    id: 'diary2', name: 'Página de Diário Manchada', size: 1, dist: [24, 36], openTime: 0, effect: 'none', money: 200,
    text: '"Dia 340. Achei o chão. Era marrom. Chorei. O chão não se importou."',
  },
  {
    id: 'beetle', name: 'Fusca Banhado a Ouro', size: 2, dist: [30, 42], openTime: 4, effect: 'none', money: 18000,
    text: 'Um fusca dourado com 12 mil km rodados e um dado de pelúcia no retrovisor. Um colecionador pagou na hora, em espécie, sem perguntas.',
  },
  {
    id: 'ancient', name: 'A Máquina que Nunca Desligou', size: 1, dist: [34, 48], openTime: 0, effect: 'ancientMachine',
    text: 'Embaixo de toneladas de entulho, uma máquina zumbindo há décadas. Ela coleta lixo e o material simplesmente... aparece no seu depósito.',
    effectText: 'Coletor Ancestral ativado: trabalha sozinho e entrega direto no depósito.',
  },
  {
    id: 'container', name: 'Contêiner Misterioso', size: 2, dist: [40, 56], openTime: 5, effect: 'none', money: 2000,
    mats: [0, 400, 0, 0, 300, 25],
    text: 'Etiqueta: "FRÁGIL — NÃO ABRIR — ISSO VALE PARA VOCÊ". Você abriu. Estava cheio de componentes.',
  },
  {
    id: 'diary3', name: 'Página de Diário Queimada', size: 1, dist: [46, 62], openTime: 0, effect: 'none', money: 600,
    text: '"Dia 2.019. Construí uma máquina para me ajudar. Ela pediu férias. Desliguei. Ela pediu um advogado."',
  },
  {
    id: 'bunker', name: 'Bunker Subterrâneo', size: 2, dist: [50, 68], openTime: 4, effect: 'radar', money: 5000,
    text: 'Um bunker com mapas de calor do terreno inteiro. Alguém estava contando o lixo. Até o último pedaço.',
    effectText: 'Radar de Lixo desbloqueado: o mapa mostra densidades e um indicador aponta o lixo mais próximo.',
  },
  {
    id: 'egg', name: 'Ovo de Plástico Banhado a Ouro', size: 1, dist: [58, 76], openTime: 0, effect: 'none', money: 250000,
    text: 'Um ovo de páscoa de plástico, banhado a ouro, com um certificado de autenticidade assinado por ninguém. Valor estimado: absurdo.',
  },
  {
    id: 'statue', name: 'Estátua do Fundador', size: 2, dist: [55, 78], openTime: 0, effect: 'statue', money: 1000,
    text: 'Uma estátua de alguém segurando uma vassoura com olhar heroico. A placa diz: "ELE TENTOU". Você se sente inspirado.',
    effectText: '+15% velocidade de coleta e +15% velocidade das máquinas.',
  },
  {
    id: 'diary4', name: 'Última Página do Diário', size: 1, dist: [68, 84], openTime: 0, effect: 'none', money: 2000,
    text: '"Dia 9.999. Encontrei algo que não é daqui. Ele zumbe quando penso em limpeza. Vou enterrar de novo. Talvez o próximo dono tenha mais coragem."',
  },
  {
    id: 'alien', name: 'Dispositivo Não-Terrestre', size: 1, dist: [74, 90], mystery: true, openTime: 6, effect: 'alien', money: 0,
    text: 'Uma esfera que flutua 2 cm acima do chão e emite um som de aspirador de pó em outra dimensão. O manual diz apenas: "OBRIGADO POR RECICLAR".',
    effectText: 'Sistema de Coleta Avançado 60% mais barato e +25% velocidade das máquinas.',
  },
  {
    id: 'crown', name: 'A Coroa do Reino do Lixo', size: 1, dist: [82, 92], mystery: true, openTime: 3, effect: 'crown', money: 100000, mats: [0, 0, 0, 0, 0, 100],
    text: 'Feita de tampinhas de garrafa, lacres de lata e um anel de cebola petrificado. Ela é sua por direito. Você é, oficialmente, Majestade do Lixo.',
    effectText: 'Valor de todos os materiais +25%.',
  },
];
