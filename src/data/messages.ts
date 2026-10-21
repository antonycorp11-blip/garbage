export interface Milestone { pct: number; text: string }

export const SENDER = 'Sr. Valdemar, antigo proprietário';

export const INTRO = [
  'Bip-bop! Parabéns pela compra do terreno, pequeno robô! Ele vem com um pequeno detalhe: 1.000.000 de unidades de lixo.',
  'Use WASD/setas para andar e segure o botão do mouse (ou ESPAÇO) sobre o lixo para coletar. No celular: joystick à esquerda, botão COLETAR à direita.',
  'Quando a mochila encher, volte ao depósito no centro. Ele descarrega e vende tudo. Boa sorte. Você vai precisar.',
];

export const MILESTONES: Milestone[] = [
  { pct: 0.0001, text: 'Você retirou 0,01% do lixo. A robotidade agradece. Mais ou menos.' },
  { pct: 0.001, text: '0,1% concluído! Nesse ritmo você termina em... deixa pra lá. Continue.' },
  { pct: 0.005, text: 'Meio por cento! Encontramos um rato aplaudindo. Ou tossindo.' },
  { pct: 0.01, text: '1% do terreno limpo. Alguém já sugeriu construir um estacionamento.' },
  { pct: 0.025, text: '2,5%! A prefeitura mandou uma carta de parabéns. Em papel. Que agora é lixo seu.' },
  { pct: 0.05, text: '5%! O cheiro melhorou 0,3%. Os urubus estão considerando se mudar.' },
  { pct: 0.1, text: '10% limpo. Pela primeira vez em décadas, um passarinho pousou aqui. Ele parecia confuso.' },
  { pct: 0.2, text: '20%! Começaram a aparecer turistas. Eles tiram fotos das pilhas como se fossem montanhas.' },
  { pct: 0.3, text: '30%! Seu nome foi citado num podcast sobre "obsessões questionáveis".' },
  { pct: 0.5, text: 'METADE! 500 mil unidades. Os robôs pediram um bolo. Instalamos uma atualização para resolver isso.' },
  { pct: 0.65, text: '65%. A previsão do tempo agora menciona "possibilidade de chão visível".' },
  { pct: 0.8, text: '80%! Seu reino começa a parecer um lugar. Um lugar estranho, mas um lugar.' },
  { pct: 0.9, text: '90%! Restam só 100 mil. "Só". Que palavra engraçada.' },
  { pct: 0.97, text: '97%. Os últimos pedaços estão escondidos. O Radar de Lixo e o mapa vão ajudar.' },
  { pct: 0.99, text: '99%! Faltam 10 mil unidades. Dá pra ouvir o silêncio do terreno quase limpo.' },
  { pct: 0.999, text: '99,9%. Mil unidades. Mil. Você consegue contar até mil, não consegue?' },
  { pct: 0.9999, text: 'Cem unidades. Cem. Siga a seta. Seja a seta.' },
];

export const RANDOM_MESSAGES = [
  'Seu robô pediu férias. Instalamos uma atualização para resolver o problema.',
  'Dica: máquinas perto do depósito entregam materiais sozinhas. As distantes precisam de esteiras.',
  'Encontramos uma meia. Só uma. A outra continua desaparecida desde 1994.',
  'Lembrete: lixo não volta. Diferente do seu ex.',
  'Dica: clique numa máquina para ver o status, melhorá-la ou esvaziar a caçamba.',
  'Um gato adotou uma das suas máquinas. Ela agora trabalha 2% mais feliz.',
  'Pesquisas indicam que 9 em cada 10 pilhas de lixo são, de fato, lixo.',
  'Dica: segurar o botão de coleta é muito mais eficiente que clicar mil vezes. Seus dedos agradecem.',
  'O sindicato das ratazanas enviou uma reclamação formal. Arquivamos. No lixo.',
  'Dica: a roda do mouse (ou pinça no celular) dá zoom. Olhe ao redor. Contemple. Desespere-se.',
  'Achamos uma planta crescendo numa área limpa. Demos o nome de Esperança. Ela já está murchando.',
  'Dica: os separadores aumentam o valor de tudo que passa pela esteira até o depósito.',
];

export const TV_ADS = [
  '📺 TV: "COMPRE JÁ! Sabão em pó que lava até sua consciência! Ligue agora!"',
  '📺 TV: "Fita cassete virgem! Grave suas novelas favoritas em ALTA fidelidade!"',
  '📺 TV: "Você sofre com excesso de lixo? Nós também. Ligue 0800-SOCORRO."',
  '📺 TV: "Ofertas imperdíveis do Mappin! Promoção válida até 1987."',
  '📺 TV: "Atenção: este canal não existe. Obrigado pela audiência."',
];

export const RARE_FINDS = [
  'um relógio de ouro (parado às 4:20)', 'um anel de noivado com uma nota de desculpas', 'uma figurinha rara da Copa de 70',
  'uma moeda de 1 real de 1998', 'um cartucho de videogame autografado', 'um disco de vinil em perfeito estado', 'uma dentadura de prata',
  'uma caneta-tinteiro banhada a ouro', 'um trofeu de "Melhor Vizinho 1991"', 'um walkman funcionando',
];

export const ENDING = [
  'Você fez. O último pedaço de lixo foi removido.',
  '1.000.000 de unidades. Uma de cada vez, depois dezenas, depois milhares.',
  'Onde antes havia um oceano de entulho, agora há chão, ruínas, estradas e máquinas silenciosas.',
  'O Sr. Valdemar mandou uma última mensagem: "Eu disse que era impossível. Você não ouviu. Obrigado por não ouvir."',
  'Alguém sugeriu construir um estacionamento.',
];
