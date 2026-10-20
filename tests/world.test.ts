import { describe, expect, it } from 'vitest';
import { World } from '../src/world/World';
import { TOTAL_GARBAGE, tileIndex, CENTER } from '../src/core/constants';

describe('World', () => {
  it('generates exactly one million units', () => {
    const w = new World();
    let s = 0;
    for (const v of w.garbage) s += v;
    expect(s).toBe(TOTAL_GARBAGE);
    expect(w.remaining).toBe(TOTAL_GARBAGE);
    expect(w.at(CENTER, CENTER)).toBe(0);
  });

  it('never removes more than present and never goes negative', () => {
    const w = new World();
    let tile = -1;
    for (let i = 0; i < w.garbage.length; i++) if (w.garbage[i] > 5) { tile = i; break; }
    const before = w.garbage[tile];
    const r1 = w.remove(tile, 1000, 'player');
    expect(r1).toBe(before);
    expect(w.remove(tile, 5, 'player')).toBe(0);
    expect(w.garbage[tile]).toBe(0);
    expect(w.remaining).toBe(TOTAL_GARBAGE - before);
  });

  it('round-trips garbage through serialization', () => {
    const w = new World();
    w.remove(tileIndex(CENTER + 8, CENTER), 3, 'player');
    const s = w.serializeGarbage();
    const w2 = new World();
    expect(w2.loadGarbage(s)).toBe(true);
    expect(w2.remaining).toBe(w.remaining);
    expect(w2.loadGarbage('AAAA')).toBe(false);
  });
});
