export const MAT_COUNT = 6;
export const M_PLASTIC = 0, M_METAL = 1, M_PAPER = 2, M_GLASS = 3, M_ELEC = 4, M_RARE = 5;

export interface MaterialDef { id: string; name: string; value: number; color: string; dark: string }

export const MATERIALS: MaterialDef[] = [
  { id: 'plastic', name: 'Plástico', value: 1, color: '#4fc3f7', dark: '#0277bd' },
  { id: 'metal', name: 'Metal', value: 3, color: '#cfd8dc', dark: '#607d8b' },
  { id: 'paper', name: 'Papel', value: 0.8, color: '#e0c08f', dark: '#8d6e45' },
  { id: 'glass', name: 'Vidro', value: 1.6, color: '#86efac', dark: '#2e7d4f' },
  { id: 'electronics', name: 'Eletrônicos', value: 6, color: '#ffd54f', dark: '#b28704' },
  { id: 'rare', name: 'Raridades', value: 45, color: '#e879f9', dark: '#86198f' },
];

export const emptyMats = (): number[] => [0, 0, 0, 0, 0, 0];
export const sumMats = (m: number[]) => m[0] + m[1] + m[2] + m[3] + m[4] + m[5];
