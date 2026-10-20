import { fmtMoney } from '../core/format';
import { BRANCHES, Branch, UPGRADES, UPGRADE_MAP, UpgradeDef, upgradeCost } from '../data/upgrades';
import { Game } from '../game/Game';

const NS = 'http://www.w3.org/2000/svg';
const ANGLE: Record<Branch, number> = { coleta: -90, automacao: 30, reciclagem: 150 };
const DEPTH = 150;
const BASE = 80;
const LATERAL = 138;
const NODE_R = 34;

interface NodeEl { u: UpgradeDef; g: SVGGElement; ring: SVGCircleElement; lv: SVGTextElement; cost: SVGTextElement; x: number; y: number }
interface LinkEl { from: string; to: string; path: SVGPathElement; flow: SVGPathElement; cross: boolean }

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
};

function branchColor(b: Branch) { return BRANCHES.find((x) => x.id === b)!.color; }

export function nodePos(u: UpgradeDef): { x: number; y: number } {
  const a = (ANGLE[u.branch] * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const px = -dy, py = dx;
  const depth = BASE + (u.row + 1) * DEPTH - DEPTH * 0.35;
  const lat = (u.col - 1) * LATERAL * (1 + u.row * 0.06);
  return { x: dx * depth + px * lat, y: dy * depth + py * lat };
}

function splitName(name: string): string[] {
  if (name.length <= 13) return [name];
  const words = name.split(' ');
  let best = [name], bd = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.max(a.length, b.length);
    if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}

/** Radial, pannable/zoomable upgrade tree rendered with SVG. */
export class SkillTree {
  el: HTMLElement;
  private svgEl: SVGSVGElement;
  private world: SVGGElement;
  private nodes = new Map<string, NodeEl>();
  private links: LinkEl[] = [];
  private detail: HTMLElement;
  private view = { x: 0, y: 0, s: 0.6 };
  private fitted = false;
  private fittedOnce = false;
  selected = 'c_bag';
  private pointers = new Map<number, { x: number; y: number }>();
  private dragMoved = 0;
  private pinch = 0;
  onBuy: (id: string) => string | null = () => null;
  onSound: (n: 'click' | 'error') => void = () => {};

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'sk';
    this.svgEl = svg('svg', { class: 'sk-svg' });
    this.el.appendChild(this.svgEl);
    this.buildDefs();
    this.world = svg('g', {}, this.svgEl);
    this.buildGraph();
    this.detail = document.createElement('div');
    this.detail.className = 'sk-detail';
    this.el.appendChild(this.detail);
    const ctrl = document.createElement('div');
    ctrl.className = 'sk-ctrl';
    ctrl.innerHTML = `<button data-z="1.25">+</button><button data-z="0.8">−</button><button data-z="fit" title="Centralizar">⤢</button>`;
    ctrl.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const z = (b as HTMLElement).dataset.z!;
      if (z === 'fit') this.fit(); else this.zoomAt(Number(z), this.svgEl.clientWidth / 2, this.svgEl.clientHeight / 2);
    }));
    this.el.appendChild(ctrl);
    const legend = document.createElement('div');
    legend.className = 'sk-legend';
    legend.innerHTML = `<span><i class="lg own"></i>Adquirida</span><span><i class="lg can"></i>Pode comprar</span><span><i class="lg av"></i>Disponível</span><span><i class="lg lock"></i>Bloqueada</span>`;
    this.el.appendChild(legend);
    this.bindInput();
  }

  private buildDefs() {
    const defs = svg('defs', {}, this.svgEl);
    for (const b of BRANCHES) {
      const g = svg('radialGradient', { id: `skg-${b.id}`, cx: '35%', cy: '30%', r: '75%' }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.55 }, g);
      svg('stop', { offset: '35%', 'stop-color': b.color }, g);
      svg('stop', { offset: '100%', 'stop-color': '#1a120a' }, g);
    }
    const lock = svg('radialGradient', { id: 'skg-lock', cx: '35%', cy: '30%', r: '75%' }, defs);
    svg('stop', { offset: '0%', 'stop-color': '#4a3d30' }, lock);
    svg('stop', { offset: '100%', 'stop-color': '#16100a' }, lock);
    const avail = svg('radialGradient', { id: 'skg-av', cx: '35%', cy: '30%', r: '75%' }, defs);
    svg('stop', { offset: '0%', 'stop-color': '#5b4632' }, avail);
    svg('stop', { offset: '100%', 'stop-color': '#21170e' }, avail);
    const root = svg('radialGradient', { id: 'skg-root', cx: '35%', cy: '30%', r: '75%' }, defs);
    svg('stop', { offset: '0%', 'stop-color': '#fff6d6' }, root);
    svg('stop', { offset: '40%', 'stop-color': '#ffb02e' }, root);
    svg('stop', { offset: '100%', 'stop-color': '#5a2d06' }, root);
    const f = svg('filter', { id: 'sk-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    svg('feGaussianBlur', { stdDeviation: 6, result: 'b' }, f);
    const m = svg('feMerge', {}, f);
    svg('feMergeNode', { in: 'b' }, m);
    svg('feMergeNode', { in: 'SourceGraphic' }, m);
    const grid = svg('pattern', { id: 'sk-grid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
    svg('path', { d: 'M40 0H0V40', fill: 'none', stroke: 'rgba(255,210,150,0.05)', 'stroke-width': 1 }, grid);
  }

  private buildGraph() {
    const w = this.world;
    svg('rect', { x: -2000, y: -2000, width: 4000, height: 4000, fill: 'url(#sk-grid)' }, w);
    // concentric rings and branch sectors
    for (let i = 1; i <= 6; i++) svg('circle', { cx: 0, cy: 0, r: BASE + i * DEPTH - DEPTH * 0.35, fill: 'none', stroke: 'rgba(255,210,150,0.06)', 'stroke-width': 2, 'stroke-dasharray': '4 10' }, w);
    for (const b of BRANCHES) {
      const a = (ANGLE[b.id] * Math.PI) / 180;
      const span = 0.95;
      const R = BASE + 6.6 * DEPTH;
      const p1 = { x: Math.cos(a - span) * R, y: Math.sin(a - span) * R }, p2 = { x: Math.cos(a + span) * R, y: Math.sin(a + span) * R };
      svg('path', { d: `M0 0 L${p1.x} ${p1.y} A${R} ${R} 0 0 1 ${p2.x} ${p2.y} Z`, fill: b.color, opacity: 0.035 }, w);
      const lx = Math.cos(a) * (BASE + 6.9 * DEPTH), ly = Math.sin(a) * (BASE + 6.9 * DEPTH);
      const t = svg('text', { x: lx, y: ly, class: 'sk-branch', fill: b.color, 'text-anchor': 'middle' }, w);
      t.textContent = b.name.toUpperCase();
    }
    const linkG = svg('g', {}, w);
    const nodeG = svg('g', {}, w);
    // root
    const root = svg('g', { class: 'sk-root' }, nodeG);
    svg('circle', { r: 58, fill: 'rgba(255,176,46,0.12)', class: 'sk-root-halo' }, root);
    svg('circle', { r: 46, fill: 'url(#skg-root)', stroke: '#ffe29a', 'stroke-width': 3 }, root);
    const rt = svg('text', { y: 12, 'text-anchor': 'middle', class: 'sk-root-ic' }, root);
    rt.textContent = '👑';
    const rl = svg('text', { y: 72, 'text-anchor': 'middle', class: 'sk-name' }, root);
    rl.textContent = 'Reino do Lixo';

    const addLink = (from: string, to: string, cross: boolean) => {
      const a = from === 'root' ? { x: 0, y: 0 } : nodePos(UPGRADE_MAP[from]);
      const b = nodePos(UPGRADE_MAP[to]);
      let d: string;
      if (cross) {
        const mx = (a.x + b.x) / 2 * 0.35, my = (a.y + b.y) / 2 * 0.35;
        d = `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
      } else {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ang = (ANGLE[UPGRADE_MAP[to].branch] * Math.PI) / 180;
        const k = 0.18 * Math.hypot(b.x - a.x, b.y - a.y);
        d = `M${a.x} ${a.y} Q${mx - Math.cos(ang) * k * 0.2} ${my - Math.sin(ang) * k * 0.2} ${b.x} ${b.y}`;
      }
      const path = svg('path', { d, class: 'sk-link' }, linkG);
      const flow = svg('path', { d, class: 'sk-flow' }, linkG);
      const col = branchColor(UPGRADE_MAP[to].branch);
      path.style.setProperty('--c', col);
      flow.style.setProperty('--c', col);
      this.links.push({ from, to, path, flow, cross });
    };
    for (const u of UPGRADES) {
      const sameBranch = u.req.filter(([r]) => UPGRADE_MAP[r].branch === u.branch);
      if (!sameBranch.length) addLink('root', u.id, false);
      for (const [r] of u.req) addLink(r, u.id, UPGRADE_MAP[r].branch !== u.branch);
    }
    for (const u of UPGRADES) {
      const { x, y } = nodePos(u);
      const g = svg('g', { class: 'sk-node', transform: `translate(${x} ${y})` }, nodeG);
      g.dataset.id = u.id;
      g.style.setProperty('--c', branchColor(u.branch));
      g.style.setProperty('--grad', `url(#skg-${u.branch})`);
      svg('circle', { r: NODE_R + 14, class: 'halo' }, g);
      svg('circle', { r: NODE_R + 6, class: 'ring-bg' }, g);
      const ring = svg('circle', { r: NODE_R + 6, class: 'ring', transform: 'rotate(-90)' }, g);
      // ticks for each level
      if (u.max > 1 && u.max <= 14) {
        for (let i = 0; i < u.max; i++) {
          const a = (i / u.max) * Math.PI * 2 - Math.PI / 2;
          svg('line', { x1: Math.cos(a) * (NODE_R + 2), y1: Math.sin(a) * (NODE_R + 2), x2: Math.cos(a) * (NODE_R + 10), y2: Math.sin(a) * (NODE_R + 10), class: 'tick' }, g);
        }
      }
      svg('circle', { r: NODE_R, class: 'base' }, g);
      svg('circle', { r: NODE_R - 5, class: 'inner' }, g);
      const ic = svg('text', { y: 9, 'text-anchor': 'middle', class: 'sk-ic' }, g);
      ic.textContent = u.icon;
      const lockG = svg('g', { class: 'lock', transform: `translate(${NODE_R - 6} ${-NODE_R + 6})` }, g);
      svg('circle', { r: 11, fill: '#1b140d', stroke: '#6b5a44', 'stroke-width': 2 }, lockG);
      svg('rect', { x: -5, y: -1, width: 10, height: 8, rx: 1.5, fill: '#a8957a' }, lockG);
      svg('path', { d: 'M-3 -1 V-4 A3 3 0 0 1 3 -4 V-1', fill: 'none', stroke: '#a8957a', 'stroke-width': 2 }, lockG);
      const lvBadge = svg('g', { transform: `translate(0 ${NODE_R + 4})` }, g);
      svg('rect', { x: -22, y: -9, width: 44, height: 18, rx: 9, class: 'lvbg' }, lvBadge);
      const lv = svg('text', { y: 4.5, 'text-anchor': 'middle', class: 'sk-lv' }, lvBadge);
      const lines = splitName(u.name);
      lines.forEach((ln, i) => { const t = svg('text', { y: NODE_R + 32 + i * 15, 'text-anchor': 'middle', class: 'sk-name' }, g); t.textContent = ln; });
      const cost = svg('text', { y: NODE_R + 33 + lines.length * 15, 'text-anchor': 'middle', class: 'sk-cost' }, g);
      this.nodes.set(u.id, { u, g, ring, lv, cost, x, y });
    }
  }

  private applyView() {
    this.world.setAttribute('transform', `translate(${this.view.x} ${this.view.y}) scale(${this.view.s})`);
  }

  fit() {
    const w = this.svgEl.clientWidth || 800, h = this.svgEl.clientHeight || 500;
    const panel = this.detail.offsetHeight + 24;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes.values()) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    x0 -= 80; x1 += 80; y0 -= 70; y1 += 110;
    const avail = h - panel;
    this.view.s = Math.max(0.3, Math.min(1.1, Math.min(w / (x1 - x0), avail / (y1 - y0))));
    this.view.x = w / 2 - ((x0 + x1) / 2) * this.view.s;
    this.view.y = avail / 2 - ((y0 + y1) / 2) * this.view.s + 6;
    if (this.view.s < 0.62 && !this.fittedOnce) {
      // first open: readable zoom centered near the root, the player can pan/zoom out
      this.view.s = 0.62;
      this.view.x = w / 2;
      this.view.y = avail / 2 + 60;
    }
    this.fittedOnce = true;
    this.applyView();
  }

  focus(id: string) {
    const n = this.nodes.get(id);
    if (!n) return;
    const w = this.svgEl.clientWidth, h = this.svgEl.clientHeight;
    this.view.x = w / 2 - n.x * this.view.s;
    this.view.y = h / 2 - n.y * this.view.s - 40;
    this.applyView();
  }

  private zoomAt(f: number, sx: number, sy: number) {
    const s = Math.max(0.25, Math.min(2.2, this.view.s * f));
    const k = s / this.view.s;
    this.view.x = sx - (sx - this.view.x) * k;
    this.view.y = sy - (sy - this.view.y) * k;
    this.view.s = s;
    this.applyView();
  }

  private bindInput() {
    const el = this.svgEl;
    el.addEventListener('wheel', (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragMoved = 0;
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (this.pointers.size === 1) {
        this.view.x += dx; this.view.y += dy;
        this.dragMoved += Math.abs(dx) + Math.abs(dy);
        this.applyView();
      }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = el.getBoundingClientRect();
        if (this.pinch > 0) this.zoomAt(d / this.pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        this.pinch = d;
        this.dragMoved += 99;
      }
    });
    const up = (e: PointerEvent) => {
      const was = this.pointers.has(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      if (!was || this.dragMoved > 8 || e.type === 'pointercancel') return;
      const node = (e.target as Element).closest?.('.sk-node') as SVGGElement | null;
      if (node) {
        const id = node.dataset.id!;
        if (this.selected === id) this.buy(id);
        else { this.selected = id; this.onSound('click'); }
        this.update();
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private buy(id: string) {
    const err = this.onBuy(id);
    const n = this.nodes.get(id)!;
    if (err) {
      this.onSound('error');
      n.g.classList.remove('shake'); void n.g.getBoundingClientRect(); n.g.classList.add('shake');
      return;
    }
    // shockwave
    const wave = svg('circle', { r: NODE_R, class: 'sk-wave', cx: n.x, cy: n.y }, this.world);
    wave.style.setProperty('--c', branchColor(n.u.branch));
    setTimeout(() => wave.remove(), 900);
  }

  /** Mount (first time) or refresh states. */
  update() {
    const g = this.game;
    this.renderDetail();
    if (!this.fitted && this.svgEl.clientWidth > 0) { this.fitted = true; this.fit(); }
    for (const n of this.nodes.values()) {
      const lvl = g.upgrades[n.u.id] || 0;
      const reqOk = g.upgradeReqsMet(n.u.id);
      const max = lvl >= n.u.max;
      const cost = upgradeCost(n.u, lvl);
      const state = max ? 'max' : lvl > 0 ? (g.money >= cost ? 'own can' : 'own') : !reqOk ? 'locked' : g.money >= cost ? 'can' : 'av';
      n.g.setAttribute('class', `sk-node ${state}${this.selected === n.u.id ? ' sel' : ''}`);
      const C = 2 * Math.PI * (NODE_R + 6);
      const frac = lvl / n.u.max;
      n.ring.setAttribute('stroke-dasharray', `${C * frac} ${C}`);
      n.lv.textContent = n.u.max > 1 ? `${lvl}/${n.u.max}` : max ? '✓' : '0/1';
      n.cost.textContent = max ? 'MÁXIMO' : fmtMoney(cost);
    }
    for (const l of this.links) {
      const fromOwned = l.from === 'root' || (g.upgrades[l.from] || 0) > 0;
      const toOwned = (g.upgrades[l.to] || 0) > 0;
      const st = fromOwned && toOwned ? 'on' : fromOwned ? 'half' : 'off';
      l.path.setAttribute('class', `sk-link ${st}${l.cross ? ' cross' : ''}`);
      l.flow.setAttribute('class', `sk-flow ${st}`);
    }
    this.renderDetail();
  }

  private renderDetail() {
    const g = this.game;
    const u = UPGRADE_MAP[this.selected];
    const lvl = g.upgrades[u.id] || 0;
    const prob = g.canBuyUpgrade(u.id);
    const missing = u.req.filter(([r, l]) => (g.upgrades[r] || 0) < l);
    const col = branchColor(u.branch);
    const key = `${u.id}|${lvl}|${prob}|${Math.floor(g.money)}`;
    if (this.detail.dataset.key === key) return;
    this.detail.dataset.key = key;
    const max = lvl >= u.max;
    this.detail.style.setProperty('--c', col);
    this.detail.innerHTML = `<div class="ic">${u.icon}</div><div class="info"><div class="t"><b>${u.name}</b><span>${BRANCHES.find((b) => b.id === u.branch)!.name} · ${u.max > 1 ? `Nível ${lvl}/${u.max}` : max ? 'Adquirida' : 'Única'}</span></div>
      <p>${u.desc}</p><p class="eff">▸ ${u.effect}${u.max > 1 ? ' (por nível)' : ''}</p>
      ${missing.length ? `<p class="req">🔒 Requer: ${missing.map(([r, l]) => `${UPGRADE_MAP[r].name}${UPGRADE_MAP[r].max > 1 ? ` nv ${l}` : ''}`).join(' + ')}</p>` : ''}</div>
      ${max ? `<div class="maxed">MÁXIMO</div>` : `<button class="btn ${prob ? 'disabled' : 'green'}">${prob && !missing.length && g.money < upgradeCost(u, lvl) ? 'Faltam ' + fmtMoney(upgradeCost(u, lvl) - g.money) : 'Comprar ' + fmtMoney(upgradeCost(u, lvl))}</button>`}`;
    this.detail.querySelector('button')?.addEventListener('click', () => { this.buy(u.id); this.update(); });
  }
}
