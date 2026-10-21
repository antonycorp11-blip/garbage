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
    id: 'diary1', name: 'Diário de Bordo (parte 1)', size: 1, dist: [8, 13], openTime: 0, effect: 'none', money: 40,
    text: '"Registro 1. Fui contratado para zelar por este planeta. Ele veio com um detalhe: a Federação despeja o lixo da galáxia aqui. Achei que era piada. Não era."',
  },
  {
    id: 'tv', name: 'Rádio Pirata Ainda Ligado', size: 1, dist: [12, 20], openTime: 0, effect: 'tvAds', money: 150,
    text: 'Um rádio de nave sem bateria, transmitindo anúncios de uma galáxia que nem existe mais. Ninguém sabe como. Ninguém quer saber.',
    effectText: 'O rádio agora transmite "ofertas" de vez em quando.',
  },
  {
    id: 'safe', name: 'Cofre de Carga Lacrado', size: 1, dist: [15, 24], openTime: 3, effect: 'none', money: 3000,
    text: 'Depois de muito chacoalhar, o lacre cede. Dentro: créditos e um bilhete em sete idiomas, todos dizendo "NÃO É MEU".',
  },
  {
    id: 'robot', name: 'Droide Abandonado "Zezinho"', size: 1, dist: [20, 32], openTime: 2, effect: 'robotBonus', money: 500,
    text: 'Zezinho ligou, olhou em volta e disse: "De novo isso?". Ele agora ensina seus robôs a trabalhar em equipe.',
    effectText: '+1 robô em cada estação.',
  },
  {
    id: 'diary2', name: 'Diário de Bordo (parte 2)', size: 1, dist: [24, 36], openTime: 0, effect: 'none', money: 200,
    text: '"Registro 340. Achei o chão. É lilás. Um bichinho de geleia me olhou e fugiu para baixo da terra. Acho que ele mora aqui. Acho que nós é que somos o lixo."',
  },
  {
    id: 'beetle', name: 'Nave de Corrida Dourada', size: 2, dist: [30, 42], openTime: 4, effect: 'none', money: 18000,
    text: 'Uma nave de corrida banhada a ouro, com dados de pelúcia no painel. Um colecionador de três estrelas daqui pagou na hora, sem perguntas.',
  },
  {
    id: 'ancient', name: 'A Máquina que Nunca Desligou', size: 1, dist: [34, 48], openTime: 0, effect: 'ancientMachine',
    text: 'Embaixo de toneladas de sucata, uma máquina dos Glubs zumbindo há séculos. Ela coleta qualquer coisa e o material aparece no seu posto.',
    effectText: 'Coletor Ancestral ativado: trabalha sozinho e entrega direto no posto.',
  },
  {
    id: 'container', name: 'Contêiner da Federação', size: 2, dist: [40, 56], openTime: 5, effect: 'none', money: 2000,
    mats: [0, 400, 0, 0, 300, 25],
    text: 'Etiqueta: "FRÁGIL — NÃO ABRIR — ISSO VALE PARA VOCÊ, ROBÔ". Você abriu. Estava cheio de liga estelar e células de plasma.',
  },
  {
    id: 'diary3', name: 'Diário de Bordo (parte 3)', size: 1, dist: [46, 62], openTime: 0, effect: 'none', money: 600,
    text: '"Registro 2.019. Montei um ajudante com peças de sobra. Ele tem um olho só e muita vontade. Batizei de BIP. Ele bipou de volta. Foi o melhor dia em anos."',
  },
  {
    id: 'bunker', name: 'Observatório Enterrado', size: 2, dist: [50, 68], openTime: 4, effect: 'radar', money: 5000,
    text: 'Um observatório com mapas de calor do planeta inteiro. Alguém estava contando a sucata. Até o último parafuso.',
    effectText: 'Radar desbloqueado: o mapa mostra densidades e um indicador aponta a sucata mais próxima.',
  },
  {
    id: 'egg', name: 'Ovo Cósmico de Cristal', size: 1, dist: [58, 76], openTime: 0, effect: 'none', money: 250000,
    text: 'Um ovo de cristal que canta baixinho. Um museu de quatro galáxias pagou uma fortuna. Os Glubs juram que era só um enfeite.',
  },
  {
    id: 'statue', name: 'Estátua do Grande Glub', size: 2, dist: [55, 78], openTime: 0, effect: 'statue', money: 1000,
    text: 'Uma estátua de jade de um Glub segurando uma vassourinha com olhar heroico. A placa diz: "ELE TENTOU". Você se sente inspirado.',
    effectText: '+15% velocidade de coleta e +15% velocidade das máquinas.',
  },
  {
    id: 'diary4', name: 'Diário de Bordo (última página)', size: 1, dist: [68, 84], openTime: 0, effect: 'none', money: 2000,
    text: '"Registro 9.999. Estou velho e enferrujado. Desliguei o BIP para ele não ver o tamanho do problema. Se você está lendo isto, BIP... me desculpe. E obrigado. — V."',
  },
  {
    id: 'alien', name: 'Núcleo do Raio Trator', size: 1, dist: [74, 90], mystery: true, openTime: 6, effect: 'alien', money: 0,
    text: 'Uma esfera que flutua 2 cm acima do chão e zumbe em outra dimensão. O manual diz apenas: "OBRIGADO POR RECICLAR".',
    effectText: 'Raio Trator 60% mais barato e +25% velocidade das máquinas.',
  },
  {
    id: 'crown', name: 'A Coroa dos Glubs', size: 1, dist: [82, 92], mystery: true, openTime: 3, effect: 'crown', money: 100000, mats: [0, 0, 0, 0, 0, 100],
    text: 'Feita de cristal, âmbar e um anel de nave. Os Glubs a guardaram por séculos para quem limpasse o planeta. Ela é sua por direito. Os Glubs fazem fila para te coroar.',
    effectText: 'Valor de todos os materiais +25%.',
  },
];
