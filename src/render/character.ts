import { TILE } from '../core/constants';
import { Game } from '../game/Game';
import { ellipse, groundShadow, lin, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const SKIN = '#e0a878';
const VEST = '#ff7a1a';
const PANTS = '#3b4a6b';
const BOOT = '#3a2a1e';
const CAP = '#2f6f4f';

/** Draws the scavenger at its feet position. Fully procedural, animated. */
export function drawPlayer(c: C, g: Game, time: number) {
  const p = g.player;
  const x = p.x, y = p.y;
  const tier = g.toolTier;
  const bagLvl = g.upgrades.c_bag || 0;
  const fill = g.d.capacity ? p.carried / g.d.capacity : 0;
  const walk = p.moving ? p.walk : 0;
  const swing = Math.sin(walk);
  const bob = p.moving ? Math.abs(Math.cos(walk)) * 1.6 : Math.sin(time * 2.2) * 0.4;
  const act = p.action;
  const dir = p.facing;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;

  groundShadow(c, x, y + 1, 10, 4.2, 0.45);
  // area tools draw an aura under the player
  if (tier >= 6) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y - 8, 0, 22, [[0, 'rgba(0,229,255,0.25)'], [1, 'rgba(0,229,255,0)']]);
    c.beginPath(); c.arc(x, y - 8, 22, 0, 6.28); c.fill();
    c.restore();
  }

  c.save();
  c.translate(x, y - bob);
  if (side) c.scale(flip, 1);

  const bagS = 1 + Math.min(1.1, bagLvl * 0.08) + fill * 0.15;
  const drawBag = () => {
    const bw = 9 * bagS, bh = 10 * bagS;
    const bx = side ? -6 - bw * 0.55 : -bw / 2, by = -22 - bh * 0.25;
    c.save();
    rrect(c, bx, by, bw, bh, 3);
    const col = bagLvl >= 8 ? '#5d4037' : bagLvl >= 4 ? '#6d5a2e' : '#7b6a4a';
    c.fillStyle = lin(c, bx, by, bx + bw, by + bh, [[0, shade(col, 0.3)], [1, shade(col, -0.35)]]);
    c.fill();
    c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.8; c.stroke();
    c.fillStyle = shade(col, -0.2); rrect(c, bx + 1, by + bh * 0.55, bw - 2, bh * 0.35, 2); c.fill();
    // contents peeking out when full
    if (fill > 0.3) {
      const n = Math.floor(fill * 5);
      const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f'];
      for (let i = 0; i < n; i++) { c.fillStyle = cols[i]; ellipse(c, bx + 2 + i * (bw - 4) / 5, by + 0.5, 1.8, 2.2, 0.3 * i); c.fill(); }
    }
    if (tier === 3) { // vacuum tank
      rrect(c, bx + bw * 0.15, by - 7, bw * 0.7, 9, 2.5);
      c.fillStyle = lin(c, bx, 0, bx + bw, 0, [[0, '#ff6b6b'], [1, '#a61b1b']]); c.fill(); c.strokeStyle = '#5a0d0d'; c.stroke();
    }
    c.restore();
  };

  if (dir === 'down' || side) drawBagBehind();
  function drawBagBehind() { if (dir !== 'up') drawBag(); }

  // legs
  const legY = -7;
  const legSwing = swing * 3.2;
  const leg = (lx: number, off: number) => {
    c.fillStyle = PANTS;
    rrect(c, lx - 2, legY - 1 + (side ? 0 : Math.max(0, -off) * 0.3), 4, 7.5, 1.5); c.fill();
    c.fillStyle = BOOT;
    rrect(c, lx - 2.4 + (side ? off * 0.6 : 0), legY + 5 - (side ? 0 : Math.max(0, off) * 0.4), 4.8 + (side ? 1.5 : 0), 3.2, 1.2); c.fill();
  };
  if (side) { leg(-1.5, -legSwing); leg(1.5, legSwing); }
  else { leg(-2.8, legSwing); leg(2.8, -legSwing); }

  // torso
  const ty = -18;
  rrect(c, -6.2, ty, 12.4, 12, 3.5);
  c.fillStyle = lin(c, -6, ty, 6, ty + 12, [[0, shade(VEST, 0.25)], [1, shade(VEST, -0.25)]]);
  c.fill();
  c.strokeStyle = shade(VEST, -0.55); c.lineWidth = 0.7; c.stroke();
  c.fillStyle = '#f4f4c8'; c.fillRect(-6, ty + 6.5, 12.4, 1.6);
  if (dir === 'down') { c.fillStyle = '#5f6b70'; c.fillRect(-1, ty + 1, 2, 5); }
  if (dir === 'down' || side) { c.strokeStyle = '#5b4632'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, ty + 1); c.lineTo(-3, ty + 9); c.moveTo(4, ty + 1); c.lineTo(3, ty + 9); if (!side) c.stroke(); }
  if (dir === 'up') drawBag();

  // arms + tool
  const armBase = ty + 3;
  const reachK = act > 0 ? Math.sin(act * Math.PI) : 0;
  const armL = () => {
    c.fillStyle = shade(VEST, -0.1);
    const ax = side ? -1 : -7.2;
    rrect(c, ax - 1.6, armBase, 3.2, 7 - (side ? 0 : swing * 1.2), 1.5); c.fill();
    c.fillStyle = '#d6c27a'; c.beginPath(); c.arc(ax, armBase + 7.5 - (side ? 0 : swing * 1.2), 1.9, 0, 6.28); c.fill();
  };
  const armR = () => {
    // the working arm
    const ang = side ? -0.2 + reachK * 1.4 + swing * 0.25 : 0;
    const ax = side ? 1 : 7.2;
    c.save();
    c.translate(ax, armBase + 1);
    c.rotate(side ? -ang + 1.1 : 0);
    if (!side) c.translate(0, -reachK * 2);
    c.fillStyle = shade(VEST, -0.1);
    rrect(c, -1.6, -1, 3.2, 8 + reachK * 3, 1.5); c.fill();
    c.fillStyle = '#d6c27a'; c.beginPath(); c.arc(0, 7.5 + reachK * 3, 1.9, 0, 6.28); c.fill();
    c.translate(0, 7.5 + reachK * 3);
    drawTool(c, tier, act, time, side);
    c.restore();
  };
  if (side) { armR(); } else if (dir === 'down') { armL(); armR(); } else { armR(); armL(); }

  // head
  const hy = ty - 6.5;
  c.beginPath(); c.arc(0, hy, 5.6, 0, 6.28);
  c.fillStyle = rad(c, -1.5, hy - 1.5, 0, 6.5, [[0, shade(SKIN, 0.2)], [1, shade(SKIN, -0.2)]]); c.fill();
  c.strokeStyle = shade(SKIN, -0.5); c.lineWidth = 0.6; c.stroke();
  if (dir === 'down') {
    c.fillStyle = '#2b1d14';
    c.beginPath(); c.arc(-2, hy + 0.8, 0.85, 0, 6.28); c.arc(2, hy + 0.8, 0.85, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(200,90,70,0.35)'; c.beginPath(); c.arc(-3.3, hy + 2.6, 1, 0, 6.28); c.arc(3.3, hy + 2.6, 1, 0, 6.28); c.fill();
    c.strokeStyle = '#6b3b2a'; c.lineWidth = 0.6; c.beginPath(); c.arc(0, hy + 2.5, 1.4, 0.3, 2.8); c.stroke();
    // bandana
    c.fillStyle = '#d84343'; c.beginPath(); c.moveTo(-5, hy + 3.2); c.quadraticCurveTo(0, hy + 7, 5, hy + 3.2); c.lineTo(0, hy + 5.4); c.closePath(); c.fill();
  } else if (side) {
    c.fillStyle = '#2b1d14'; c.beginPath(); c.arc(3, hy + 0.6, 0.85, 0, 6.28); c.fill();
    c.fillStyle = shade(SKIN, -0.1); c.beginPath(); c.arc(5.3, hy + 1.5, 1.2, 0, 6.28); c.fill();
  }
  // cap
  c.fillStyle = lin(c, 0, hy - 6, 0, hy, [[0, shade(CAP, 0.25)], [1, shade(CAP, -0.3)]]);
  c.beginPath(); c.arc(0, hy - 1.2, 5.8, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = shade(CAP, -0.35);
  if (dir === 'down') { ellipse(c, 0, hy - 1, 6.5, 2); c.fill(); }
  else if (side) { ellipse(c, 5, hy - 1.3, 4, 1.4); c.fill(); }
  else { c.fillRect(-5.5, hy - 1.6, 11, 1.4); }
  if (g.flags.crown) {
    c.fillStyle = lin(c, 0, hy - 13, 0, hy - 6, [[0, '#fff3a0'], [1, '#d4a017']]);
    c.beginPath(); c.moveTo(-5, hy - 6); c.lineTo(-5, hy - 11); c.lineTo(-2.5, hy - 8.5); c.lineTo(0, hy - 13); c.lineTo(2.5, hy - 8.5); c.lineTo(5, hy - 11); c.lineTo(5, hy - 6); c.closePath(); c.fill();
    c.strokeStyle = '#8a6508'; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = '#e53935'; c.beginPath(); c.arc(0, hy - 8, 1, 0, 6.28); c.fill();
  }
  c.restore();
}

export function drawTool(c: C, tier: number, act: number, time: number, side: boolean) {
  const k = act > 0 ? Math.sin(act * Math.PI) : 0;
  c.save();
  if (!side) c.rotate(-0.3);
  switch (tier) {
    case 0: break;
    case 1: { // shovel
      c.rotate(-0.9 + k * 1.2);
      c.fillStyle = '#8a5a2b'; c.fillRect(-0.8, -9, 1.6, 15);
      c.fillStyle = lin(c, -3, 6, 3, 11, [[0, '#d0d6da'], [1, '#6b757b']]);
      c.beginPath(); c.moveTo(-3, 5); c.lineTo(3, 5); c.lineTo(2.4, 11); c.quadraticCurveTo(0, 12.5, -2.4, 11); c.closePath(); c.fill();
      c.strokeStyle = '#3c4346'; c.lineWidth = 0.5; c.stroke();
      break;
    }
    case 2: { // claw grabber
      c.rotate(-1.2 + k * 0.6);
      const len = 14 + k * 10;
      c.fillStyle = '#f2a93b'; c.fillRect(-0.9, 0, 1.8, len);
      c.fillStyle = '#333'; c.fillRect(-1.5, -1, 3, 3);
      c.strokeStyle = '#555'; c.lineWidth = 1.2;
      const open = 1.5 + (1 - k) * 2;
      c.beginPath(); c.moveTo(0, len); c.lineTo(-open, len + 3); c.lineTo(-0.6, len + 5);
      c.moveTo(0, len); c.lineTo(open, len + 3); c.lineTo(0.6, len + 5); c.stroke();
      break;
    }
    case 3: { // vacuum nozzle
      c.rotate(-1);
      c.strokeStyle = '#444'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-4, -8, -6, -14); c.stroke();
      c.fillStyle = lin(c, -3, 0, 3, 0, [[0, '#ef5350'], [1, '#8e1b1b']]); c.fillRect(-1.4, 0, 2.8, 9);
      c.fillStyle = '#222'; rrect(c, -3, 8, 6, 3, 1); c.fill();
      break;
    }
    case 4: { // magnet
      c.rotate(-1.4 + Math.sin(time * 8) * 0.05);
      c.lineWidth = 3; c.strokeStyle = '#d32f2f';
      c.beginPath(); c.arc(0, 8, 4, 0, Math.PI); c.stroke();
      c.fillStyle = '#e0e0e0'; c.fillRect(-5.5, 5, 3, 3); c.fillRect(2.5, 5, 3, 3);
      c.fillStyle = '#5c6bc0'; c.fillRect(-0.8, -2, 1.6, 7);
      break;
    }
    case 5: { // shredder
      c.rotate(-1.3);
      rrect(c, -4, 2, 8, 9, 2); c.fillStyle = lin(c, -4, 0, 4, 0, [[0, '#66bb6a'], [1, '#1b5e20']]); c.fill(); c.strokeStyle = '#0d3311'; c.lineWidth = 0.6; c.stroke();
      c.save(); c.translate(0, 12); c.rotate(time * 30);
      c.fillStyle = '#cfd8dc'; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillRect(-0.7, 0, 1.4, 4.5); }
      c.restore();
      break;
    }
    case 6: { // advanced: glowing gauntlet
      c.rotate(-1.2);
      c.fillStyle = '#263238'; rrect(c, -3, -1, 6, 8, 2); c.fill();
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = rad(c, 0, 10, 0, 8, [[0, 'rgba(0,229,255,0.9)'], [1, 'rgba(0,229,255,0)']]);
      c.beginPath(); c.arc(0, 10, 8, 0, 6.28); c.fill();
      c.restore();
      c.strokeStyle = '#00e5ff'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, 10, 3 + Math.sin(time * 10), 0, 6.28); c.stroke();
      break;
    }
  }
  c.restore();
}

/** Visuals for area tools at the collection center. */
export function drawAreaTool(c: C, g: Game, time: number, collecting: boolean) {
  const ac = g.areaCenter;
  if (!ac) return;
  const tool = g.tool;
  const r = tool.radius * g.d.reachMult * TILE;
  const x = ac.x * TILE, y = ac.y * TILE;
  c.save();
  c.globalAlpha = collecting ? 0.9 : 0.35;
  c.strokeStyle = tool.color;
  c.lineWidth = 1.5;
  c.setLineDash([6, 5]);
  c.lineDashOffset = -time * 30;
  c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, 6.28); c.stroke();
  c.setLineDash([]);
  if (collecting) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y, 0, r, [[0, shade(tool.color, 0, 0.28)], [1, shade(tool.color, 0, 0)]]);
    c.beginPath(); c.ellipse(x, y, r, r * 0.85, 0, 0, 6.28); c.fill();
    // swirl
    c.strokeStyle = shade(tool.color, 0.4, 0.6);
    c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a0 = time * (tool.id === 'advanced' ? 6 : 4) + i * 2.09;
      c.beginPath(); c.ellipse(x, y, r * (0.4 + i * 0.2), r * 0.85 * (0.4 + i * 0.2), 0, a0, a0 + 1.4); c.stroke();
    }
  }
  c.restore();
}

/** Bracket around the target tile of single-target tools. */
export function drawAimTile(c: C, tile: number, worldTiles: number, time: number, color: string) {
  if (tile < 0) return;
  const tx = tile % worldTiles, ty = Math.floor(tile / worldTiles);
  const x = tx * TILE, y = ty * TILE;
  const p = 2 + Math.sin(time * 6) * 1.5;
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 3;
  const L = 8;
  const corners: [number, number, number, number][] = [[x - p, y - p, 1, 1], [x + TILE + p, y - p, -1, 1], [x - p, y + TILE + p, 1, -1], [x + TILE + p, y + TILE + p, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) { c.beginPath(); c.moveTo(cx + L * sx, cy); c.lineTo(cx, cy); c.lineTo(cx, cy + L * sy); c.stroke(); }
  c.restore();
}
