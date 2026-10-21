export interface Milestone { pct: number; text: string }

export const SENDER = 'Sr. Valdemar, zelador do posto';
export const MAE = 'MÃE · Fábrica Orbital';
export const GLUB = 'Glub';

export const INTRO = [
  'Bip-bop, acordou! Eu sou o Valdemar. Montei você com peças do ferro-velho. Bem-vindo a Nébula-7, o lixão da galáxia.',
  'Há 300 anos a Federação despeja sucata aqui: 1.000.000 de unidades. Ande com o joystick (ou WASD) e segure COLETAR perto da sucata.',
  'Quando o tanque encher, volte ao posto no centro. O que você trouxer vira material nos silos. A fábrica lá em cima paga bem por ele.',
];

export const MILESTONES: Milestone[] = [
  { pct: 0.0001, text: 'Você limpou 0,01% do planeta. A galáxia nem percebeu. Eu percebi.' },
  { pct: 0.001, text: '0,1%! Um brotinho azul apareceu onde você limpou. Ele brilha de noite. Que exibido.' },
  { pct: 0.005, text: 'Meio por cento. Ouvi um "glub" vindo do chão. Deve ser o óleo do meu joelho.' },
  { pct: 0.01, text: '1% limpo. A Federação mandou um ofício pedindo para você "parar de mexer no lixo deles".' },
  { pct: 0.025, text: '2,5%! Os cristais da clareira voltaram a cantar. Sim, aqui os cristais cantam. Desafinado.' },
  { pct: 0.05, text: '5%! Vi três Glubs dançando no chão limpo. Eles fogem quando eu olho. Timidez de gelatina.' },
  { pct: 0.1, text: '10%! As medusas do céu desceram para ver. Elas só descem quando o ar fica limpo.' },
  { pct: 0.2, text: '20%! Um cruzeiro espacial desviou a rota para fotografar a gente. Cobre ingresso da próxima vez.' },
  { pct: 0.3, text: '30%! Os Glubs começaram a construir casinhas. Com a sucata que você não pegou. Ironia.' },
  { pct: 0.5, text: 'METADE! 500 mil unidades. Os Glubs fizeram uma estátua sua. Ficou parecida com uma batata.' },
  { pct: 0.65, text: '65%. A previsão do tempo da galáxia agora diz "Nébula-7: possibilidade de chão".' },
  { pct: 0.8, text: '80%! O planeta está respirando de novo. Eu sei porque meu sensor de poeira parou de chorar.' },
  { pct: 0.9, text: '90%! Restam 100 mil. Os Glubs estão ensaiando uma festa. Fui convidado para não dançar.' },
  { pct: 0.97, text: '97%. Os últimos pedaços se escondem. O Radar e o mapa ajudam a achar.' },
  { pct: 0.99, text: '99%! Dez mil unidades. Dá pra ouvir o planeta cantarolando.' },
  { pct: 0.999, text: '99,9%. Mil unidades. Os Glubs já estão de chapéu de festa.' },
  { pct: 0.9999, text: 'Cem unidades. Siga a seta. Seja a seta.' },
];

export const RANDOM_MESSAGES = [
  'Dica: cada região tem sucata diferente. Precisa de Liga Estelar? Ferro-Velho de Naves. Cristal? Campo de Cápsulas.',
  'Dica: máquinas dentro do círculo do posto entregam sozinhas. As distantes precisam de esteiras.',
  'A MÃE mandou um memorando sobre "eficiência emocional". Eu usei para calçar a cadeira.',
  'Dica: na Oficina você troca as peças do BIP. Esteiras ignoram a sucata, hover voa baixo e rápido.',
  'Dica: toque numa máquina para ver o status, melhorar, mover ou esvaziar.',
  'Um Glub tentou adotar seu coletor. O coletor não reclamou. Ele nunca reclama.',
  'Dica: contratos pagam bem mais que vender no mercado. E às vezes dão plantas de módulos novos.',
  'Pesquisas indicam que 9 em cada 10 pilhas de sucata são, de fato, sucata.',
  'Dica: o pinça de zoom (dois dedos) ajuda a planejar onde construir.',
  'Encontrei uma meia de astronauta. Só uma. A outra está em órbita desde o ano 2300.',
  'Dica: separadores na esteira aumentam o valor do material e não lotam o pátio do posto.',
  'Aviso da Federação: "Lixo depositado não pode ser retirado". Assinado: ninguém. Ignore.',
];

export const TV_ADS = [
  '📻 Rádio: "Nave usada! Só 3 donos, todos sobreviveram! Aceitamos sucata como entrada!"',
  '📻 Rádio: "Cansado do seu planeta? Despeje-o em Nébula-7! Ops, essa propaganda é antiga."',
  '📻 Rádio: "Óleo Lubrificante Vovó Robô: para juntas que já viram de tudo."',
  '📻 Rádio: "Promoção de buracos negros! Pague um, perca dois!"',
  '📻 Rádio: "Atenção: esta estação não existe. Obrigado pela audiência."',
];

export const RARE_FINDS = [
  'um relógio de bolso de um capitão espacial (parado às 4:20)', 'um ovo de cristal que pisca quando você olha',
  'um disco de música com a voz de uma baleia estelar', 'uma coroa de um rei que ninguém lembra', 'um mapa estelar desenhado à mão',
  'um cartucho de videogame de três galáxias atrás', 'um troféu de "Melhor Despejo 2799"', 'uma bússola que aponta para casa',
  'uma pena de um pássaro que não existe mais', 'um walkman que toca rádio de outra dimensão',
];

export const ENDING = [
  'Você conseguiu. O último pedaço de sucata saiu de Nébula-7.',
  '1.000.000 de unidades: uma de cada vez, depois dezenas, depois milhares.',
  'Onde havia montanhas de lixo agora há campos que brilham, cristais que cantam e milhares de Glubs fazendo festa.',
  'A MÃE mandou uma mensagem curta: "Contrato de despejo cancelado. Fiz os cálculos. Vocês ganharam."',
  'O Valdemar mandou outra: "Eu sujei esse planeta por 300 anos. Você limpou. Obrigado, BIP."',
  'Um Glub sugeriu construir um estacionamento. Foi vaiado.',
];

/** Story beats, unlocked by the number of contracts delivered. */
export const STORY: { at: number; from: 'mae' | 'val' | 'glub'; text: string }[] = [
  { at: 0, from: 'mae', text: 'Aqui é MÃE, Inteligência da Fábrica Orbital. Detectei um robô ativo em Nébula-7. Ótimo: você agora trabalha para nós.' },
  { at: 0, from: 'mae', text: 'Primeiro contrato: 25 de Liga Estelar em 3 dias. O ônibus de carga busca no posto. Pagamento justo. Mais ou menos.' },
  { at: 0, from: 'val', text: 'Não ligue pro tom dela. Ela fala assim com todo mundo. Até com a torradeira. Liga Estelar sai das sucatas azuladas.' },
  { at: 1, from: 'mae', text: 'Contrato cumprido. Surpreendente. A partir de agora há novas propostas todo dia no painel de Contratos.' },
  { at: 1, from: 'val', text: 'Escolha contratos que dá pra cumprir. Atrasar tira reputação, e reputação é o que libera os contratos grandes.' },
  { at: 2, from: 'val', text: 'Vi uma planta de módulo entre as ofertas. Patas de Aranha! Eu tinha seis pernas na juventude. Hoje tenho uma cadeira.' },
  { at: 3, from: 'glub', text: 'Glub? Glub glub! (Um Glub saiu do chão limpo, olhou para você e fez um coração com a gelatina.)' },
  { at: 3, from: 'val', text: 'Aquilo era um Glub. Os nativos daqui. Eles se esconderam embaixo da terra quando a sucata chegou. Estão voltando.' },
  { at: 5, from: 'mae', text: 'Nível de confiança atualizado. Você pode manter 2 contratos ao mesmo tempo. Não me decepcione. De novo.' },
  { at: 7, from: 'val', text: 'Sabe por que despejavam aqui? "Ninguém mora lá", disseram. Os Glubs moravam. Ninguém perguntou.' },
  { at: 10, from: 'mae', text: 'Seus índices de limpeza estão... acima do previsto. A Federação está curiosa. Continue entregando. E sorria. Você tem tela pra isso.' },
  { at: 12, from: 'glub', text: 'Glub glub glub! (Os Glubs trouxeram um presente: uma pedrinha brilhante. É tudo o que eles têm. É lindo.)' },
  { at: 14, from: 'val', text: 'Preciso confessar: fui eu que assinei o primeiro despejo, há 300 anos. Eu era o robô gerente. Construí você pra consertar isso.' },
  { at: 18, from: 'mae', text: 'Atualização: a Federação quer comprar o planeta limpo para fazer um resort. Meus cálculos indicam que os Glubs não aprovam.' },
  { at: 22, from: 'mae', text: 'Revisei meus objetivos. Lucro... e outra coisa que ainda não sei nomear. Continue, BIP.' },
];

export const STORY_SENDER = { mae: MAE, val: SENDER, glub: GLUB } as const;

export const CONTRACT_LINES = {
  done: ['Entrega recebida. Pagamento enviado. Não se acostume.', 'Carga a bordo. Eficiência aceitável. Quase simpática.', 'Recebido. A Diretoria sorriu. Eu acho. Ela não tem rosto.'],
  failed: ['Prazo encerrado. Registrei a decepção em três cópias.', 'O ônibus voltou vazio. Reputação ajustada para baixo.', 'Contrato vencido. Considere isto um abraço corporativo frio.'],
  urgent: 'Lembrete: um contrato vence em menos de meio dia.',
};
