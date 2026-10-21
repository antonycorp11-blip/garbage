export const MAT_COUNT = 6;
export const M_PLASTIC = 0, M_METAL = 1, M_PAPER = 2, M_GLASS = 3, M_ELEC = 4, M_RARE = 5;

export interface MaterialDef { id: string; name: string; value: number; color: string; dark: string }

export const MATERIALS: MaterialDef[] = [
  { id: 'plastic', name: 'Cristal', value: 1, color: '#f472b6', dark: '#9d174d' },
  { id: 'metal', name: 'Liga Estelar', value: 3, color: '#93c5fd', dark: '#1e40af' },
  { id: 'paper', name: 'Biogel', value: 0.8, color: '#86efac', dark: '#15803d' },
  { id: 'glass', name: 'Âmbar', value: 1.6, color: '#fb923c', dark: '#9a3412' },
  { id: 'electronics', name: 'Plasma', value: 6, color: '#22d3ee', dark: '#0e7490' },
  { id: 'rare', name: 'Relíquias', value: 45, color: '#c084fc', dark: '#6b21a8' },
];

export const emptyMats = (): number[] => [0, 0, 0, 0, 0, 0];
export const sumMats = (m: number[]) => m[0] + m[1] + m[2] + m[3] + m[4] + m[5];
