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
  { id: 'hands', name: 'Pinça de Fábrica', desc: 'Veio de brinde com o chassi. Pega um pedacinho por vez e não ergue sucata pesada.', cost: 0, mode: 'single', reach: 1.35, units: 1, actionTime: 0.4, rate: 0, radius: 0, color: '#e0b48a' },
  { id: 'shovel', name: 'Pá Telescópica', desc: 'Estica, recolhe, estica de novo. Três pedaços por vez. Ainda não ergue sucata pesada.', cost: 60, mode: 'single', reach: 1.6, units: 3, actionTime: 0.45, rate: 0, radius: 0, color: '#9aa5ad' },
  { id: 'claw', name: 'Garra Hidráulica', desc: 'Alcança 3 metros e finalmente ergue sucata pesada: cascos de nave, motores, satélites inteiros.', cost: 450, mode: 'single', reach: 3.3, units: 6, actionTime: 0.42, rate: 0, radius: 0, color: '#f2a93b' },
  { id: 'vacuum', name: 'Aspirador Iônico', desc: 'Suga tudo num raio pequeno enquanto você anda segurando COLETAR. Faz um barulhinho fofo.', cost: 4000, mode: 'area', reach: 1.25, units: 0, actionTime: 0, rate: 12, radius: 1.7, color: '#e53935' },
  { id: 'magnet', name: 'Campo Magnético', desc: 'Um anel magnético que arrasta sucata de longe. Os Glubs acham que é mágica.', cost: 40000, mode: 'area', reach: 1.1, units: 0, actionTime: 0, rate: 22, radius: 2.7, color: '#5c6bc0' },
  { id: 'shredder', name: 'Vórtice Triturador', desc: 'Lâminas em espiral que transformam pilhas inteiras em confete reciclável.', cost: 250000, mode: 'area', reach: 1.5, units: 0, actionTime: 0, rate: 40, radius: 2.3, color: '#43a047' },
  { id: 'advanced', name: 'Raio Trator', desc: 'Tecnologia proibida em três galáxias. Puxa tudo num raio enorme. MÃE não precisa saber.', cost: 1500000, mode: 'area', reach: 0, units: 0, actionTime: 0, rate: 90, radius: 4.4, color: '#00e5ff' },
];
