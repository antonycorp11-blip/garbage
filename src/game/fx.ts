export type SoundName =
  | 'pick' | 'pickMetal' | 'pickGlass' | 'pickPaper' | 'unload' | 'coin' | 'buy' | 'unlock' | 'discover' | 'build'
  | 'error' | 'full' | 'demolish' | 'click' | 'open' | 'drone' | 'rare' | 'milestone' | 'win';

/** Visual / audio side effects requested by the simulation. All coordinates are world pixels. */
export interface FX {
  removed(tile: number, before: number, after: number, toX: number, toY: number): void;
  fly(fromX: number, fromY: number, toX: number, toY: number, mat: number): void;
  text(x: number, y: number, str: string, color: string): void;
  burst(x: number, y: number, kind: 'dust' | 'spark' | 'build' | 'unlock' | 'coin' | 'magic', n: number): void;
  sound(name: SoundName, x?: number, y?: number): void;
  shake(amount: number): void;
  drone(fromX: number, fromY: number, toX: number, toY: number): void;
}

export const NULL_FX: FX = {
  removed() {}, fly() {}, text() {}, burst() {}, sound() {}, shake() {}, drone() {},
};
