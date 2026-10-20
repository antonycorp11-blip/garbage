import { TILE } from '../core/constants';
import { emptyMats } from '../data/materials';

export type Facing = 'down' | 'up' | 'left' | 'right';

export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  fx = 0;
  fy = 1;
  facing: Facing = 'down';
  walk = 0;
  moving = false;
  speedNow = 0;
  /** tool action animation 0..1 (1 = just triggered) */
  action = 0;
  actionDir = 0;
  collecting = false;
  backpack = emptyMats();
  carried = 0;
  fullWarnT = 0;
  readonly radius = 0.28;

  constructor(tx: number, ty: number) {
    this.x = tx * TILE;
    this.y = ty * TILE;
  }

  get tx() { return this.x / TILE; }
  get ty() { return this.y / TILE; }

  setFacing(dx: number, dy: number) {
    const l = Math.hypot(dx, dy);
    if (l < 1e-4) return;
    this.fx = dx / l; this.fy = dy / l;
    if (Math.abs(dx) > Math.abs(dy) * 1.1) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }
}
