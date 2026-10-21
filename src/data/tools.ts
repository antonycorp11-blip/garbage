export interface ToolDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  mode: 'single' | 'area';
  /** single: max distance (tiles) to the target tile; area: distance of the area center ahead of the player */
  reach: number;
  units: number;
  actionTime: number;
  rate: number;
  radius: number;
  color: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'hands', name: 'Pinças de Fábrica', desc: 'Pinças de fábrica, meio tortas, e muita força de vontade. Um objeto por vez. Não ergue entulho pesado.', cost: 0, mode: 'single', reach: 1.35, units: 1, actionTime: 0.4, rate: 0, radius: 0, color: '#e0b48a' },
  { id: 'shovel', name: 'Pá Improvisada', desc: 'Um cabo de vassoura e uma placa de "PROIBIDO JOGAR LIXO". Ironia inclusa. Ainda não ergue entulho pesado.', cost: 60, mode: 'single', reach: 1.6, units: 3, actionTime: 0.45, rate: 0, radius: 0, color: '#9aa5ad' },
  { id: 'claw', name: 'Garra Mecânica', desc: 'Pega lixo a até 3 metros e finalmente ergue entulho pesado (geladeiras, motores). Também pega o controle remoto do sofá.', cost: 450, mode: 'single', reach: 3.3, units: 6, actionTime: 0.42, rate: 0, radius: 0, color: '#f2a93b' },
  { id: 'vacuum', name: 'Aspirador Industrial', desc: 'Suga tudo num raio pequeno. Inclusive sua dignidade, se chegar muito perto.', cost: 4000, mode: 'area', reach: 1.25, units: 0, actionTime: 0, rate: 12, radius: 1.7, color: '#e53935' },
  { id: 'magnet', name: 'Coletor Magnético', desc: 'Campo magnético que puxa metal e eletrônicos com o dobro de vontade.', cost: 40000, mode: 'area', reach: 1.1, units: 0, actionTime: 0, rate: 22, radius: 2.7, color: '#5c6bc0' },
  { id: 'shredder', name: 'Triturador Portátil', desc: 'Lâminas giratórias que transformam pilhas inteiras em confete reciclável.', cost: 250000, mode: 'area', reach: 1.5, units: 0, actionTime: 0, rate: 40, radius: 2.3, color: '#43a047' },
  { id: 'advanced', name: 'Sistema de Coleta Avançado', desc: 'Um vórtice portátil. Os vizinhos reclamaram. Os vizinhos foram reciclados (mentira).', cost: 1500000, mode: 'area', reach: 0, units: 0, actionTime: 0, rate: 90, radius: 4.4, color: '#00e5ff' },
];
