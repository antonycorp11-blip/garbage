import { TILE } from '../core/constants';
import { Game } from '../game/Game';
import { ellipse, groundShadow, lin, rad, rrect, shade } from './paint';

type C = CanvasRenderingContext2D;

const SKIN = '#e3a77a';
const SKIN_D = '#b97a52';
const VEST = '#ff7a1a';
const SHIRT = '#3d6f8f';
const PANTS = '#34425e';
const BOOT = '#4a3324';
const GLOVE = '#d8b45a';
const CAP = '#2f6f4f';
const HAIR = '#4a2e1c';

/** Draws the scavenger at its feet position. Fully procedural, animated. */
export function drawPlayer(c: C, g: Game, time: number) {
  const p = g.player;
  drawWorker(c, p.x, p.y, time, {
    facing: p.facing, moving: p.moving, walk: p.walk, action: p.action, tier: g.toolTier,
    bagLvl: g.upgrades.c_bag || 0, fill: g.d.capacity ? p.carried / g.d.capacity : 0, crown: !!g.flags.crown,
  });
}

export interface WorkerPose { facing: string; moving: boolean; walk: number; action: number; tier: number; bagLvl: number; fill: number; crown: boolean }

export function drawWorker(c: C, x: number, y: number, time: number, o: WorkerPose) {
  const S = 1.12;
  const walk = o.moving ? o.walk : 0;
  const swing = Math.sin(walk);
  const bob = o.moving ? Math.abs(Math.cos(walk)) * 1.5 : Math.sin(time * 2.2) * 0.35;
  const breathe = o.moving ? 0 : Math.sin(time * 2.2) * 0.3;
  const dir = o.facing;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const act = o.action;
  const blink = (time % 3.7) < 0.12;

  groundShadow(c, x, y + 1, 10.5, 4.4, 0.45);
  if (o.tier >= 6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = rad(c, x, y - 8, 0, 24, [[0, 'rgba(0,229,255,0.25)'], [1, 'rgba(0,229,255,0)']]);
    c.beginPath(); c.arc(x, y - 8, 24, 0, 6.28); c.fill();
    c.restore();
  }
  c.save();
  c.translate(x, y - bob);
  c.scale(S * (side ? flip : 1), S);

  const bagS = 1 + Math.min(1.1, o.bagLvl * 0.075) + o.fill * 0.12;
  const drawBag = (front: boolean) => {
    const bw = 10 * bagS, bh = 11 * bagS;
    const bx = side ? -5.5 - bw * 0.7 : -bw / 2, by = front ? -19.5 - (bh - 11) * 0.5 : -23 - bh * 0.22;
    const col = o.bagLvl >= 9 ? '#4e5d3a' : o.bagLvl >= 4 ? '#6d5a2e' : '#7b6a4a';
    // bedroll on top at higher levels
    if (o.bagLvl >= 3) {
      rrect(c, bx - 1, by - 3.4, bw + 2, 4, 2);
      c.fillStyle = lin(c, 0, by - 3.4, 0, by + 0.6, [[0, '#9a4a3a'], [1, '#5e2a20']]); c.fill();
      c.strokeStyle = '#2b130e'; c.lineWidth = 0.5; c.stroke();
      c.fillStyle = '#2b1b10'; c.fillRect(bx + bw * 0.25, by - 3.4, 1, 4); c.fillRect(bx + bw * 0.72, by - 3.4, 1, 4);
    }
    rrect(c, bx, by, bw, bh, 3.2);
    c.fillStyle = lin(c, bx, by, bx + bw, by + bh, [[0, shade(col, 0.32)], [0.6, col], [1, shade(col, -0.4)]]); c.fill();
    c.strokeStyle = shade(col, -0.65); c.lineWidth = 0.7; c.stroke();
    // flap + buckle
    rrect(c, bx + 0.6, by + 0.4, bw - 1.2, bh * 0.38, 2.6);
    c.fillStyle = shade(col, 0.12); c.fill(); c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.5; c.stroke();
    c.fillStyle = '#c9b27a'; c.fillRect(bx + bw / 2 - 1, by + bh * 0.34, 2, 1.6);
    // side pocket
    rrect(c, bx + (side ? 0.6 : bw * 0.62), by + bh * 0.55, bw * 0.34, bh * 0.36, 1.5);
    c.fillStyle = shade(col, -0.18); c.fill(); c.strokeStyle = shade(col, -0.55); c.stroke();
    // stitches
    c.strokeStyle = 'rgba(255,240,200,0.25)'; c.lineWidth = 0.35; c.setLineDash([0.8, 0.8]);
    rrect(c, bx + 1.2, by + 1.2, bw - 2.4, bh - 2.4, 2.4); c.stroke(); c.setLineDash([]);
    // contents peeking out
    if (o.fill > 0.25) {
      const n = Math.min(6, Math.ceil(o.fill * 6));
      const cols = ['#4fc3f7', '#cfd8dc', '#e0c08f', '#86efac', '#ffd54f', '#e53935'];
      for (let i = 0; i < n; i++) {
        c.fillStyle = cols[i];
        c.save(); c.translate(bx + 1.6 + i * (bw - 3.2) / 6, by - 0.6 - (i % 2) * 1.2); c.rotate(-0.4 + i * 0.25);
        rrect(c, -1.1, -2.2, 2.2, 3.6, 0.6); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.3; c.stroke();
        c.restore();
      }
    }
    if (o.tier === 3) { // vacuum tank
      rrect(c, bx + bw * 0.12, by - 8, bw * 0.76, 10, 3);
      c.fillStyle = lin(c, bx, 0, bx + bw, 0, [[0, '#ff7b7b'], [0.5, '#e53935'], [1, '#8e1b1b']]); c.fill(); c.strokeStyle = '#4a0b0b'; c.lineWidth = 0.6; c.stroke();
      c.fillStyle = '#d0d6da'; c.fillRect(bx + bw * 0.3, by - 9, bw * 0.4, 1.6);
    }
  };

  if (dir !== 'up') drawBag(false);

  // ---- legs (two segments with knee bend)
  const legTop = -9.5;
  const leg = (lx: number, ph: number, back: boolean) => {
    const sw = Math.sin(ph);
    const lift = Math.max(0, Math.cos(ph)) * (o.moving ? 1.6 : 0);
    const footX = side ? lx + sw * 3.6 : lx;
    const footY = side ? -1 - lift : -1 - (o.moving ? Math.max(0, sw) * 1.6 : 0);
    const kneeX = side ? lx + sw * 1.6 + 0.8 : lx, kneeY = -5.2 - lift * 0.6;
    c.strokeStyle = back ? shade(PANTS, -0.25) : PANTS; c.lineWidth = 3.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(lx, legTop); c.lineTo(kneeX, kneeY); c.lineTo(footX, footY - 1); c.stroke();
    // knee patch
    c.fillStyle = shade(PANTS, 0.15); c.beginPath(); c.arc(kneeX, kneeY, 1.2, 0, 6.28); c.fill();
    // boot
    const bw = side ? 5.6 : 4.4;
    rrect(c, footX - (side ? 1.6 : bw / 2), footY - 2.6, bw, 3.2, 1.3);
    c.fillStyle = back ? shade(BOOT, -0.25) : BOOT; c.fill();
    c.fillStyle = '#1a120c'; c.fillRect(footX - (side ? 1.6 : bw / 2), footY + 0.1, bw, 0.8);
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(footX - (side ? 1 : bw / 2 - 0.6), footY - 2.2, bw * 0.5, 0.6);
  };
  if (side) { leg(-0.8, walk + Math.PI, true); leg(0.8, walk, false); }
  else { leg(-2.6, walk, false); leg(2.6, walk + Math.PI, false); }

  // ---- torso
  const ty = -19 + breathe;
  // shirt
  rrect(c, -6.4, ty, 12.8, 11, 3.6);
  c.fillStyle = lin(c, -6, ty, 6, ty + 11, [[0, shade(SHIRT, 0.2)], [1, shade(SHIRT, -0.3)]]); c.fill();
  // vest
  c.beginPath();
  if (dir === 'down') { c.moveTo(-6.4, ty + 2); c.lineTo(-2.2, ty + 1); c.lineTo(-1, ty + 10.6); c.lineTo(-6.4, ty + 10.6); c.closePath(); c.moveTo(6.4, ty + 2); c.lineTo(2.2, ty + 1); c.lineTo(1, ty + 10.6); c.lineTo(6.4, ty + 10.6); c.closePath(); }
  else { rrect(c, -6.4, ty + 0.6, 12.8, 10.4, 3.4); }
  c.fillStyle = lin(c, -6, ty, 6, ty + 11, [[0, shade(VEST, 0.25)], [1, shade(VEST, -0.25)]]); c.fill();
  c.strokeStyle = shade(VEST, -0.55); c.lineWidth = 0.6; c.stroke();
  // reflective stripes
  c.fillStyle = '#f4f4cf';
  if (dir === 'down') { c.fillRect(-6.2, ty + 5.4, 4.6, 1.3); c.fillRect(1.6, ty + 5.4, 4.6, 1.3); c.fillRect(-6.2, ty + 8, 5, 1.1); c.fillRect(1.2, ty + 8, 5, 1.1); }
  else if (dir === 'up') { c.fillRect(-6.2, ty + 5.4, 12.4, 1.3); c.fillRect(-6.2, ty + 8, 12.4, 1.1); c.beginPath(); c.moveTo(-5, ty + 1); c.lineTo(0, ty + 5.4); c.lineTo(5, ty + 1); c.lineWidth = 1.2; c.strokeStyle = '#f4f4cf'; c.stroke(); }
  else { c.fillRect(-6.2, ty + 5.4, 12.4, 1.3); c.fillRect(-6.2, ty + 8, 12.4, 1.1); }
  if (dir === 'down') {
    // pockets and radio
    c.fillStyle = shade(VEST, -0.2); rrect(c, -5.6, ty + 2.4, 2.8, 2.2, 0.6); c.fill();
    c.fillStyle = '#222'; rrect(c, 3, ty + 1.6, 2.2, 3.2, 0.5); c.fill(); c.fillRect(4.6, ty - 0.6, 0.5, 2.4);
    c.fillStyle = '#e53935'; c.fillRect(3.4, ty + 2.2, 0.6, 0.6);
  }
  // belt with buckle and tape measure
  c.fillStyle = '#3a2618'; c.fillRect(-6.4, ty + 10, 12.8, 1.8);
  if (dir !== 'up') { c.fillStyle = '#c9b27a'; c.fillRect(-1, ty + 10, 2, 1.8); }
  if (dir === 'down' || side) { c.fillStyle = '#ffcc00'; rrect(c, side ? 2.5 : -6.8, ty + 9.6, 3, 2.8, 0.8); c.fill(); }
  if (dir === 'up') drawBag(true);
  // straps (front)
  if (dir === 'down') { c.strokeStyle = '#5b4632'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-3.8, ty + 0.6); c.lineTo(-4.6, ty + 9); c.moveTo(3.8, ty + 0.6); c.lineTo(4.6, ty + 9); c.stroke(); }
  if (side) { c.strokeStyle = '#5b4632'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-3, ty + 0.4); c.quadraticCurveTo(2, ty + 3, 0.5, ty + 9); c.stroke(); }

  // ---- arms + tool
  const armBase = ty + 2.4;
  const reachK = act > 0 ? Math.sin(act * Math.PI) : 0;
  const glove = (gx: number, gy: number) => {
    c.fillStyle = rad(c, gx - 0.6, gy - 0.6, 0, 2.4, [[0, shade(GLOVE, 0.3)], [1, shade(GLOVE, -0.3)]]);
    c.beginPath(); c.arc(gx, gy, 2, 0, 6.28); c.fill();
    c.strokeStyle = shade(GLOVE, -0.55); c.lineWidth = 0.4; c.stroke();
    c.fillStyle = shade(GLOVE, -0.25); c.fillRect(gx - 2, gy - 2.4, 4, 1);
  };
  const armL = () => {
    const ax = side ? -1 : -7.2;
    const sw = side ? 0 : swing * 1.3;
    c.fillStyle = SHIRT; rrect(c, ax - 1.7, armBase, 3.4, 4, 1.6); c.fill();
    c.fillStyle = SKIN; rrect(c, ax - 1.4, armBase + 3.2, 2.8, 4 - sw, 1.3); c.fill();
    glove(ax, armBase + 7.6 - sw);
  };
  const armR = () => {
    const ang = side ? -0.2 + reachK * 1.4 + swing * 0.25 : 0;
    const ax = side ? 1 : 7.2;
    c.save();
    c.translate(ax, armBase + 0.6);
    c.rotate(side ? -ang + 1.1 : 0);
    if (!side) c.translate(0, -reachK * 2);
    c.fillStyle = SHIRT; rrect(c, -1.7, -1, 3.4, 4.6, 1.6); c.fill();
    c.fillStyle = SKIN; rrect(c, -1.4, 3, 2.8, 4.6 + reachK * 3, 1.3); c.fill();
    glove(0, 7.8 + reachK * 3);
    c.translate(0, 7.8 + reachK * 3);
    drawTool(c, o.tier, act, time, side);
    c.restore();
  };
  if (side) armR(); else if (dir === 'down') { armL(); armR(); } else { armR(); armL(); }

  // ---- head
  const hy = ty - 6.6 + breathe * 0.5;
  // neck + bandana
  c.fillStyle = SKIN_D; c.fillRect(-1.8, hy + 3.6, 3.6, 3);
  c.beginPath(); c.arc(0, hy, 5.8, 0, 6.28);
  c.fillStyle = rad(c, -1.8, hy - 1.8, 0, 7, [[0, shade(SKIN, 0.22)], [0.7, SKIN], [1, SKIN_D]]); c.fill();
  c.strokeStyle = shade(SKIN, -0.55); c.lineWidth = 0.55; c.stroke();
  // ears
  if (!side) { c.fillStyle = SKIN_D; c.beginPath(); c.arc(-5.6, hy + 0.8, 1.2, 0, 6.28); c.arc(5.6, hy + 0.8, 1.2, 0, 6.28); c.fill(); }
  else { c.fillStyle = SKIN_D; c.beginPath(); c.arc(-1, hy + 0.8, 1.3, 0, 6.28); c.fill(); }
  // hair
  c.fillStyle = HAIR;
  if (dir === 'up') { c.beginPath(); c.arc(0, hy, 5.7, 0, 6.28); c.fill(); c.fillStyle = shade(HAIR, 0.15); c.beginPath(); c.arc(-1.5, hy + 1, 2.5, 0, 6.28); c.fill(); }
  else if (side) { c.beginPath(); c.moveTo(-5.6, hy - 1); c.quadraticCurveTo(-6, hy + 3.5, -2.5, hy + 3); c.lineTo(-2, hy - 1); c.fill(); }
  else { c.beginPath(); c.moveTo(-5.4, hy - 1); c.lineTo(-5.2, hy + 2.4); c.lineTo(-4, hy); c.closePath(); c.moveTo(5.4, hy - 1); c.lineTo(5.2, hy + 2.4); c.lineTo(4, hy); c.closePath(); c.fill(); }
  if (dir === 'down') {
    // eyes, brows, nose, mouth, stubble
    if (blink) { c.strokeStyle = '#2b1d14'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-3, hy + 0.9); c.lineTo(-1, hy + 0.9); c.moveTo(1, hy + 0.9); c.lineTo(3, hy + 0.9); c.stroke(); }
    else {
      c.fillStyle = '#fff'; ellipse(c, -2, hy + 0.8, 1.2, 1.1); c.fill(); ellipse(c, 2, hy + 0.8, 1.2, 1.1); c.fill();
      c.fillStyle = '#2b1d14'; c.beginPath(); c.arc(-1.8, hy + 1, 0.7, 0, 6.28); c.arc(2.2, hy + 1, 0.7, 0, 6.28); c.fill();
      c.fillStyle = '#fff'; c.fillRect(-1.6, hy + 0.5, 0.35, 0.35); c.fillRect(2.4, hy + 0.5, 0.35, 0.35);
    }
    c.strokeStyle = HAIR; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-3.2, hy - 0.8); c.lineTo(-1, hy - 1.1); c.moveTo(1, hy - 1.1); c.lineTo(3.2, hy - 0.8); c.stroke();
    c.fillStyle = SKIN_D; c.beginPath(); c.arc(0, hy + 2.3, 0.8, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(70,45,30,0.18)'; c.beginPath(); c.arc(0, hy + 3.3, 3.4, 0.2, Math.PI - 0.2); c.fill();
    c.strokeStyle = '#6b3b2a'; c.lineWidth = 0.6; c.beginPath();
    if (o.fill >= 1) c.arc(0, hy + 4.5, 1.2, Math.PI + 0.4, -0.4); else c.arc(0, hy + 2.7, 1.5, 0.35, 2.8);
    c.stroke();
    c.fillStyle = 'rgba(210,90,70,0.3)'; c.beginPath(); c.arc(-3.6, hy + 2.6, 1, 0, 6.28); c.arc(3.6, hy + 2.6, 1, 0, 6.28); c.fill();
    // bandana
    c.fillStyle = '#d84343'; c.beginPath(); c.moveTo(-4.6, hy + 4.2); c.quadraticCurveTo(0, hy + 7.6, 4.6, hy + 4.2); c.lineTo(0, hy + 6.4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-1.5, hy + 5.6, 0.35, 0, 6.28); c.arc(1.6, hy + 5.4, 0.35, 0, 6.28); c.fill();
  } else if (side) {
    if (!blink) { c.fillStyle = '#2b1d14'; c.beginPath(); c.arc(2.9, hy + 0.7, 0.75, 0, 6.28); c.fill(); }
    c.strokeStyle = HAIR; c.lineWidth = 0.6; c.beginPath(); c.moveTo(1.8, hy - 0.9); c.lineTo(4, hy - 0.6); c.stroke();
    c.fillStyle = SKIN; c.beginPath(); c.moveTo(5.4, hy); c.quadraticCurveTo(7.2, hy + 1.8, 5.4, hy + 2.4); c.fill();
    c.strokeStyle = '#6b3b2a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(3.4, hy + 3.4); c.lineTo(4.8, hy + 3.2); c.stroke();
    c.fillStyle = '#d84343'; c.beginPath(); c.moveTo(-3, hy + 4.4); c.quadraticCurveTo(1, hy + 6.8, 4.6, hy + 4.4); c.lineTo(1, hy + 6); c.closePath(); c.fill();
  }
  if (o.fill >= 1 && dir !== 'up') { // sweat drop
    const t = (time * 1.2) % 1;
    c.fillStyle = `rgba(150,210,255,${1 - t})`; c.beginPath(); c.ellipse(side ? -3 : 5, hy - 2 + t * 5, 0.8, 1.2, 0, 0, 6.28); c.fill();
  }
  // cap
  c.fillStyle = lin(c, 0, hy - 6.5, 0, hy, [[0, shade(CAP, 0.3)], [1, shade(CAP, -0.3)]]);
  c.beginPath(); c.arc(0, hy - 1.1, 6, Math.PI, 0); c.closePath(); c.fill();
  c.strokeStyle = shade(CAP, -0.6); c.lineWidth = 0.5; c.stroke();
  c.strokeStyle = shade(CAP, -0.35); c.beginPath(); c.moveTo(0, hy - 7); c.lineTo(0, hy - 1.2); c.stroke();
  c.fillStyle = shade(CAP, 0.4); c.beginPath(); c.arc(0, hy - 7, 0.8, 0, 6.28); c.fill();
  c.fillStyle = shade(CAP, -0.4);
  if (dir === 'down') { ellipse(c, 0, hy - 0.9, 6.8, 2.1); c.fill(); c.fillStyle = '#ffd27a'; c.font = 'bold 3px system-ui'; c.textAlign = 'center'; c.fillText('GK', 0, hy - 2.6); }
  else if (side) { ellipse(c, 5.2, hy - 1.2, 4.2, 1.4); c.fill(); c.fillStyle = '#ffd27a'; c.fillRect(1, hy - 4, 2, 1.2); }
  else { c.fillRect(-5.6, hy - 1.6, 11.2, 1.4); c.fillStyle = '#ccc'; c.fillRect(-1.5, hy - 2.6, 3, 1); }
  if (o.crown) {
    c.fillStyle = lin(c, 0, hy - 14, 0, hy - 6, [[0, '#fff3a0'], [1, '#d4a017']]);
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
