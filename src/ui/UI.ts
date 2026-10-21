import { TILE, TOTAL_GARBAGE, WORLD_TILES } from '../core/constants';
import { fmtInt, fmtMoney, fmtPct, fmtShort, fmtTime } from '../core/format';
import { DISCOVERIES } from '../data/discoveries';
import { BUILD_ORDER, MACHINES, MAX_MACHINE_LEVEL, MachineRole, MachineType, ROLE_NAMES, machineUpgradeCost } from '../data/machines';
import { MATERIALS, MAT_COUNT } from '../data/materials';
import { ENDING, SENDER } from '../data/messages';
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
const TABS: { id: Tab; name: string; short: string; icon: string }[] = [
  { id: 'upgrades', name: 'Árvore de Melhorias', short: 'Melhorias', icon: ICONS.upgrades },
  { id: 'build', name: 'Construir Máquinas', short: 'Construir', icon: ICONS.build },
  { id: 'tools', name: 'Ferramentas', short: 'Ferram.', icon: ICONS.tools },
  { id: 'inventory', name: 'Depósito', short: 'Depósito', icon: ICONS.inventory },
  { id: 'map', name: 'Mapa do Reino', short: 'Mapa', icon: ICONS.map },
  { id: 'stats', name: 'Estatísticas', short: 'Números', icon: ICONS.stats },
  { id: 'settings', name: 'Opções', short: 'Opções', icon: ICONS.settings },
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
      <div class="chip yard pe" style="display:none" title="Pátio do depósito: o que as máquinas entregam espera aqui para ser processado"><div class="row"><span>⚙ Pátio</span><span class="yv">0/250</span></div><div class="bar"><i></i></div></div>
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
    this.el.mpanel.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (b) this.onPanelAction(b.dataset.a!);
    });
    // remember when a finger/mouse is down so live refreshes never swap a button under it
    const down = () => { this.pressing = true; this.lastPress = performance.now(); };
    const up = () => { this.pressing = false; this.lastPress = performance.now(); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
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
      const yc = L.querySelector('.yard') as HTMLElement;
      const hasAuto = g.machines.machines.some((m) => MACHINES[m.type].buffer > 0 || g.yardTotal > 0);
      yc.style.display = hasAuto ? '' : 'none';
      document.body.classList.toggle('has-yard', hasAuto);
      if (hasAuto) {
        const yf = g.yardTotal / Math.max(1, g.yardCap());
        yc.querySelector('.yv')!.textContent = `${fmtShort(g.yardTotal)}/${fmtShort(g.yardCap())} · ${fmtShort(g.processRate())}/s`;
        (yc.querySelector('.bar i') as HTMLElement).style.width = Math.min(100, yf * 100) + '%';
        yc.classList.toggle('full', yf >= 0.98);
        yc.classList.toggle('warn', yf >= 0.7 && yf < 0.98);
      }
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
    if (this.modalTab && this.refreshT <= 0 && !this.recentlyPressed()) {
      this.refreshT = 0.5;
      this.renderModal(false);
      const mm = this.modalEl?.querySelector('.mt-money');
      if (mm) mm.textContent = fmtMoney(this.game.money);
    }
    if (this.app.build && this.hudT === 0.1) this.refreshBuildBar();
    this.mpanelT -= dt;
    if (this.mpanelT <= 0) { this.mpanelT = 0.25; this.renderMachinePanel(); }
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.5; this.drawMinimap(); }
  }

  handleEvent(e: GameEvent) {
    switch (e.type) {
      case 'message': this.message(e.text, e.from); if (e.from === SENDER) this.app.renderer.life.say(e.text); break;
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
    const m = h(`<div class="msg pe"><div class="av">${esc(initials)}</div><div><div class="from">${esc(from)}</div><div>${esc(text)}</div></div></div>`);
    box.appendChild(m);
    const life = Math.min(12000, 4000 + text.length * 50);
    let gone = false;
    const dismiss = () => { if (gone) return; gone = true; m.classList.add('out'); setTimeout(() => { m.remove(); this.pumpMessages(); }, 400); };
    m.addEventListener('pointerdown', (e) => { e.stopPropagation(); dismiss(); });
    setTimeout(dismiss, life);
    if (this.msgQueue.length) setTimeout(() => this.pumpMessages(), 1300);
  }

  // ------------------------------------------------------------------ build bar
  showBuildBar() {
    const b = this.app.build;
    const bar = this.el.buildbar;
    document.body.classList.toggle('building', !!b);
    if (!b) { bar.style.display = 'none'; return; }
    const def = MACHINES[b.type];
    const cost = this.game.machineCost(b.type);
    const belt = isBelt(b.type);
    bar.style.display = 'flex';
    bar.innerHTML = `<div class="bb-h"><span class="name">${b.moving ? 'Movendo: ' : ''}${def.name}</span><span class="cost">${b.moving ? '<span class="cost">grátis</span>' : this.costHtml(cost)}</span></div>
      <div class="bb-msg"></div>
      <div class="bb-pad mobile-only">
        <button class="pad" data-n="-1,0" aria-label="Esquerda">◀</button><button class="pad" data-n="0,-1" aria-label="Cima">▲</button><button class="pad" data-n="0,1" aria-label="Baixo">▼</button><button class="pad" data-n="1,0" aria-label="Direita">▶</button>
        ${belt ? `<button class="pad rot" data-a="rot" aria-label="Girar">↻</button>` : ''}
      </div>
      <div class="bb-a">
        ${belt ? `<button class="btn ghost desk-only" data-a="rot">↻ Girar <span class="key">R</span></button>` : ''}
        <button class="btn ghost" data-a="cancel">✕ Sair <span class="key desk-only">Esc</span></button>
        <button class="btn green mobile-only" data-a="ok">${belt ? '✓ Colocar esteira' : b.moving ? '✓ Colocar aqui' : '✓ Construir aqui'}</button>
      </div>`;
    bar.querySelector('[data-a=cancel]')?.addEventListener('click', () => this.app.cancelBuild());
    bar.querySelectorAll('[data-a=rot]').forEach((x) => x.addEventListener('click', () => { this.app.rotateBuild(); this.refreshBuildBar(); }));
    bar.querySelector('[data-a=ok]')?.addEventListener('click', () => this.app.confirmBuild());
    bar.querySelectorAll('[data-n]').forEach((x) => x.addEventListener('click', () => { const [dx, dy] = (x as HTMLElement).dataset.n!.split(',').map(Number); this.app.nudgeBuild(dx, dy); }));
    this.refreshBuildBar();
  }

  refreshBuildBar() {
    const b = this.app.build;
    if (!b) return;
    const g = this.game;
    const bar = this.el.buildbar;
    const touch = document.body.classList.contains('touch');
    const belt = isBelt(b.type);
    const msg = bar.querySelector('.bb-msg') as HTMLElement | null;
    let tip = belt ? (touch ? 'Arraste para mover · ↻ muda a direção · cada toque em Colocar avança uma casa' : 'Clique e arraste para fazer a linha') : touch ? 'Arraste em qualquer lugar para mover · toque para pular até um lugar' : 'Clique para construir';
    let warn = false;
    if (!belt && !b.problem && b.type !== 'recycler') {
      const s = MACHINES[b.type].size;
      const inService = g.machines.hubs().some((h) => Math.hypot(centerX(h) - b.tx - s / 2, centerY(h) - b.ty - s / 2) <= hubRadius(h, g.d));
      if (!inService) { tip = 'Fora do círculo do depósito: depois toque na máquina e use 🔗 Conectar'; warn = true; }
      else tip = '✓ Ótimo lugar: dentro da área do depósito, entrega sozinha';
    }
    if (msg) { msg.textContent = b.problem ? '⚠ ' + b.problem : tip; msg.classList.toggle('bad', !!b.problem); msg.classList.toggle('warn', warn); msg.classList.toggle('good', !b.problem && !warn && !belt); }
    const ok = bar.querySelector('[data-a=ok]') as HTMLElement | null;
    if (ok) ok.classList.toggle('disabled', !!b.problem);
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
    if (!m || !g.machines.byId.has(m.id) || this.modalTab) { p.style.display = 'none'; document.body.classList.remove('panel-open'); if (m && !g.machines.byId.has(m.id)) this.select(null); return; }
    document.body.classList.add('panel-open');
    const def = MACHINES[m.type];
    p.style.display = 'block';
    const d = g.d;
    let status = '', cls = 'ok';
    const yardFull = g.yardSpace() <= 0;
    if (isHub(m.type)) {
      status = yardFull ? 'Pátio lotado! Máquinas esperando. Construa um Triturador dentro do círculo.' : g.yardTotal > g.yardCap() * 0.7 ? 'Pátio quase cheio: um Triturador ajudaria.' : 'Processando normalmente.';
      cls = yardFull ? 'bad' : g.yardTotal > g.yardCap() * 0.7 ? 'warn' : 'ok';
    } else if (m.type === 'crusher') { status = m.status === 'working' ? 'Triturando a fila do pátio' : 'Pátio vazio, aguardando material'; cls = m.status === 'working' ? 'ok' : 'warn'; }
    else if (isBelt(m.type)) { status = m.linked ? 'Conectada a um depósito ✓' : 'Não chega a um depósito: siga até o depósito'; cls = m.linked ? 'ok' : 'bad'; }
    else if (m.type === 'ancient') status = 'Entrega direta no depósito (mistério)';
    else if (m.status === 'full' && m.inService && yardFull) { status = 'Parada: o pátio do depósito está lotado. Construa um Triturador.'; cls = 'bad'; }
    else if (m.status === 'full') { status = 'Caçamba cheia! Conecte ao depósito ou esvazie.'; cls = 'bad'; }
    else if (m.status === 'idle') { status = (def.heavy ? 'Área limpa! ' : 'Só sobrou entulho pesado (ou nada) no alcance. ') + 'Use ↔ Mover para levá-la a uma área com lixo.'; cls = 'warn'; }
    else status = 'Trabalhando';
    let delivery = '';
    if (!isHub(m.type) && !isBelt(m.type) && m.type !== 'ancient') {
      delivery = m.inService ? 'Área de serviço do depósito ✓' : m.outConveyor >= 0 ? (m.linked ? 'Esteira conectada ✓' : 'Esteira não chega ao depósito ✗') : 'Sem entrega automática ✗';
    }
    const canUp = MACHINES[m.type].buildable && m.type !== 'conveyor' && m.level < MAX_MACHINE_LEVEL;
    const upCost = Math.ceil(machineUpgradeCost(m.type, m.level) * d.costMult);
    const near = Math.hypot(g.player.tx - centerX(m), g.player.ty - centerY(m)) < def.size / 2 + 2;
    const needsLink = def.buffer > 0 && !m.inService && !(m.outConveyor >= 0 && m.linked);
    const plan = needsLink && g.isUnlocked('conveyor') ? g.planConnection(m) : null;
    const kv: string[] = [`<span>Função</span><span>${esc(def.func)}</span>`];
    if (isHub(m.type)) {
      kv.push(`<span>Pátio</span><span>${fmtInt(g.yardTotal)} / ${fmtInt(g.yardCap())}</span>`);
      kv.push(`<span>Vazão total</span><span>${fmtShort(g.processRate())}/s</span>`);
      kv.push(`<span>Área de serviço</span><span>${Math.round(hubRadius(m, d))} m</span>`);
    }
    if (m.type === 'crusher') kv.push(`<span>Processa</span><span>+${fmtShort(def.process * (1 + 0.5 * (m.level - 1)))}/s</span>`);
    if (def.rate > 0) kv.push(`<span>Ergue pesado</span><span>${def.heavy ? 'Sim ✓' : 'Não'}</span>`);
    if (def.rate > 0) kv.push(`<span>Velocidade</span><span>${fmtShort(machineRate(m, d) * (m.type === 'robots' ? botCount(m, d) : 1))}/s</span>`);
    if (def.radius > 0 && !isHub(m.type)) kv.push(`<span>Alcance</span><span>${machineRadius(m, d).toFixed(1)} m</span>`);
    if (m.type === 'robots') kv.push(`<span>Robôs</span><span>${botCount(m, d)}</span>`);
    if (def.buffer > 0) kv.push(`<span>Caçamba</span><span>${fmtInt(m.bufferTotal)} / ${fmtInt(machineBufferCap(m, d))}</span>`);
    if (m.collected > 0) kv.push(`<span>Total coletado</span><span>${fmtInt(m.collected)}</span>`);
    if (delivery) kv.push(`<span>Entrega</span><span>${delivery}</span>`);
    if (isBelt(m.type)) kv.push(`<span>Pacotes</span><span>${m.belt.length}</span>`);
    const head = `<b>${def.name}</b>${def.buildable && m.type !== 'conveyor' ? `<span class="lvl">Nv ${m.level}/${MAX_MACHINE_LEVEL}</span>` : ''}<button class="close" data-a="x" style="width:32px;height:32px">✕</button>`;
    const acts = `${needsLink ? (plan ? `<button class="btn ${g.missingFor(plan.cost) ? 'disabled' : ''} wide" data-a="link">🔗 Conectar ao depósito · ${plan.tiles.length} esteiras · ${fmtMoney(plan.cost.money)}</button>` : `<div class="st bad wide">${g.isUnlocked('conveyor') ? 'Sem caminho limpo até o depósito: limpe o lixo entre eles' : 'Para entregar de longe, desbloqueie Logística (esteiras)'}</div>`) : ''}
        ${canUp ? `<button class="btn ${g.money < upCost ? 'disabled' : 'green'}" data-a="up">Melhorar ${fmtMoney(upCost)}</button>` : ''}
        ${m.bufferTotal > 0 ? `<button class="btn ${near ? '' : 'disabled'}" data-a="empty" title="Chegue perto">Esvaziar na mochila</button>` : ''}
        ${isBelt(m.type) ? `<button class="btn ghost" data-a="rot">↻ Girar</button>` : ''}
        ${def.buildable && !isBelt(m.type) ? `<button class="btn ghost" data-a="move">↔ Mover</button>` : ''}
        ${def.buildable ? `<button class="btn red" data-a="del">Demolir</button>` : ''}`;
    if (p.dataset.mid !== String(m.id) || !p.querySelector('.acts')) {
      p.dataset.mid = String(m.id);
      p.innerHTML = `<div class="grab"></div><div class="h"></div><div class="kv"></div><div class="st"></div><div class="acts"></div>`;
    }
    // only touch the parts that changed, so a finger on a button never loses its tap
    const put = (sel: string, html: string, cl?: string) => {
      const el = p.querySelector(sel) as HTMLElement;
      if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
      if (cl !== undefined && el.className !== cl) el.className = cl;
    };
    put('.h', head);
    put('.kv', kv.join(''));
    put('.st', status, `st ${cls}`);
    if (!this.recentlyPressed()) put('.acts', acts);
  }

  /** Handles taps on the machine panel buttons (bound once). */
  private onPanelAction(a: string) {
    const m = this.selected;
    const g = this.game;
    if (!m) return;
    const near = Math.hypot(g.player.tx - centerX(m), g.player.ty - centerY(m)) < MACHINES[m.type].size / 2 + 2;
    switch (a) {
      case 'x': this.select(null); break;
      case 'up': { const e = g.upgradeMachine(m); if (e) { this.app.audio.play('error'); this.toastErr(e); } break; }
      case 'empty': if (near) g.emptyMachineIntoBackpack(m); else this.toastErr('Chegue mais perto da máquina'); break;
      case 'rot': m.dir = (m.dir + 1) % 4; g.machines.linksDirty = true; this.app.audio.play('click'); break;
      case 'del': g.demolish(m); this.select(null); break;
      case 'move': this.app.startMove(m); break;
      case 'link': { const e = g.connectToDepot(m); if (e) { this.app.audio.play('error'); this.toastErr(e); } else this.message('Esteiras construídas! Os materiais agora vão sozinhos até o depósito.', 'Sistema'); break; }
    }
    this.mpanelT = 0;
  }

  private pressing = false;
  private lastPress = 0;
  recentlyPressed() { return this.pressing || performance.now() - this.lastPress < 450; }

  toastErr(text: string) {
    const g = this.game;
    this.app.fx.text(g.player.x, g.player.y - 40, text, '#fca5a5');
  }

  // ------------------------------------------------------------------ modal
  openModal(tab: Tab) {
    if (this.popupOpen) return;
    this.app.cancelBuild();
    this.select(null);
    if (!this.modalEl) {
      const wrap = h(`<div class="modal-wrap"><div class="modal"><nav class="modal-nav"></nav><div class="modal-main"><div class="modal-top"><span class="mt-ic"></span><span class="mt-title"></span><span class="mt-money"></span><button class="close" aria-label="Fechar">✕</button></div><div class="modal-b"></div></div></div></div>`);
      wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) this.closeModal(); });
      wrap.querySelector('.close')!.addEventListener('click', () => { this.app.audio.play('click'); this.closeModal(); });
      this.el.layer.appendChild(wrap);
      this.modalEl = wrap;
      document.body.classList.add('modal-open');
    }
    this.modalTab = tab;
    const t = TABS.find((x) => x.id === tab)!;
    const nav = this.modalEl.querySelector('.modal-nav')!;
    nav.innerHTML = TABS.map((x) => `<button class="nav ${x.id === tab ? 'on' : ''}" data-tab="${x.id}">${x.icon}<span>${x.short}</span></button>`).join('');
    nav.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => { this.app.audio.play('click'); this.openModal((b as HTMLElement).dataset.tab as Tab); }));
    this.modalEl.querySelector('.mt-ic')!.innerHTML = t.icon;
    this.modalEl.querySelector('.mt-title')!.textContent = t.name;
    this.modalEl.querySelector('.mt-money')!.textContent = fmtMoney(this.game.money);
    this.modalEl.querySelector('.modal')!.classList.toggle('tree-mode', tab === 'upgrades');
    const mb = this.modalEl.querySelector('.modal-b') as HTMLElement;
    mb.scrollTop = 0;
    mb.dataset.h = '';
    this.renderModal(true);
  }

  closeModal() {
    document.body.classList.remove('modal-open');
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

  /** Replaces a container's HTML only when it changed. Returns false when nothing changed. */
  private put(body: HTMLElement, html: string): boolean {
    if (body.dataset.h === html) return false;
    body.innerHTML = html;
    body.dataset.h = html;
    return true;
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
    let html = `<div class="flowhint"><b>Como funciona:</b> máquinas de <b>coleta</b> tiram o lixo → a <b>logística</b> leva até o depósito (ou elas ficam no círculo azul) → o <b>processamento</b> faz o pátio do depósito dar conta.<div class="yardline">Pátio do depósito: <b>${fmtInt(g.yardTotal)} / ${fmtInt(g.yardCap())}</b> · vazão <b>${fmtShort(g.processRate())}/s</b></div></div>`;
    const roles: MachineRole[] = ['coleta', 'logistica', 'processamento', 'deposito'];
    for (const role of roles) {
      const types = BUILD_ORDER.filter((t) => MACHINES[t].role === role);
      if (!types.length) continue;
      html += `<h3 class="role role-${role}">${ROLE_NAMES[role]}</h3><div class="grid">`;
      for (const t of types) {
        const def = MACHINES[t];
        const unl = g.isUnlocked(t);
        const cost = g.machineCost(t);
        const miss = g.missingFor(cost);
        const owned = g.machines.count(t);
        const stats: string[] = [];
        if (def.rate > 0) stats.push(`<span>⚡ ${t === 'robots' ? `${def.rate}/s cada` : `${def.rate}/s`}</span>`);
        if (def.radius > 0 && def.role === 'coleta') stats.push(`<span>◎ ${def.radius} m</span>`);
        if (def.role === 'coleta') stats.push(def.heavy ? `<span class="hv">🏋 ergue pesado</span>` : `<span class="lt">só leve</span>`);
        if (def.process > 0) stats.push(`<span>⚙ +${def.process}/s</span>`, `<span>▦ +${def.yard} pátio</span>`);
        if (def.buffer > 0) stats.push(`<span>▣ ${def.buffer}</span>`);
        stats.push(`<span>${def.size}×${def.size}</span>`);
        const lockTxt = def.unlock ? `Requer: ${UPGRADE_MAP[def.unlock].name}` : '';
        html += `<div class="card ${unl ? '' : 'locked'}"><div class="top"><img src="${this.machineThumb(t)}" alt=""/><div class="info"><div class="t">${def.name}${owned ? ` <span class="own">×${owned}</span>` : ''}</div><div class="stats">${stats.join('')}</div></div></div>
          <div class="func">${esc(def.func)}</div>
          <div class="d">${esc(def.desc)}</div>
          <div class="foot">${unl ? `<div class="costs">${this.costHtml(cost)}</div><button class="btn ${miss ? 'disabled' : 'green'}" data-b="${t}">${miss ? 'Faltam recursos' : 'Construir'}</button>` : `<div class="lock">🔒 ${esc(lockTxt)}</div>`}</div>
          ${unl && miss ? `<div class="miss">${esc(miss)}</div>` : ''}</div>`;
      }
      html += `</div>`;
    }
    if (!this.put(body, html)) return;
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
    let html = `<p class="lead">Cada ferramenta muda o jeito de coletar. As de área funcionam segurando COLETAR enquanto você anda.</p><div class="grid">`;
    TOOLS.forEach((t, i) => {
      const owned = i <= g.toolTier;
      const next = i === g.toolTier + 1;
      const cost = g.toolCost(i);
      const stat = t.mode === 'single' ? `<span>${t.units} obj/ação</span><span>alcance ${t.reach} m</span>` : `<span>${t.rate}/s em área</span><span>raio ${t.radius} m</span>`;
      html += `<div class="card ${owned || next ? '' : 'locked'} ${i === g.toolTier ? 'current' : ''}"><div class="top"><img src="${this.toolThumb(i)}" alt="" style="background:radial-gradient(circle at 50% 40%, ${t.color}55, #2a1f15)"/><div class="info"><div class="t">${i + 1}. ${t.name}${i === g.toolTier ? ' <span class="own cur">EQUIPADA</span>' : owned ? ' <span class="own">✓</span>' : ''}</div><div class="stats">${stat}</div></div></div>
        <div class="d">${esc(t.desc)}</div>
        ${next ? `<div class="foot"><div class="costs"><span class="cost ${g.money < cost ? 'no' : ''}">${fmtMoney(cost)}</span></div><button class="btn ${g.money < cost ? 'disabled' : 'green'}" data-t="${i}">Comprar</button></div>` : !owned ? `<div class="foot"><div class="lock">${fmtMoney(cost)} · compre a anterior primeiro</div></div>` : ''}
      </div>`;
    });
    html += `</div>`;
    if (!this.put(body, html)) return;
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
    const auto = g.autoReserve();
    for (let k = 0; k < MAT_COUNT; k++) {
      const m = MATERIALS[k];
      const val = g.storage[k] * g.d.value[k];
      total += val;
      rows += `<div class="mat"><div class="mat-h"><i class="matsw" style="background:${m.color}"></i><div class="mat-n"><b>${m.name}</b><small>${fmtMoney(g.d.value[k])} por unidade</small></div><div class="mat-q"><b>${fmtInt(g.storage[k])}</b><small>${p.backpack[k] ? `+${fmtInt(p.backpack[k])} na mochila` : auto[k] > g.reserve[k] ? `guarda ${fmtShort(auto[k])} p/ máquinas` : 'no depósito'}</small></div></div>
        <div class="mat-a"><button class="toggle ${g.autoSell[k] ? 'on' : ''}" data-auto="${k}">${g.autoSell[k] ? '✓ Auto-venda' : '✗ Auto-venda'}</button>
        <button class="toggle" data-res="${k}" title="Quantidade guardada para construções">Guardar ${fmtShort(g.reserve[k])}</button>
        <button class="btn ${g.storage[k] > 0 ? '' : 'disabled'}" data-sell="${k}">Vender ${fmtMoney(val)}</button></div></div>`;
    }
    if (!this.put(body, `<p class="lead">A auto-venda vende o excedente, mas guarda sozinha o material que as máquinas desbloqueadas precisam. "Guardar" aumenta essa reserva.</p>
      <div class="inv-top"><button class="btn green" data-sellall>Vender tudo · ${fmtMoney(total)}</button><span class="muted">Mochila ${fmtInt(p.carried)}/${fmtInt(g.d.capacity)}${p.carried > 0 ? ' · descarregue no depósito' : ''}</span></div>
      <div class="mats">${rows}</div>`)) return;
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
    if (!this.put(body, html)) return;
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
      <p class="muted" style="margin-top:14px;font-size:13px">Garbage Kingdom — arte, animações, música e efeitos 100% gerados por código. Controles: WASD/setas para andar, segure o botão do mouse ou ESPAÇO para coletar, E para interagir, roda do mouse para zoom, B construir, U melhorias, T ferramentas, I depósito, M mapa, R girar esteira, Esc fechar.</p><p class="ver" data-ver>versão ${__BUILD__}</p>`;
    this.bindVersion(body);
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

  /** tapping the version 5 times toggles the diagnostic overlay */
  private bindVersion(root: HTMLElement) {
    const v = root.querySelector('[data-ver]') as HTMLElement | null;
    if (!v) return;
    let n = 0, t = 0;
    v.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = performance.now();
      n = now - t < 800 ? n + 1 : 1; t = now;
      if (n >= 5) { n = 0; this.app.toggleDebug(); }
    });
  }

  introPopup(isNew: boolean, onStart: () => void) {
    this.queuePopup(() => {
      const el = h(`<div class="popup intro"><div class="logo">GARBAGE<br/><span>KINGDOM</span></div>
        <p>${isNew ? 'Você comprou um terreno por R$ 1,00. Ele vem com <b>1.000.000 de unidades de lixo</b>. Limpe tudo. Uma coisa de cada vez. Depois, mil de cada vez.' : 'Bem-vindo de volta, Majestade. O lixo sentiu sua falta. Ele não foi a lugar nenhum.'}</p>
        <p class="muted" style="font-size:13px">${document.body.classList.contains('touch') ? 'Joystick à esquerda para andar · segure COLETAR' : 'WASD para andar · segure o mouse ou ESPAÇO para coletar · E interage'}</p>
        <button class="btn" data-ok style="font-size:18px;padding:12px 30px">${isNew ? 'Começar a limpar' : 'Continuar'}</button><p class="ver" data-ver>versão ${__BUILD__}</p></div>`);
      el.querySelector('[data-ok]')!.addEventListener('click', onStart);
      this.bindVersion(el);
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
