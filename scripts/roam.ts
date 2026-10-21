import { Game } from '../src/game/Game';
import { CENTER, tileIndex } from '../src/core/constants';
const g = new Game();
g.money = 1e7; g.storage = [1e5, 1e5, 1e5, 1e5, 1e5, 0];
g.contracts.started = true;
g.upgrades = { a_belts: 1, a_arm: 1 }; g.recompute();
const idle = { moveX: 0, moveY: 0, collect: false, interact: false, aim: null };
const spots = [[CENTER + 3, CENTER + 4], [CENTER - 5, CENTER - 3], [CENTER + 20, CENTER], [CENTER, CENTER + 25]];
for (const [x, y] of spots) { for (let yy = y; yy <= y; yy++) g.world.remove(tileIndex(x, yy), 255, 'player'); console.log('build', x, y, g.build('collector', x, y)); }
const cs = g.machines.machines.filter((m) => m.type === 'collector');
let t = 0;
for (let i = 0; i < 2400; i++) {
  g.update(0.5, idle); t += 0.5;
  if (i % 120 === 0) console.log(`t=${t}s`, cs.map((m) => `${m.id}@${m.tx - CENTER},${m.ty - CENTER} ${m.status} buf${m.bufferTotal} svc${m.inService ? 1 : 0} idle${m.idleT.toFixed(0)} col${m.collected}`).join(' | '), 'yard', Math.round(g.yardTotal));
}
