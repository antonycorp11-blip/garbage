import { TILE, TOTAL_GARBAGE, WORLD_TILES } from '../core/constants';
import { fmtInt, fmtMoney, fmtPct, fmtShort, fmtTime } from '../core/format';
import { DISCOVERIES } from '../data/discoveries';
import { BUILD_ORDER, MACHINES, MAX_MACHINE_LEVEL, MachineType, machineUpgradeCost } from '../data/machines';
import { MATERIALS, MAT_COUNT } from '../data/materials';
import { ENDING } from '../data/messages';
import { G_ASPHALT, G_CONCRETE, G_EARTH, G_GRAVEL, G_RUINFLOOR } from '../data/regions';
import { TOOLS } from '../data/tools';
import { UPGRADES, UPGRADE_MAP } from '../data/upgrades';
import { Game, GameEvent } from '../game/Game';
import { Machine, botCount, centerX, centerY, hubRadius, isBelt, isHub, machineBufferCap, machineRadius, machineRate } from '../game/Machines';
import { drawTool } from '../render/character';
import { drawBelt, drawMachine } from '../render/machinesDraw';
import { drawDiscovery } from '../render/specialsDraw';
import { ICONS } from './icons';
import { SkillTree } from './SkillTree';
import type { App } from '../main';

type Tab = 'upgrades' | 'build' | 'tools' | 'inventory' | 'map' | 'stats' | 'settings';
const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'upgrades', name: 'Melhorias', icon: ICONS.upgrades },
  { id: 'build', name: 'Construir', icon: ICONS.build },
  { id: 'tools', name: 'Ferramentas', icon: ICONS.tools },
  { id: 'inventory', name: 'Depósito', icon: ICONS.inventory },
  { id: 'map', name: 'Mapa', icon: ICONS.map },
  { id: 'stats', name: 'Estatísticas', icon: ICONS.stats },
  { id: 'settings', name: 'Opções', icon: ICONS.settings },
];

const h = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export class UI {
  root: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  modalTab: Tab | null = null;
  private modalEl: HTMLElement | null = null;
  private refreshT = 0;
  private hudT = 0;
  popupOpen = false;
  private popupQueue: (() => HTMLElement)[] = [];
  private thumbs = new Map<string, string>();
  selected: Machine | null = null;
  private mpanelT = 0;
  private mapImg: ImageData | null = null;
  private mapCanvas = document.createElement('canvas');
  private mapT = 0;
  private lastRemaining = -1;
  private resetArm = 0;

  constructor(private app: App) {
    this.root = document.getElementById('ui')!;
    this.mapCanvas.width = WORLD_TILES; this.mapCanvas.height = WORLD_TILES;
    this.buildHud();
  }

  get game(): Game { return this.app.game; }

  private buildHud() {
    const r = this.root;
    r.innerHTML = '';
    const counter = h(`<div class="hud-counter pe"><div class="lbl">LIXO RESTANTE</div><div class="num">1.000.000</div><div class="bar"><i></i></div><div class="sub"><span>removido <b class="rm">0</b></span><span><b class="pc">0%</b></span><span><b class="ps">0</b>/s</span><span class="desk-only"><b class="pm">0</b>/min</span><span>⚙ <b class="mc">0</b></span></div></div>`);
    r.appendChild(counter);
    this.el.counter = counter;
    const left = h(`<div class="hud-left">
      <div class="chip money pe">${ICONS.coin.replace('<svg', '<svg class="ico"')}<span class="mv">$0</span><span class="rate"></span></div>
      <div class="chip bag pe"><div class="row"><span>${ICONS.bag.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} Mochila</span><span class="bv">0/20</span></div><div class="bar"><i></i></div></div>
      <div class="chip toolchip pe"><span class="tn">Mãos Nuas</span><small class="tl">1/7</small></div>
    </div>`);
    r.appendChild(left);
    this.el.left = left;
    const right = h(`<div class="hud-right"></div>`);
    for (const t of TABS) {
      const b = h(`<button class="mbtn" data-tab="${t.id}">${t.icon}<span class="tip">${t.name}</span><span class="dot"></span></button>`);
      b.addEventListener('click', () => { this.app.audio.play('click'); this.openModal(t.id); });
      right.appendChild(b);
    }
    r.appendChild(right);
    this.el.right = right;
    this.el.goal = h(`<div class="goal"></div>`); r.appendChild(this.el.goal);
    this.el.hint = h(`<div class="hint desk-only"></div>`); r.appendChild(this.el.hint);
    this.el.msgs = h(`<div class="msgs"></div>`); r.appendChild(this.el.msgs);
    const mm = h(`<div class="minimap pe desk-only"><canvas width="150" height="150"></canvas></div>`);
    mm.addEventListener('click', () => this.openModal('map'));
    r.appendChild(mm);
    this.el.minimap = mm;
    // mobile controls
    this.el.joy = h(`<div class="joy"><i></i></div>`); r.appendChild(this.el.joy);
    this.el.joyhint = h(`<div class="joyhint mobile-only">◀ arraste para andar ▶</div>`); r.appendChild(this.el.joyhint);
    const act = h(`<div class="actbtns mobile-only"><button class="bigbtn int dim">INTERAGIR</button><button class="bigbtn">COLETAR</button></div>`);
    r.appendChild(act);
    this.el.btnInteract = act.children[0] as HTMLElement;
    this.el.btnCollect = act.children[1] as HTMLElement;
    const zoom = h(`<div class="zoombtns mobile-only"><button class="mbtn">+</button><button class="mbtn">−</button></div>`);
    zoom.children[0].addEventListener('click', () => this.app.zoomBy(1.2));
    zoom.children[1].addEventListener('click', () => this.app.zoomBy(1 / 1.2));
    r.appendChild(zoom);
    this.el.zoom = zoom;
    this.el.buildbar = h(`<div class="buildbar pe" style="display:none"></div>`); r.appendChild(this.el.buildbar);
    this.el.mpanel = h(`<div class="mpanel" style="display:none"></div>`); r.appendChild(this.el.mpanel);
    this.el.layer = h(`<div style="position:absolute;inset:0;pointer-events:none;display:grid;place-items:center"></div>`); r.appendChild(this.el.layer);
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number) {
    const g = this.game;
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      const c = this.el.counter;
      const num = c.querySelector('.num') as HTMLElement;
      num.textContent = fmtInt(g.remaining);
      if (this.lastRemaining !== g.remaining) { num.classList.add('bump'); setTimeout(() => num.classList.remove('bump'), 90); }
      this.lastRemaining = g.remaining;
      const pct = (g.removed / TOTAL_GARBAGE) * 100;
      (c.querySelector('.bar i') as HTMLElement).style.width = Math.max(pct, pct > 0 ? 0.4 : 0) + '%';
      c.querySelector('.rm')!.textContent = fmtShort(g.removed);
      c.querySelector('.pc')!.textContent = fmtPct(pct);
      c.querySelector('.ps')!.textContent = fmtShort(g.ratePerSec);
      c.querySelector('.pm')!.textContent = fmtShort(g.ratePerMin);
      c.querySelector('.mc')!.textContent = `${g.workingMachines}/${g.machines.machines.filter((m) => !isHub(m.type) && !isBelt(m.type)).length}`;
      const L = this.el.left;
      L.querySelector('.mv')!.textContent = fmtMoney(g.money);
      const p = g.player;
      L.querySelector('.bv')!.textContent = `${fmtInt(p.carried)}/${fmtInt(g.d.capacity)}`;
      (L.querySelector('.bag .bar i') as HTMLElement).style.width = (100 * p.carried) / g.d.capacity + '%';
      L.querySelector('.bag')!.classList.toggle('full', p.carried >= g.d.capacity);
      L.querySelector('.tn')!.textContent = g.tool.name;
      L.querySelector('.tl')!.textContent = `${g.toolTier + 1}/${TOOLS.length}`;
      this.el.goal.textContent = this.app.build ? '' : g.nextGoal();
      // notification dots
      const canUp = UPGRADES.some((u) => !g.canBuyUpgrade(u.id));
      const canTool = g.toolTier + 1 < TOOLS.length && g.money >= g.toolCost(g.toolTier + 1);
      const canBuild = BUILD_ORDER.some((t) => g.isUnlocked(t) && t !== 'conveyor' && !g.missingFor(g.machineCost(t)));
      this.el.right.querySelector('[data-tab=upgrades]')!.classList.toggle('has', canUp);
      this.el.right.querySelector('[data-tab=tools]')!.classList.toggle('has', canTool);
      this.el.right.querySelector('[data-tab=build]')!.classList.toggle('has', canBuild);
      // context
      const ctx = g.context;
      const hint = this.el.hint;
      if (ctx.kind === 'none') hint.innerHTML = this.app.build ? '' : '';
      else hint.innerHTML = `<span class="key">E</span> ${esc(ctx.label)}${ctx.progress ? `<span class="prog"><i style="width:${ctx.progress * 100}%"></i></span>` : ''}`;
      const ib = this.el.btnInteract;
      ib.classList.toggle('dim', ctx.kind === 'none');
      ib.textContent = ctx.kind === 'special' ? 'ABRIR' : ctx.kind === 'machine' ? (ctx.label.startsWith('Esvaziar') ? 'ESVAZIAR' : 'VER') : ctx.kind === 'depot' ? 'VENDER' : 'INTERAGIR';
    }
    this.refreshT -= dt;
    if (this.modalTab && this.refreshT <= 0) { this.refreshT = 0.5; this.renderModal(false); }
    this.mpanelT -= dt;
    if (this.mpanelT <= 0) { this.mpanelT = 0.25; this.renderMachinePanel(); }
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.5; this.drawMinimap(); }
  }

  handleEvent(e: GameEvent) {
    switch (e.type) {
      case 'message': this.message(e.text, e.from); break;
      case 'discovery': this.discoveryPopup(e.special); break;
      case 'openInventory': this.openModal('inventory'); break;
      case 'openMachine': this.select(this.game.machines.byId.get(e.id) ?? null); break;
      case 'ending': this.endingPopup(); break;
      case 'offline': this.offlinePopup(e.seconds, e.removed); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ messages
  private msgQueue: [string, string][] = [];
  private msgBusy = 0;

  message(text: string, from: string) {
    this.msgQueue.push([text, from]);
    if (this.msgQueue.length > 6) this.msgQueue.shift();
    this.pumpMessages();
  }

  private pumpMessages() {
    const box = this.el.msgs;
    if (!this.msgQueue.length || box.children.length >= 2 || performance.now() < this.msgBusy) {
      if (this.msgQueue.length) setTimeout(() => this.pumpMessages(), 500);
      return;
    }
    const [text, from] = this.msgQueue.shift()!;
    this.msgBusy = performance.now() + 1200;
    const initials = from.split(/\s+/).filter((w) => /^[A-ZÁ-Ú]/.test(w)).map((w) => w[0]).join('').slice(0, 2) || '?';
    const m = h(`<div class="msg"><div class="av">${esc(initials)}</div><div><div class="from">${esc(from)}</div><div>${esc(text)}</div></div></div>`);
    box.appendChild(m);
    const life = Math.min(12000, 4000 + text.length * 50);
    setTimeout(() => { m.classList.add('out'); setTimeout(() => { m.remove(); this.pumpMessages(); }, 400); }, life);
    if (this.msgQueue.length) setTimeout(() => this.pumpMessages(), 1300);
  }

  // ------------------------------------------------------------------ build bar
  showBuildBar() {
    const b = this.app.build;
    const bar = this.el.buildbar;
    if (!b) { bar.style.display = 'none'; return; }
    const def = MACHINES[b.type];
    const cost = this.game.machineCost(b.type);
    bar.style.display = 'flex';
    bar.innerHTML = `<span class="name">${def.name}</span><span class="cost">${this.costHtml(cost)}</span>
      ${isBelt(b.type) ? `<button class="btn ghost" data-a="rot">↻ Girar <span class="key desk-only">R</span></button>` : ''}
      <span class="muted desk-only" style="font-size:12px">${isBelt(b.type) ? 'Clique e arraste para fazer a linha' : 'Clique para construir'}</span>
      <button class="btn ghost" data-a="cancel">✕ Sair <span class="key desk-only">Esc</span></button>`;
    bar.querySelector('[data-a=cancel]')?.addEventListener('click', () => this.app.cancelBuild());
    bar.querySelector('[data-a=rot]')?.addEventListener('click', () => { this.app.rotateBuild(); });
  }

  private costHtml(cost: { money: number; mats: number[] }) {
    const g = this.game;
    let s = `<span class="cost ${g.money < cost.money ? 'no' : ''}">${fmtMoney(cost.money)}</span>`;
    for (let k = 0; k < MAT_COUNT; k++) if (cost.mats[k] > 0) s += `<span class="cost ${g.storage[k] < cost.mats[k] ? 'no' : ''}"><i class="sw" style="background:${MATERIALS[k].color}"></i>${fmtShort(cost.mats[k])}</span>`;
    return `<span class="costs" style="display:inline-flex">${s}</span>`;
  }

  // ------------------------------------------------------------------ machine panel
  select(m: Machine | null) {
    this.selected = m;
    this.app.renderer.selected = m;
    this.mpanelT = 0;
    if (m) this.app.audio.play('click');
  }

  private renderMachinePanel() {
    const m = this.selected;
    const p = this.el.mpanel;
    const g = this.game;
    if (!m || !g.machines.byId.has(m.id) || this.modalTab) { p.style.display = 'none'; if (m && !g.machines.byId.has(m.id)) this.select(null); return; }
    const def = MACHINES[m.type];
    p.style.display = 'block';
    const d = g.d;
    let status = '', cls = 'ok';
    if (isHub(m.type)) { status = `Recebe materiais. Raio de serviço: ${Math.round(hubRadius(m, d))} m`; }
    else if (isBelt(m.type)) { status = m.linked ? 'Conectada a um depósito ✓' : 'Não chega a um depósito: siga até o depósito'; cls = m.linked ? 'ok' : 'bad'; }
    else if (m.type === 'ancient') status = 'Entrega direta no depósito (mistério)';
    else if (m.status === 'full') { status = 'Caçamba cheia! Esvazie ou conecte uma esteira.'; cls = 'bad'; }
    else if (m.status === 'idle') { status = 'Sem lixo no alcance.'; cls = 'warn'; }
    else status = 'Trabalhando';
    let delivery = '';
    if (!isHub(m.type) && !isBelt(m.type) && m.type !== 'ancient') {
      delivery = m.inService ? 'Área de serviço do depósito ✓' : m.outConveyor >= 0 ? (m.linked ? 'Esteira conectada ✓' : 'Esteira não chega ao depósito ✗') : 'Sem entrega automática ✗';
    }
    const canUp = MACHINES[m.type].buildable && m.type !== 'conveyor' && m.level < MAX_MACHINE_LEVEL;
    const upCost = Math.ceil(machineUpgradeCost(m.type, m.level) * d.costMult);
    const near = Math.hypot(g.player.tx - centerX(m), g.player.ty - centerY(m)) < def.size / 2 + 2;
    const kv: string[] = [];
    if (def.rate > 0) kv.push(`<span>Velocidade</span><span>${fmtShort(machineRate(m, d) * (m.type === 'robots' ? botCount(m, d) : 1))}/s</span>`);
    if (def.radius > 0 && !isHub(m.type)) kv.push(`<span>Alcance</span><span>${machineRadius(m, d).toFixed(1)} m</span>`);
    if (m.type === 'robots') kv.push(`<span>Robôs</span><span>${botCount(m, d)}</span>`);
    if (def.buffer > 0) kv.push(`<span>Caçamba</span><span>${fmtInt(m.bufferTotal)} / ${fmtInt(machineBufferCap(m, d))}</span>`);
    if (m.collected > 0) kv.push(`<span>Total coletado</span><span>${fmtInt(m.collected)}</span>`);
    if (delivery) kv.push(`<span>Entrega</span><span>${delivery}</span>`);
    if (isBelt(m.type)) kv.push(`<span>Pacotes</span><span>${m.belt.length}</span>`);
    p.innerHTML = `<div class="h"><b>${def.name}</b>${def.buildable && m.type !== 'conveyor' ? `<span class="lvl">Nv ${m.level}/${MAX_MACHINE_LEVEL}</span>` : ''}<button class="close" data-a="x" style="width:32px;height:32px">✕</button></div>
      <div class="kv">${kv.join('')}</div>
      <div class="st ${cls}">${status}</div>
      <div class="acts">
        ${canUp ? `<button class="btn ${g.money < upCost ? 'disabled' : 'green'}" data-a="up">Melhorar ${fmtMoney(upCost)}</button>` : ''}
        ${m.bufferTotal > 0 ? `<button class="btn ${near ? '' : 'disabled'}" data-a="empty" title="Chegue perto">Esvaziar na mochila</button>` : ''}
        ${isBelt(m.type) ? `<button class="btn ghost" data-a="rot">↻ Girar</button>` : ''}
        ${def.buildable ? `<button class="btn red" data-a="del">Demolir</button>` : ''}
      </div>`;
    p.querySelector('[data-a=x]')?.addEventListener('click', () => this.select(null));
    p.querySelector('[data-a=up]')?.addEventListener('click', () => { const e = g.upgradeMachine(m); if (e) { this.app.audio.play('error'); this.toastErr(e); } this.mpanelT = 0; });
    p.querySelector('[data-a=empty]')?.addEventListener('click', () => { if (near) g.emptyMachineIntoBackpack(m); else this.toastErr('Chegue mais perto da máquina'); this.mpanelT = 0; });
    p.querySelector('[data-a=rot]')?.addEventListener('click', () => { m.dir = (m.dir + 1) % 4; g.machines.linksDirty = true; this.app.audio.play('click'); this.mpanelT = 0; });
    p.querySelector('[data-a=del]')?.addEventListener('click', () => { g.demolish(m); this.select(null); });
  }

  toastErr(text: string) {
    const g = this.game;
    this.app.fx.text(g.player.x, g.player.y - 40, text, '#fca5a5');
  }

  // ------------------------------------------------------------------ modal
  openModal(tab: Tab) {
    if (this.popupOpen) return;
    this.app.cancelBuild();
    if (!this.modalEl) {
      const wrap = h(`<div class="modal-wrap"><div class="modal"><div class="modal-h"></div><div class="modal-b"></div></div></div>`);
      wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) this.closeModal(); });
      this.el.layer.appendChild(wrap);
      this.modalEl = wrap;
    }
    this.modalTab = tab;
    const head = this.modalEl.querySelector('.modal-h')!;
    head.innerHTML = TABS.map((t) => `<button class="tab ${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${t.icon}<span>${t.name}</span></button>`).join('') + `<button class="close">✕</button>`;
    head.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { this.app.audio.play('click'); this.openModal((b as HTMLElement).dataset.tab as Tab); }));
    head.querySelector('.close')!.addEventListener('click', () => this.closeModal());
    this.modalEl.querySelector('.modal')!.classList.toggle('tree-mode', tab === 'upgrades');
    (this.modalEl.querySelector('.modal-b') as HTMLElement).scrollTop = 0;
    this.renderModal(true);
  }

  closeModal() {
    this.modalEl?.remove();
    this.modalEl = null;
    this.modalTab = null;
  }

  private renderModal(full: boolean) {
    if (!this.modalEl || !this.modalTab) return;
    const body = this.modalEl.querySelector('.modal-b') as HTMLElement;
    const st = body.scrollTop;
    switch (this.modalTab) {
      case 'upgrades': this.renderUpgrades(body, full); break;
      case 'build': this.renderBuild(body); break;
      case 'tools': this.renderTools(body); break;
      case 'inventory': this.renderInventory(body); break;
      case 'map': if (full) this.renderMap(body); else this.drawBigMap(); break;
      case 'stats': this.renderStats(body); break;
      case 'settings': if (full) this.renderSettings(body); break;
    }
    body.scrollTop = st;
  }

  private tree: SkillTree | null = null;

  private renderUpgrades(body: HTMLElement, full: boolean) {
    if (!this.tree) {
      this.tree = new SkillTree(this.game);
      this.tree.onBuy = (id) => this.game.buyUpgrade(id);
      this.tree.onSound = (n) => this.app.audio.play(n);
    }
    if (full || !body.contains(this.tree.el)) {
      body.innerHTML = '';
      body.appendChild(this.tree.el);
      requestAnimationFrame(() => this.tree!.update());
    } else this.tree.update();
  }

  private flash(el: Element) {
    (el as HTMLElement).animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 });
  }

  private machineThumb(type: MachineType): string {
    let url = this.thumbs.get(type);
    if (url) return url;
    const cv = document.createElement('canvas');
    cv.width = 144; cv.height = 144;
    const c = cv.getContext('2d')!;
    const size = MACHINES[type].size;
    const sc = size === 1 ? 2.6 : size === 2 ? 1.5 : 1.05;
    c.translate(72, 80);
    c.scale(sc, sc);
    c.translate(-(size * TILE) / 2, -(size * TILE) / 2);
    const fake: Machine = { id: -1, type, tx: 0, ty: 0, dir: 0, level: 1, buffer: [0, 0, 0, 0, 0, 0], bufferTotal: 0, work: 0, cursor: 0, collected: 0, belt: [{ mat: 0, units: 1, sorted: false, t: 0.5 }], bots: [], status: 'working', targets: null, targetsRadius: 0, anim: 0, lastTarget: -1, outConveyor: -1, inService: false, linked: true, deliverT: 0, built: 1 };
    if (isBelt(type)) drawBelt(c, fake, this.game, 0.3);
    else drawMachine(c, fake, this.game, 0.3, this.app.fx, false);
    url = cv.toDataURL();
    this.thumbs.set(type, url);
    return url;
  }

  private renderBuild(body: HTMLElement) {
    const g = this.game;
    let html = `<h2>Construir Máquinas</h2><p class="lead">Máquinas só podem ser construídas em terreno limpo. Perto do depósito (círculo azul) elas entregam sozinhas; longe, precisam de esteiras.</p><div class="grid">`;
    for (const t of BUILD_ORDER) {
      const def = MACHINES[t];
      const unl = g.isUnlocked(t);
      const cost = g.machineCost(t);
      const miss = g.missingFor(cost);
      const owned = g.machines.count(t);
      const stats: string[] = [];
      if (def.rate > 0) stats.push(`⚡ ${t === 'robots' ? `${def.rate}/s por robô` : `${def.rate}/s`}`);
      if (def.radius > 0) stats.push(`◎ ${def.radius} m`);
      if (def.buffer > 0) stats.push(`▣ ${def.buffer}`);
      stats.push(`Tamanho ${def.size}×${def.size}`);
      const lockTxt = def.unlock ? `Requer melhoria: ${UPGRADE_MAP[def.unlock].name}` : '';
      html += `<div class="card ${unl ? '' : 'locked'}">${owned ? `<span class="badge">×${owned}</span>` : ''}<div class="top"><img src="${this.machineThumb(t)}" style="width:72px;height:72px;border-radius:10px;background:radial-gradient(circle at 50% 40%, #5a4632, #2a1f15)"/><div><div class="t">${def.name}</div><div class="stats">${stats.join(' · ')}</div></div></div>
        <div class="d">${esc(def.desc)}</div>
        ${unl ? `<div class="costs">${this.costHtml(cost)}</div><button class="btn ${miss ? 'disabled' : 'green'}" data-b="${t}">${miss ? esc(miss) : 'Construir'}</button>` : `<div class="d" style="color:var(--bad)">🔒 ${esc(lockTxt)}</div>`}</div>`;
    }
    html += `</div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => {
      const t = (b as HTMLElement).dataset.b as MachineType;
      if (g.missingFor(g.machineCost(t))) { this.app.audio.play('error'); this.flash(b); return; }
      this.closeModal();
      this.app.startBuild(t);
    }));
  }

  private toolThumb(tier: number): string {
    const key = 'tool' + tier;
    let url = this.thumbs.get(key);
    if (url) return url;
    const cv = document.createElement('canvas'); cv.width = 144; cv.height = 144;
    const c = cv.getContext('2d')!;
    c.translate(72, 50); c.scale(3.2, 3.2); c.rotate(-0.6);
    if (tier === 0) {
      c.fillStyle = '#d6c27a';
      c.beginPath(); c.ellipse(0, 6, 6, 7, 0, 0, 6.28); c.fill();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-4.5 + i * 3, -2, 1.4, 4, 0, 0, 6.28); c.fill(); }
      c.strokeStyle = '#8a7a3a'; c.lineWidth = 0.6; c.stroke();
    } else drawTool(c, tier, 0.5, 1, true);
    url = cv.toDataURL();
    this.thumbs.set(key, url);
    return url;
  }

  private renderTools(body: HTMLElement) {
    const g = this.game;
    let html = `<h2>Ferramentas</h2><p class="lead">Cada ferramenta muda a forma de coletar. As de área funcionam segurando o botão enquanto você caminha.</p><div class="grid">`;
    TOOLS.forEach((t, i) => {
      const owned = i <= g.toolTier;
      const next = i === g.toolTier + 1;
      const cost = g.toolCost(i);
      const stat = t.mode === 'single' ? `${t.units} obj/ação · alcance ${t.reach} m` : `${t.rate}/s em área · raio ${t.radius} m`;
      html += `<div class="card ${owned || next ? '' : 'locked'}">${i === g.toolTier ? '<span class="badge cur">EQUIPADA</span>' : owned ? '<span class="badge">✓</span>' : ''}
        <div class="top"><img src="${this.toolThumb(i)}" style="width:72px;height:72px;border-radius:10px;background:radial-gradient(circle at 50% 40%, ${t.color}55, #2a1f15)"/><div><div class="t">${i + 1}. ${t.name}</div><div class="stats">${stat}</div></div></div>
        <div class="d">${esc(t.desc)}</div>
        ${next ? `<button class="btn ${g.money < cost ? 'disabled' : 'green'}" data-t="${i}">Comprar ${fmtMoney(cost)}</button>` : !owned ? `<div class="d">${fmtMoney(cost)} · requer a anterior</div>` : ''}
      </div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      const e = g.buyTool(Number((b as HTMLElement).dataset.t));
      if (e) this.flash(b);
      this.renderModal(false);
    }));
  }

  private renderInventory(body: HTMLElement) {
    const g = this.game;
    const p = g.player;
    let total = 0;
    let rows = '';
    const reserves = [0, 20, 60, 200, 1000, 5000];
    for (let k = 0; k < MAT_COUNT; k++) {
      const m = MATERIALS[k];
      const val = g.storage[k] * g.d.value[k];
      total += val;
      rows += `<tr><td><span class="matname"><i class="matsw" style="background:${m.color}"></i>${m.name}</span></td>
        <td>${fmtInt(g.storage[k])}<div class="muted" style="font-size:11px">mochila: ${fmtInt(p.backpack[k])}</div></td>
        <td class="muted">${fmtMoney(g.d.value[k])}/un</td>
        <td><button class="toggle ${g.autoSell[k] ? 'on' : ''}" data-auto="${k}">${g.autoSell[k] ? 'Auto-venda ✓' : 'Auto-venda ✗'}</button>
        <button class="toggle" data-res="${k}" title="Quantidade guardada para construções">Guardar ${fmtShort(g.reserve[k])}</button></td>
        <td><button class="btn ${g.storage[k] > 0 ? '' : 'disabled'}" data-sell="${k}">Vender ${fmtMoney(val)}</button></td></tr>`;
    }
    body.innerHTML = `<h2>Depósito</h2><p class="lead">Materiais entregues ficam aqui. A auto-venda converte o excedente em dinheiro, mas guarda a reserva para construir máquinas.</p>
      <div class="row" style="margin-bottom:6px"><button class="btn green" data-sellall>Vender tudo (${fmtMoney(total)})</button><span class="muted">Mochila: ${fmtInt(p.carried)}/${fmtInt(g.d.capacity)}${p.carried > 0 ? ' — volte ao depósito para descarregar' : ''}</span></div>
      <table class="inv">${rows}</table>`;
    body.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => { const k = Number((b as HTMLElement).dataset.sell); g.sell(k, g.storage[k]); this.renderModal(false); }));
    body.querySelector('[data-sellall]')?.addEventListener('click', () => { g.sellAll(); this.renderModal(false); });
    body.querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', () => { const k = Number((b as HTMLElement).dataset.auto); g.autoSell[k] = !g.autoSell[k]; g.autoSellNow(); this.app.audio.play('click'); this.renderModal(false); }));
    body.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => {
      const k = Number((b as HTMLElement).dataset.res);
      const i = reserves.indexOf(g.reserve[k]);
      g.reserve[k] = reserves[(i + 1) % reserves.length];
      g.autoSellNow();
      this.app.audio.play('click');
      this.renderModal(false);
    }));
  }

  // ------------------------------------------------------------------ map
  private paintMap() {
    const g = this.game;
    const w = g.world;
    const N = WORLD_TILES;
    if (!this.mapImg) this.mapImg = this.mapCanvas.getContext('2d')!.createImageData(N, N);
    const d = this.mapImg.data;
    const radar = g.d.radar;
    const groundCol: Record<number, number[]> = { [G_EARTH]: [150, 118, 78], [G_CONCRETE]: [150, 148, 140], [G_ASPHALT]: [70, 70, 74], [G_GRAVEL]: [130, 118, 98], [G_RUINFLOOR]: [168, 150, 120] };
    for (let i = 0; i < N * N; i++) {
      const gv = w.garbage[i];
      let r: number, gg: number, b: number;
      if (w.occupant[i] >= 0) { r = 240; gg = 240; b = 240; }
      else if (gv > 0) {
        const t = Math.min(1, gv / 80);
        if (radar) { r = 80 + 175 * Math.min(1, t * 1.6); gg = 20 + 200 * Math.max(0, t - 0.45); b = 60 * (1 - t); }
        else { r = 60 + 50 * t; gg = 46 + 34 * t; b = 32 + 18 * t; }
      } else {
        const c = groundCol[w.ground[i]] ?? [150, 118, 78];
        r = c[0]; gg = c[1]; b = c[2];
      }
      d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    for (const m of g.machines.machines) {
      if (!isHub(m.type)) continue;
      const s = MACHINES[m.type].size;
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (m.ty + y) * N + m.tx + x; d[i * 4] = 56; d[i * 4 + 1] = 189; d[i * 4 + 2] = 248; }
    }
    this.mapCanvas.getContext('2d')!.putImageData(this.mapImg, 0, 0);
  }

  private drawMinimap() {
    if (document.body.classList.contains('touch')) return;
    const g = this.game;
    this.paintMap();
    const cv = this.el.minimap.querySelector('canvas') as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    const span = 56;
    const px = g.player.tx, py = g.player.ty;
    const x0 = Math.max(0, Math.min(WORLD_TILES - span, px - span / 2)), y0 = Math.max(0, Math.min(WORLD_TILES - span, py - span / 2));
    c.drawImage(this.mapCanvas, x0, y0, span, span, 0, 0, 150, 150);
    const k = 150 / span;
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.arc((px - x0) * k, (py - y0) * k, 4, 0, 6.28); c.stroke(); c.fill();
    if (g.locator) { c.fillStyle = '#f472b6'; c.beginPath(); c.arc((g.locator.tx + 0.5 - x0) * k, (g.locator.ty + 0.5 - y0) * k, 3, 0, 6.28); c.fill(); }
  }

  private renderMap(body: HTMLElement) {
    const g = this.game;
    body.innerHTML = `<h2>Mapa do Reino</h2><p class="lead">${g.d.radar ? 'Radar ativo: as cores mostram a densidade de lixo restante.' : 'Dica: o Radar de Lixo mostra a densidade com cores quentes.'}</p>
      <div class="mapwrap"><canvas width="576" height="576"></canvas><div class="legend">
      <div><span class="sw" style="background:${g.d.radar ? '#ff3a2a' : '#6e5a40'}"></span>Lixo ${g.d.radar ? '(quanto mais amarelo, mais denso)' : ''}</div>
      <div><span class="sw" style="background:#96764e"></span>Terreno limpo</div>
      <div><span class="sw" style="background:#f0f0f0"></span>Máquinas</div>
      <div><span class="sw" style="background:#38bdf8"></span>Depósitos</div>
      <div><span class="sw" style="background:#ffd54f"></span>Descobertas</div>
      <div><span class="sw" style="background:#fff;border-radius:50%"></span>Você</div>
      <div style="margin-top:8px" class="muted">Limpo: <b style="color:var(--text)">${fmtPct((g.removed / TOTAL_GARBAGE) * 100)}</b></div>
      <div class="muted">Descobertas: <b style="color:var(--text)">${g.specials.filter((s) => s.revealed).length}/${g.specials.length}</b></div>
      </div></div>`;
    this.drawBigMap();
  }

  private drawBigMap() {
    const cv = this.modalEl?.querySelector('.mapwrap canvas') as HTMLCanvasElement | null;
    if (!cv) return;
    const g = this.game;
    this.paintMap();
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.mapCanvas, 0, 0, 576, 576);
    const k = 576 / WORLD_TILES;
    // camera rect
    const v = g.view;
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5;
    c.strokeRect((v.x0 / TILE) * k, (v.y0 / TILE) * k, ((v.x1 - v.x0) / TILE) * k, ((v.y1 - v.y0) / TILE) * k);
    g.specials.forEach((s, i) => {
      if (!s.revealed) return;
      const sp = g.world.specials[i];
      c.fillStyle = s.opened ? '#ffd54f' : '#fff59d';
      c.beginPath(); c.arc((sp.tx + sp.size / 2) * k, (sp.ty + sp.size / 2) * k, 5, 0, 6.28); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
    });
    if (g.locator) { c.fillStyle = '#f472b6'; c.beginPath(); c.arc((g.locator.tx + 0.5) * k, (g.locator.ty + 0.5) * k, 5, 0, 6.28); c.fill(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.arc(g.player.tx * k, g.player.ty * k, 6, 0, 6.28); c.stroke(); c.fill();
  }

  private renderStats(body: HTMLElement) {
    const g = this.game;
    const s = g.stats;
    const items: [string, string][] = [
      ['Lixo restante', fmtInt(g.remaining)], ['Removido', fmtInt(g.removed)], ['Conclusão', fmtPct((g.removed / TOTAL_GARBAGE) * 100)],
      ['Coleta por segundo', fmtShort(g.ratePerSec)], ['Coleta por minuto', fmtShort(g.ratePerMin)], ['Recorde por segundo', fmtShort(s.peakRate)],
      ['Coletado por você', fmtInt(s.removedPlayer)], ['Coletado por máquinas', fmtInt(s.removedMachines)], ['Dinheiro ganho', fmtMoney(s.earned)],
      ['Unidades vendidas', fmtInt(s.unitsSold)], ['Raridades achadas', fmtInt(s.rareFound)], ['Máquinas construídas', fmtInt(s.built)],
      ['Máquinas ativas', String(g.workingMachines)], ['Distância caminhada', `${fmtShort(s.walked)} m`], ['Tempo de jogo', fmtTime(s.playTime)],
    ];
    const eta = g.ratePerSec > 0 ? fmtTime(g.remaining / g.ratePerSec) : '∞';
    items.push(['Previsão no ritmo atual', eta]);
    let html = `<h2>Estatísticas</h2><div class="statgrid">${items.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;
    html += `<h2 style="margin-top:18px">Descobertas</h2><div class="disc">`;
    g.specials.forEach((st, i) => {
      const def = DISCOVERIES[g.world.specials[i].index];
      html += st.revealed ? `<span>${st.opened ? '✓' : '…'} ${esc(def.name)}</span>` : `<span class="unk">??? ${'·'.repeat(3)}</span>`;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  private renderSettings(body: HTMLElement) {
    const st = this.app.settings;
    body.innerHTML = `<h2>Opções</h2>
      <div class="setrow"><label>Música</label><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-s="music"/></div>
      <div class="setrow"><label>Efeitos sonoros</label><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-s="sfx"/></div>
      <div class="setrow"><label>Partículas</label><button class="toggle ${st.quality >= 1 ? 'on' : ''}" data-q>${st.quality >= 1 ? 'Alta' : 'Econômica'}</button></div>
      <div class="setrow"><label>Mostrar áreas de serviço dos depósitos</label><button class="toggle ${st.ranges ? 'on' : ''}" data-r>${st.ranges ? 'Sim' : 'Não'}</button></div>
      <div class="setrow"><label>Salvar agora <span class="muted">(o jogo salva sozinho a cada 15 s)</span></label><button class="btn ghost" data-save>Salvar</button></div>
      <div class="setrow"><label>Apagar todo o progresso</label><button class="btn red" data-reset>Reiniciar progresso</button></div>
      <p class="muted" style="margin-top:14px;font-size:13px">Garbage Kingdom — arte, animações, música e efeitos 100% gerados por código. Controles: WASD/setas para andar, segure o botão do mouse ou ESPAÇO para coletar, E para interagir, roda do mouse para zoom, B construir, U melhorias, T ferramentas, I depósito, M mapa, R girar esteira, Esc fechar.</p>`;
    body.querySelectorAll('input[data-s]').forEach((i) => i.addEventListener('input', () => {
      const inp = i as HTMLInputElement;
      (st as unknown as Record<string, number>)[inp.dataset.s!] = Number(inp.value);
      this.app.applySettings();
    }));
    body.querySelector('[data-q]')!.addEventListener('click', () => { st.quality = st.quality >= 1 ? 0.5 : 1; this.app.applySettings(); this.renderModal(true); });
    body.querySelector('[data-r]')!.addEventListener('click', () => { st.ranges = !st.ranges; this.app.applySettings(); this.renderModal(true); });
    body.querySelector('[data-save]')!.addEventListener('click', () => { this.app.save(); this.message('Progresso salvo.', 'Sistema'); });
    const rb = body.querySelector('[data-reset]') as HTMLButtonElement;
    rb.addEventListener('click', () => {
      if (Date.now() - this.resetArm < 4000) { this.app.resetProgress(); return; }
      this.resetArm = Date.now();
      rb.textContent = 'Tem certeza? Clique de novo';
    });
  }

  // ------------------------------------------------------------------ popups
  private queuePopup(make: () => HTMLElement) {
    this.popupQueue.push(make);
    if (!this.popupOpen) this.nextPopup();
  }

  private nextPopup() {
    const make = this.popupQueue.shift();
    if (!make) { this.popupOpen = false; return; }
    this.closeModal();
    this.popupOpen = true;
    const wrap = h(`<div class="modal-wrap"></div>`);
    const pop = make();
    wrap.appendChild(pop);
    this.el.layer.appendChild(wrap);
    const close = () => { wrap.remove(); this.app.audio.play('click'); this.nextPopup(); };
    pop.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', close));
  }

  discoveryPopup(s: number) {
    const g = this.game;
    const sp = g.world.specials[s];
    const def = DISCOVERIES[sp.index];
    this.queuePopup(() => {
      const rewards: string[] = [];
      if (def.money) rewards.push('+' + fmtMoney(def.money));
      if (def.mats) def.mats.forEach((v, k) => { if (v) rewards.push(`+${fmtInt(v)} ${MATERIALS[k].name}`); });
      const el = h(`<div class="popup"><div class="kick">DESCOBERTA</div><h1>${esc(def.name)}</h1><canvas width="360" height="280"></canvas><p>${esc(def.text)}</p>
        ${def.effectText ? `<p style="color:#a7f3d0">${esc(def.effectText)}</p>` : ''}<div class="reward">${rewards.map((r) => `<span>${esc(r)}</span>`).join('')}</div><br/><button class="btn" data-ok>Incrível!</button></div>`);
      const cv = el.querySelector('canvas') as HTMLCanvasElement;
      const c = cv.getContext('2d')!;
      const start = performance.now();
      const anim = () => {
        if (!cv.isConnected && performance.now() - start > 500) return;
        const t = (performance.now() - start) / 1000;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, 360, 280);
        c.translate(180, 140);
        c.rotate(t * 0.2);
        c.globalAlpha = 0.25;
        for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillStyle = i % 2 ? '#ffd27a' : '#ffb02e'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-20, -200); c.lineTo(20, -200); c.fill(); }
        c.globalAlpha = 1;
        c.setTransform(1, 0, 0, 1, 0, 0);
        const sc = sp.size === 1 ? 4 : 2.4;
        c.translate(180, 200); c.scale(sc, sc);
        drawDiscovery(c, def.id, 0, 0, sp.size, true, t);
        requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
      return el;
    });
  }

  introPopup(isNew: boolean, onStart: () => void) {
    this.queuePopup(() => {
      const el = h(`<div class="popup intro"><div class="logo">GARBAGE<br/><span>KINGDOM</span></div>
        <p>${isNew ? 'Você comprou um terreno por R$ 1,00. Ele vem com <b>1.000.000 de unidades de lixo</b>. Limpe tudo. Uma coisa de cada vez. Depois, mil de cada vez.' : 'Bem-vindo de volta, Majestade. O lixo sentiu sua falta. Ele não foi a lugar nenhum.'}</p>
        <p class="muted" style="font-size:13px">${document.body.classList.contains('touch') ? 'Joystick à esquerda para andar · segure COLETAR' : 'WASD para andar · segure o mouse ou ESPAÇO para coletar · E interage'}</p>
        <button class="btn" data-ok style="font-size:18px;padding:12px 30px">${isNew ? 'Começar a limpar' : 'Continuar'}</button></div>`);
      el.querySelector('[data-ok]')!.addEventListener('click', onStart);
      return el;
    });
  }

  offlinePopup(seconds: number, removed: number) {
    this.queuePopup(() => h(`<div class="popup"><div class="kick">ENQUANTO VOCÊ ESTAVA FORA</div><h1>${fmtInt(removed)} unidades</h1><p>Suas máquinas trabalharam por ${fmtTime(seconds)} e removeram ${fmtInt(removed)} unidades de lixo. Elas não reclamaram. Muito.</p><button class="btn" data-ok>Ótimo</button></div>`));
  }

  endingPopup() {
    const g = this.game;
    this.queuePopup(() => h(`<div class="popup ending"><div class="kick">FIM... OU SERÁ?</div><h1>O REINO ESTÁ LIMPO</h1>
      ${ENDING.map((t) => `<p>${esc(t)}</p>`).join('')}
      <div class="reward"><span>Tempo: ${fmtTime(g.stats.playTime)}</span><span>Ganhos: ${fmtMoney(g.stats.earned)}</span><span>Descobertas: ${g.specials.filter((s) => s.opened).length}/${g.specials.length}</span></div><br/>
      <button class="btn" data-ok>Contemplar meu reino</button></div>`));
  }
}
