import { TILE, TOTAL_GARBAGE, WORLD_TILES } from '../core/constants';
import { fmtInt, fmtMoney, fmtPct, fmtShort, fmtTime } from '../core/format';
import { DISCOVERIES } from '../data/discoveries';
import { BUILD_ORDER, MACHINES, MAX_MACHINE_LEVEL, MachineRole, MachineType, machineUpgradeCost } from '../data/machines';
import { MATERIALS, MAT_COUNT } from '../data/materials';
import { ENDING, MAE, SENDER } from '../data/messages';
import { MODULES, MODULE_MAP, SLOT_NAMES, ModuleSlot } from '../data/modules';
import { DAY } from '../game/Contracts';
import { G_ASPHALT, G_CONCRETE, G_EARTH, G_GRAVEL, G_RUINFLOOR } from '../data/regions';
import { TOOLS } from '../data/tools';
import { UPGRADES, UPGRADE_MAP } from '../data/upgrades';
import { Game, GameEvent, SECTORS } from '../game/Game';
import { MAX_EXTRA_DRONES, Machine, botCount, centerX, centerY, hubRadius, isBelt, isHub, machineBufferCap, machineRadius, machineRate } from '../game/Machines';
import { drawTool, drawWorker } from '../render/character';
import { matIconURL } from '../render/matIcons';
import { drawBelt, drawMachine } from '../render/machinesDraw';
import { drawDiscovery } from '../render/specialsDraw';
import { ICONS } from './icons';
import { SkillTree } from './SkillTree';
import type { App } from '../main';

type Tab = 'contracts' | 'upgrades' | 'build' | 'tools' | 'inventory' | 'map' | 'stats' | 'settings';
const TABS: { id: Tab; name: string; short: string; icon: string }[] = [
  { id: 'contracts', name: 'Contratos da MÃE', short: 'Contratos', icon: ICONS.contracts },
  { id: 'build', name: 'Construir Máquinas', short: 'Construir', icon: ICONS.build },
  { id: 'tools', name: 'Oficina do BIP', short: 'Oficina', icon: ICONS.workshop },
  { id: 'upgrades', name: 'Árvore de Melhorias', short: 'Melhorias', icon: ICONS.upgrades },
  { id: 'inventory', name: 'Silos do Posto', short: 'Silos', icon: ICONS.inventory },
  { id: 'map', name: 'Mapa de Nébula-7', short: 'Mapa', icon: ICONS.map },
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
    const counter = h(`<div class="hud-counter pe"><div class="lbl">SUCATA RESTANTE</div><div class="num">1.000.000</div><div class="bar"><i></i></div><div class="sub"><span>removido <b class="rm">0</b></span><span><b class="pc">0%</b></span><span><b class="ps">0</b>/s</span><span class="desk-only"><b class="pm">0</b>/min</span><span>⚙ <b class="mc">0</b></span></div></div>`);
    r.appendChild(counter);
    this.el.counter = counter;
    const left = h(`<div class="hud-left">
      <div class="chip money pe">${ICONS.coin.replace('<svg', '<svg class="ico"')}<span class="mv">$0</span><span class="rate"></span></div>
      <div class="chip bag pe"><div class="row"><span>${ICONS.bag.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} Tanque</span><span class="bv">0/20</span></div><div class="bar"><i></i></div></div>
      <div class="chip evchip pe" style="display:none"></div>
      <div class="chip alert pe" style="display:none"></div>
      <div class="chip contract pe" style="display:none"><div class="row"><span class="ct">📦 Contrato</span><span class="cd"></span></div><div class="cr"></div><div class="bar"><i></i></div></div>
      <div class="chip yard pe" style="display:none" title="Pátio do posto: o que as máquinas entregam espera aqui para ser processado"><div class="row"><span>⚙ Pátio</span><span class="yv">0/250</span></div><div class="bar"><i></i></div></div>
    </div>`);
    r.appendChild(left);
    this.el.left = left;
    left.querySelector('.contract')!.addEventListener('click', () => this.openModal('contracts'));
    left.querySelector('.alert')!.addEventListener('click', () => this.goToAlert());
    left.querySelector('.evchip')!.addEventListener('click', () => { const ev = this.game.worldEvent; if (ev && ev.kind !== 'ion') this.app.peek(ev.x, ev.y); });
    this.pinLayer = h(`<div class="wpins"></div>`);
    r.appendChild(this.pinLayer);
    const right = h(`<div class="hud-right"></div>`);
    for (const t of TABS) {
      const b = h(`<button class="mbtn" data-tab="${t.id}" title="${t.name}">${t.icon}<span class="tip">${t.short}</span><span class="dot"></span></button>`);
      b.addEventListener('click', () => { this.app.audio.play('click'); this.openModal(t.id); });
      right.appendChild(b);
    }
    r.appendChild(right);
    this.el.right = right;
    this.el.goal = h(`<div class="goal"></div>`); r.appendChild(this.el.goal);
    this.el.hint = h(`<div class="hint desk-only"></div>`); r.appendChild(this.el.hint);
    this.el.msgs = h(`<div class="msgs"></div>`); r.appendChild(this.el.msgs);
    const mm = h(`<div class="minimap pe"><canvas width="150" height="150"></canvas></div>`);
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
      this.updateContractChip();
      this.updateAlertChips();
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
      const gd = g.guide();
      this.el.goal.textContent = this.app.build ? '' : gd?.text ?? '';
      this.el.right.querySelectorAll('.mbtn').forEach((b) => b.classList.toggle('guide', !!gd?.tab && (b as HTMLElement).dataset.tab === gd.tab));
      // notification dots
      const canUp = UPGRADES.some((u) => !g.canBuyUpgrade(u.id));
      const canTool = (g.toolTier + 1 < TOOLS.length && g.money >= g.toolCost(g.toolTier + 1)) || MODULES.some((m) => g.moduleState(m.id) === 'buy' && !g.missingFor({ money: m.money, mats: m.mats }));
      this.el.right.querySelector('[data-tab=contracts]')!.classList.toggle('has', this.newOffers || g.contracts.active.some((c) => g.contracts.canFinish(c, g.storage)));
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
      ib.textContent = ctx.kind === 'special' ? 'ABRIR' : ctx.kind === 'machine' ? 'VER' : ctx.kind === 'depot' ? 'VENDER' : 'INTERAGIR';
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
      case 'offers': this.newOffers = true; if (this.modalTab === 'contracts') this.renderModal(true); else this.message('Novas propostas de contrato chegaram. Toque em Contratos.', MAE); break;
      case 'sector': this.sectorBanner(e.name, e.money); break;
      case 'worldEvent': this.message(e.text, MAE); if (e.ev) this.eventBanner(e.ev.title, e.text); break;
      case 'contract': this.contractBanner(e.ok, e.title, e.money, e.blueprint); if (this.modalTab === 'contracts') this.renderModal(true); break;
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
  private spotLayer: HTMLElement | null = null;
  private ghostChip: HTMLElement | null = null;

  showBuildBar() {
    const b = this.app.build;
    const bar = this.el.buildbar;
    document.body.classList.toggle('building', !!b);
    this.spotLayer?.remove(); this.spotLayer = null; this.ghostChip = null;
    if (!b) { bar.style.display = 'none'; return; }
    const def = MACHINES[b.type];
    const cost = this.game.machineCost(b.type);
    const belt = isBelt(b.type);
    const touch = document.body.classList.contains('touch');
    bar.style.display = 'flex';
    bar.innerHTML = `<div class="bb-h"><img class="bb-ic" src="${this.machineThumb(b.type)}" alt=""/><div class="bb-t"><div class="name">${b.moving ? 'Movendo ' : ''}${def.short}${b.moving ? '' : ` <span class="bb-cost">${this.costHtml(cost)}</span>`}</div><div class="bb-msg"></div></div></div>
      <div class="bb-help">${belt ? (touch ? 'Arraste <b>a partir da esteira</b> para desenhar a linha · arraste o mapa para olhar' : 'Clique e arraste para desenhar a linha · R gira') : touch ? 'Arraste <b>a máquina</b> ou o mapa · ⭐ = bons lugares' : 'Clique para construir · os ⭐ são os melhores lugares'}</div>
      <div class="bb-a">
        <button class="btn ghost" data-a="cancel">✕${touch ? '' : ' Sair <span class="key">Esc</span>'}</button>
        ${belt ? `<button class="btn ghost" data-a="rot">↻ Girar${touch ? '' : ' <span class="key">R</span>'}</button>` : ''}
        ${touch ? `<button class="btn green" data-a="ok">${belt ? '✓ Colocar' : b.moving ? '✓ Colocar aqui' : '✓ Construir aqui'}</button>` : ''}
      </div>`;
    bar.querySelector('[data-a=cancel]')?.addEventListener('click', () => this.app.cancelBuild());
    bar.querySelectorAll('[data-a=rot]').forEach((x) => x.addEventListener('click', () => { this.app.rotateBuild(); this.refreshBuildBar(); }));
    bar.querySelector('[data-a=ok]')?.addEventListener('click', () => this.app.confirmBuild());
    // suggested spots + the chip that rides above the ghost
    const layer = h(`<div class="spots"></div>`);
    b.spots.forEach((sp, i) => {
      const pin = h(`<button class="spot-pin" data-i="${i}"><span class="st">⭐</span>${sp.garbage > 0 ? `<span class="g">${fmtShort(sp.garbage)}</span>` : ''}${sp.mat >= 0 ? `<img class="pm" src="${matIconURL(sp.mat)}" title="bom para o contrato: ${MATERIALS[sp.mat].name}"></i>` : ''}</button>`);
      pin.addEventListener('click', (e) => { e.stopPropagation(); this.app.jumpToSpot(i); });
      layer.appendChild(pin);
    });
    this.ghostChip = h(`<div class="ghost-chip"></div>`);
    layer.appendChild(this.ghostChip);
    this.el.layer.appendChild(layer);
    this.spotLayer = layer;
    this.refreshBuildBar();
    this.positionBuildOverlay();
  }

  /** Screen y where the build bar starts (edge scrolling stops above it). */
  buildBarTop() {
    const r = this.el.buildbar.getBoundingClientRect();
    return r.height > 0 ? r.top : window.innerHeight;
  }

  /** Keeps the spot pins and the ghost chip glued to the world (called every frame). */
  positionBuildOverlay() {
    const b = this.app.build, layer = this.spotLayer;
    if (!b || !layer) return;
    const r = this.app.renderer;
    const s = MACHINES[b.type].size;
    const pins = layer.querySelectorAll<HTMLElement>('.spot-pin');
    pins.forEach((pin, i) => {
      const sp = b.spots[i];
      const here = sp && sp.tx === b.tx && sp.ty === b.ty;
      const p = r.worldToScreen((sp.tx + s / 2) * TILE, sp.ty * TILE);
      pin.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      pin.classList.toggle('here', !!here);
    });
    if (this.ghostChip) {
      const p = r.worldToScreen((b.tx + s / 2) * TILE, b.ty * TILE);
      this.ghostChip.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - 6)}px)`;
    }
  }

  refreshBuildBar() {
    const b = this.app.build;
    if (!b) return;
    const g = this.game;
    const bar = this.el.buildbar;
    const def = MACHINES[b.type];
    const belt = isBelt(b.type);
    const msg = bar.querySelector('.bb-msg') as HTMLElement | null;
    let tip = '', chip = '', cls = 'good';
    if (b.problem) { tip = '⚠ ' + b.problem; cls = 'bad'; }
    else if (belt) { tip = 'Leva o material até o posto'; chip = '✓'; }
    else {
      const inService = g.inServiceArea(b.type, b.tx, b.ty);
      const reach = def.role === 'coleta' ? (b.reach > 0 ? `alcança ${fmtShort(b.reach)} de sucata${def.heavy ? '' : ' leve'}` : 'nenhuma sucata ao alcance') : '';
      if (def.role === 'coleta' && b.reach === 0) { cls = 'warn'; tip = '⚠ Nenhuma sucata ao alcance aqui'; chip = '0'; }
      else if (!inService && b.type !== 'recycler') { cls = 'warn'; tip = `${reach ? reach + ' · ' : ''}fora do posto: depois use 🔗 Conectar`; chip = reach ? fmtShort(b.reach) : '!'; }
      else { tip = `✓ ${reach ? reach + ' · ' : ''}entrega sozinha no posto`; chip = reach ? '✓ ' + fmtShort(b.reach) : '✓'; }
    }
    if (msg) { msg.textContent = tip; msg.className = 'bb-msg ' + cls; }
    // what this spot yields: material mix bar (helps with contracts)
    let mixEl = bar.querySelector('.bb-mix') as HTMLElement | null;
    const mix = def.role === 'coleta' && b.reach > 0 ? b.mix : null;
    if (!mixEl && msg) { mixEl = h(`<div class="bb-mix"></div>`); msg.after(mixEl); }
    if (mixEl) {
      const html = mix ? mix.map((f, k) => (f > 0.04 ? `<i style="flex:${f.toFixed(3)};background:${MATERIALS[k].color}" title="${MATERIALS[k].name}">${f > 0.16 ? MATERIALS[k].name.split(' ')[0] : ''}</i>` : '')).join('') : '';
      if (mixEl.innerHTML !== html) mixEl.innerHTML = html;
      mixEl.style.display = mix ? '' : 'none';
    }
    if (this.ghostChip) { this.ghostChip.textContent = chip; this.ghostChip.className = 'ghost-chip ' + cls; }
    const ok = bar.querySelector('[data-a=ok]') as HTMLElement | null;
    if (ok) ok.classList.toggle('disabled', !!b.problem);
  }

  private costHtml(cost: { money: number; mats: number[] }) {
    const g = this.game;
    let s = `<span class="cost ${g.money < cost.money ? 'no' : ''}">${fmtMoney(cost.money)}</span>`;
    for (let k = 0; k < MAT_COUNT; k++) if (cost.mats[k] > 0) s += `<span class="cost ${g.storage[k] < cost.mats[k] ? 'no' : ''}"><img class="mi" src="${matIconURL(k)}" alt=""/>${fmtShort(cost.mats[k])}</span>`;
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
      status = yardFull ? 'Pátio lotado! Máquinas esperando. Construa uma Prensa dentro do círculo.' : g.yardTotal > g.yardCap() * 0.7 ? 'Pátio quase cheio: um Triturador ajudaria.' : 'Processando normalmente.';
      cls = yardFull ? 'bad' : g.yardTotal > g.yardCap() * 0.7 ? 'warn' : 'ok';
    } else if (m.type === 'crusher') { status = m.status === 'working' ? 'Triturando a fila do pátio' : 'Pátio vazio, aguardando material'; cls = m.status === 'working' ? 'ok' : 'warn'; }
    else if (isBelt(m.type)) { status = m.linked ? 'Conectada a um posto ✓' : 'Não chega a um posto: siga até o posto'; cls = m.linked ? 'ok' : 'bad'; }
    else if (m.type === 'ancient') status = 'Entrega direta no posto (mistério)';
    else if (m.status === 'full' && m.inService && yardFull) { status = 'Parada: o pátio do posto está lotado. Construa uma Prensa.'; cls = 'bad'; }
    else if (m.status === 'full') { status = 'Caçamba cheia! Conecte ao posto ou esvazie.'; cls = 'bad'; }
    else if (m.status === 'idle' && m.type === 'collector') { status = m.idleT < 0 ? (m.outConveyor >= 0 ? 'Parado: zona esgotada, sem caminho ou faltam recursos para levar as esteiras junto.' : 'Zona esgotada. Use ↔ Mover para levar a outra área (a zona vai junto).') : m.outConveyor >= 0 ? 'Mudando de lugar e levando as esteiras junto…' : 'Andando até a próxima sucata da zona…'; cls = m.idleT < 0 ? 'warn' : 'ok'; }
    else if (m.status === 'idle' && m.type === 'robots') { status = 'Sem sucata leve no alcance. Use ↔ Mover.'; cls = 'warn'; }
    else if (m.status === 'idle') { status = (def.heavy ? 'Área limpa! ' : 'Só sobrou sucata pesada (ou nada) no alcance. ') + 'Use ↔ Mover para levá-la a uma área com lixo.'; cls = 'warn'; }
    else status = 'Trabalhando';
    let delivery = '';
    if (!isHub(m.type) && !isBelt(m.type) && m.type !== 'ancient') {
      delivery = m.type === 'robots' ? 'Drones levam direto ao posto ✓' : m.type === 'harvester' ? 'O rover leva direto ao posto ✓' : m.type === 'vortex' ? 'Teletransporta direto para os silos ✓' : m.inService ? 'Área de serviço do posto ✓' : m.outConveyor >= 0 ? (m.linked ? 'Esteira conectada ✓' : 'Esteira não chega ao posto ✗') : 'Sem entrega automática ✗';
    }
    const canUp = MACHINES[m.type].buildable && m.type !== 'conveyor' && m.level < MAX_MACHINE_LEVEL;
    const upCost = Math.ceil(machineUpgradeCost(m.type, m.level) * d.costMult);
    const near = Math.hypot(g.player.tx - centerX(m), g.player.ty - centerY(m)) < def.size / 2 + 2;
    const needsLink = def.buffer > 0 && m.type !== 'robots' && !m.inService && !(m.outConveyor >= 0 && m.linked);
    const plan = needsLink && g.isUnlocked('conveyor') ? this.cachedPlan(m) : null;
    const kv: string[] = [`<span>Função</span><span>${esc(def.func)}</span>`];
    if (isHub(m.type)) {
      kv.push(`<span>Pátio</span><span>${fmtInt(g.yardTotal)} / ${fmtInt(g.yardCap())}</span>`);
      kv.push(`<span>Vazão total</span><span>${fmtShort(g.processRate())}/s</span>`);
      kv.push(`<span>Área de serviço</span><span>${Math.round(hubRadius(m, d))} m</span>`);
    }
    if (m.type === 'crusher') kv.push(`<span>Processa</span><span>+${fmtShort(def.process * (1 + 0.5 * (m.level - 1)))}/s</span>`);
    if (def.rate > 0) kv.push(`<span>Ergue pesado</span><span>${def.heavy ? 'Sim ✓' : 'Não'}</span>`);
    if (def.rate > 0) kv.push(`<span>Velocidade</span><span>${fmtShort(machineRate(m, d) * (m.type === 'robots' || m.type === 'harvester' ? botCount(m, d) : 1))}/s</span>`);
    if (def.radius > 0 && !isHub(m.type)) kv.push(`<span>Alcance</span><span>${machineRadius(m, d).toFixed(1)} m</span>`);
    if (m.type === 'harvester') kv.push(`<span>Rovers</span><span>${botCount(m, d)} (mais 1 no nível 3 e no 5)</span>`);
    if (m.type === 'robots') kv.push(`<span>Drones</span><span>${botCount(m, d)}${m.extra ? ` (${m.extra} comprados)` : ''}</span>`);
    if (m.type === 'collector') kv.push(`<span>Zona</span><span>${g.roamRadius(m).toFixed(0)} m ao redor de onde foi construído</span>`);
    if (def.buffer > 0 && m.type !== 'robots') kv.push(`<span>Caçamba</span><span>${fmtInt(m.bufferTotal)} / ${fmtInt(machineBufferCap(m, d))}</span>`);
    if (m.collected > 0) kv.push(`<span>Total coletado</span><span>${fmtInt(m.collected)}</span>`);
    if (delivery) kv.push(`<span>Entrega</span><span>${delivery}</span>`);
    if (isBelt(m.type)) kv.push(`<span>Pacotes</span><span>${m.belt.length}</span>`);
    const head = `<b>${def.name}</b>${def.buildable && m.type !== 'conveyor' ? `<span class="lvl">Nv ${m.level}/${MAX_MACHINE_LEVEL}</span>` : ''}<button class="close" data-a="x" style="width:32px;height:32px">✕</button>`;
    const acts = `${needsLink ? (plan ? `<button class="btn ${g.missingFor(plan.cost) ? 'disabled' : ''} wide" data-a="link">🔗 Conectar ao posto · ${plan.tiles.length} esteiras · ${fmtMoney(plan.cost.money)}</button>` : `<div class="st bad wide">${g.isUnlocked('conveyor') ? 'Sem caminho limpo até o posto: limpe o lixo entre eles' : 'Para entregar de longe, desbloqueie Logística (esteiras)'}</div>`) : ''}
        ${canUp ? `<button class="btn ${g.money < upCost ? 'disabled' : 'green'}" data-a="up">Melhorar ${fmtMoney(upCost)}</button>` : ''}
        ${m.type === 'robots' ? (m.extra < MAX_EXTRA_DRONES ? `<button class="btn ${g.money < g.droneCost(m) ? 'disabled' : 'green'}" data-a="drone">+1 drone ${fmtMoney(g.droneCost(m))}</button>` : `<span class="st ok">Hangar lotado</span>`) : ''}
        ${m.bufferTotal > 0 ? `<button class="btn ${near ? '' : 'disabled'}" data-a="empty" title="Chegue perto">Esvaziar no tanque</button>` : ''}
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

  private planCache: { id: number; t: number; plan: ReturnType<Game['planConnection']> } | null = null;
  /** Belt route planning is costly: reuse it for a couple of seconds. */
  private cachedPlan(m: Machine) {
    const now = performance.now();
    const c = this.planCache;
    if (c && c.id === m.id && now - c.t < 2000) return c.plan;
    const plan = this.game.planConnection(m);
    this.planCache = { id: m.id, t: now, plan };
    return plan;
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
      case 'link': { this.planCache = null; const e = g.connectToDepot(m); if (e) { this.app.audio.play('error'); this.toastErr(e); } else this.message('Esteiras construídas! Os materiais agora vão sozinhos até o posto.', 'Sistema'); break; }
      case 'drone': { const e = g.buyDrone(m); if (e) { this.toastErr(e); } break; }
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
    const t = TABS.find((x) => x.id === tab) ?? { id: tab, name: 'Números', short: 'Números', icon: ICONS.stats };
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
      case 'contracts': this.renderContracts(body); break;
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
    // draw big, then crop to the drawn pixels so every thumbnail is centered and uncut
    const big = document.createElement('canvas');
    big.width = 420; big.height = 420;
    const c = big.getContext('2d', { willReadFrequently: true })!;
    const size = MACHINES[type].size;
    const sc = 3.2 / size;
    c.translate(210, 230);
    c.scale(sc, sc);
    c.translate(-(size * TILE) / 2, -(size * TILE) / 2);
    const fake: Machine = { id: 0, type, tx: 0, ty: 0, dir: 0, level: 1, buffer: [0, 0, 0, 0, 0, 0], bufferTotal: 0, work: 0, cursor: 0, collected: 0, belt: [{ mat: 0, units: 1, sorted: false, t: 0.5 }], bots: [], status: 'working', targets: null, targetsRadius: 0, anim: 0, lastTarget: -1, outConveyor: -1, inService: false, linked: true, deliverT: 0, built: 1, extra: 0, ox: 0, oy: 0, anchorX: 0, anchorY: 0, idleT: 0 };
    if (isBelt(type)) drawBelt(c, fake, this.game, 0.3);
    else drawMachine(c, fake, this.game, 0.3, this.app.fx, false);
    const px = c.getImageData(0, 0, 420, 420).data;
    let x0 = 420, y0 = 420, x1 = 0, y1 = 0;
    for (let y = 0; y < 420; y++) for (let x = 0; x < 420; x++) if (px[(y * 420 + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 160;
    if (x1 > x0) {
      const w = x1 - x0 + 1, hgt = y1 - y0 + 1, k = 148 / Math.max(w, hgt);
      cv.getContext('2d')!.drawImage(big, x0, y0, w, hgt, 80 - (w * k) / 2, 80 - (hgt * k) / 2, w * k, hgt * k);
    }
    url = cv.toDataURL();
    this.thumbs.set(type, url);
    return url;
  }

  private openBuildCard: MachineType | null = null;

  private renderBuild(body: HTMLElement) {
    const g = this.game;
    const yardPct = Math.min(100, (g.yardTotal / Math.max(1, g.yardCap())) * 100);
    let html = `<div class="bhead"><div class="flow"><span class="fs coleta">① Coletar</span><i>→</i><span class="fs logistica">② Levar</span><i>→</i><span class="fs processamento">③ Processar</span></div>
      <div class="yardbar"><span>Pátio do posto</span><b>${fmtInt(g.yardTotal)} / ${fmtInt(g.yardCap())}</b><span>· ${fmtShort(g.processRate())}/s</span><div class="yb"><i style="width:${yardPct}%"></i></div></div></div>`;
    const roles: MachineRole[] = ['coleta', 'logistica', 'processamento', 'deposito'];
    const roleShort: Record<MachineRole, string> = { coleta: 'Coleta', logistica: 'Logística', processamento: 'Processamento', deposito: 'Postos' };
    const roleSub: Record<MachineRole, string> = { coleta: 'tiram a sucata do chão', logistica: 'levam até o posto', processamento: 'o depósito dar conta', deposito: 'recebem tudo' };
    for (const role of roles) {
      const types = BUILD_ORDER.filter((t) => MACHINES[t].role === role);
      if (!types.length) continue;
      html += `<h3 class="mrole ${role}">${roleShort[role]} <small>${roleSub[role]}</small></h3><div class="mgrid">`;
      for (const t of types) {
        const def = MACHINES[t];
        const unl = g.isUnlocked(t);
        const cost = g.machineCost(t);
        const miss = g.missingFor(cost);
        const owned = g.machines.count(t);
        const open = this.openBuildCard === t;
        const stats: string[] = [];
        if (def.rate > 0) stats.push(`⚡ ${def.rate}/s${t === 'robots' ? ' cada' : ''}`);
        if (def.radius > 0 && def.role === 'coleta') stats.push(`◎ ${def.radius} m`);
        if (def.process > 0) stats.push(`⚙ +${def.process}/s`);
        if (def.yard > 0) stats.push(`▦ +${def.yard}`);
        const tag = def.role === 'coleta' && def.heavy ? '<span class="tag hv" title="ergue sucata pesada">🏋</span>' : '';
        const lockTxt = def.unlock ? UPGRADE_MAP[def.unlock].name : '';
        html += `<div class="mcard ${role} ${unl ? (miss ? 'short' : 'ready') : 'locked'} ${open ? 'open' : ''}" data-card="${t}">
          <div class="art"><img src="${this.machineThumb(t)}" alt=""/>${owned ? `<span class="cnt">×${owned}</span>` : ''}${tag}${unl ? '' : '<span class="lk">🔒</span>'}</div>
          <div class="nm">${def.short}<span class="more">${open ? '▴' : 'ⓘ'}</span></div>
          <div class="fn">${esc(def.func)}</div>
          ${open ? `<div class="ds">${esc(def.desc)}</div><div class="st">${stats.map((x) => `<span>${x}</span>`).join('')}<span>${def.size}×${def.size}</span>${def.buffer ? `<span>▣ ${def.buffer}</span>` : ''}</div>` : stats.length ? `<div class="st">${stats.slice(0, 2).map((x) => `<span>${x}</span>`).join('')}</div>` : ''}
          ${unl ? `<div class="buy"><div class="cst">${this.costHtml(cost)}</div><button class="btn ${miss ? 'disabled' : 'green'}" data-b="${t}">${miss ? 'Falta recurso' : owned ? 'Construir +1' : 'Construir'}</button></div>` : `<div class="lockline">Desbloqueie na árvore:<b>${esc(lockTxt)}</b></div>`}
        </div>`;
      }
      html += `</div>`;
    }
    if (!this.put(body, html)) return;
    body.querySelectorAll('[data-card]').forEach((c) => c.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-b]')) return;
      const t = (c as HTMLElement).dataset.card as MachineType;
      if (!g.isUnlocked(t) && !(e.target as HTMLElement).closest('.nm, .art')) { this.openModal('upgrades'); return; }
      this.openBuildCard = this.openBuildCard === t ? null : t;
      this.app.audio.play('click', 0.5);
      this.renderModal(true);
    }));
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
      // the robot's factory pincers
      c.rotate(0.6);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = '#2a1a10'; c.lineWidth = 1.2;
      c.fillStyle = '#9aa6b2';
      c.beginPath(); c.roundRect(-2.5, 4, 5, 9, 1.5); c.fill(); c.stroke();
      c.fillStyle = '#2bb5a8';
      c.beginPath(); c.arc(0, 4, 4.2, 0, 6.28); c.fill(); c.stroke();
      for (const sx of [-1, 1]) {
        c.beginPath(); c.moveTo(sx * 2.2, 1.5); c.quadraticCurveTo(sx * 7.5, -4, sx * 2.6, -10); c.lineTo(sx * 1.2, -8.5); c.quadraticCurveTo(sx * 4.5, -4, sx * 0.6, 0.5); c.closePath(); c.fill(); c.stroke();
      }
      c.fillStyle = '#e6f7f5'; c.beginPath(); c.arc(-1.2, 2.8, 1, 0, 6.28); c.fill();
    } else drawTool(c, tier, 0.5, 1, true);
    url = cv.toDataURL();
    this.thumbs.set(key, url);
    return url;
  }

  // ------------------------------------------------------------------ contracts
  private newOffers = false;

  private planetTime(sec: number) {
    sec = Math.max(0, sec);
    const d = Math.floor(sec / DAY), hh = Math.floor(((sec % DAY) / DAY) * 24);
    return d > 0 ? `${d}d ${hh}h` : `${hh}h`;
  }

  private updateContractChip() {
    const g = this.game;
    const chip = this.el.left.querySelector('.contract') as HTMLElement;
    const cb = g.contracts;
    const act = cb.active.slice().sort((a, b) => a.deadline - b.deadline);
    const c = act[0];
    chip.style.display = c ? '' : 'none';
    if (!c) return;
    const left = c.deadline - g.stats.playTime;
    chip.querySelector('.ct')!.textContent = `📦 ${act.length > 1 ? `${act.length} contratos` : 'Contrato'}`;
    chip.querySelector('.cd')!.textContent = '⏱ ' + this.planetTime(left);
    const parts: string[] = [];
    for (let k = 0; k < MAT_COUNT; k++) if (c.req[k] > 0) parts.push(`<span><img class="mi" src="${matIconURL(k)}" alt=""/>${fmtShort(Math.min(c.req[k], c.delivered[k] + g.storage[k]))}/${fmtShort(c.req[k])}</span>`);
    const html = parts.join('');
    const cr = chip.querySelector('.cr') as HTMLElement;
    if (cr.innerHTML !== html) cr.innerHTML = html;
    let have = 0, need = 0;
    for (let k = 0; k < MAT_COUNT; k++) { need += c.req[k]; have += Math.min(c.req[k], c.delivered[k] + g.storage[k]); }
    (chip.querySelector('.bar i') as HTMLElement).style.width = (need ? (100 * have) / need : 100) + '%';
    chip.classList.toggle('urgent', left < DAY / 2);
  }

  private contractBanner(ok: boolean, title: string, money: number, blueprint: string | null) {
    const b = h(`<div class="cbanner ${ok ? 'ok' : 'bad'}"><div class="k">${ok ? 'CONTRATO CUMPRIDO!' : 'CONTRATO VENCIDO'}</div><div class="t">${esc(title)}</div><div class="r">${money > 0 ? `<span>+${fmtMoney(money)}</span>` : ''}${blueprint ? `<span class="bp">📐 Planta: ${esc(MODULE_MAP[blueprint].name)}</span>` : ''}</div></div>`);
    this.root.appendChild(b);
    setTimeout(() => b.classList.add('out'), 3600);
    setTimeout(() => b.remove(), 4200);
  }

  private eventBanner(title: string, text: string) {
    const b = h(`<div class="cbanner event"><div class="k">${esc(title.toUpperCase())}!</div><div class="t">${esc(text)}</div></div>`);
    this.root.appendChild(b);
    setTimeout(() => b.classList.add('out'), 3400);
    setTimeout(() => b.remove(), 4000);
  }

  // ------------------------------------------------------------------ alerts + world pointers
  private pinLayer!: HTMLElement;
  private alertList: { text: string; x?: number; y?: number; machine?: number; tab?: Tab }[] = [];

  private computeAlerts() {
    const g = this.game;
    const out: typeof this.alertList = [];
    for (const c of g.contracts.active) {
      const left = c.deadline - g.stats.playTime;
      if (left < DAY / 2) out.push({ text: `Contrato vence em ${this.planetTime(left)}`, tab: 'contracts' });
    }
    if (g.yardSpace() <= 0) out.push({ text: 'Pátio do posto lotado: construa uma Prensa', x: centerX(g.depot) * TILE, y: centerY(g.depot) * TILE, tab: 'build' });
    for (const m of g.machines.machines) {
      if (isHub(m.type) || isBelt(m.type)) continue;
      const cx = centerX(m) * TILE, cy = centerY(m) * TILE;
      if (m.status === 'full' && !m.inService && !(m.outConveyor >= 0 && m.linked) && MACHINES[m.type].buffer > 0 && m.type !== 'robots') out.push({ text: `${MACHINES[m.type].short} cheio e sem entrega`, x: cx, y: cy, machine: m.id });
      else if (m.type === 'collector' && m.idleT < 0) out.push({ text: 'Coletor parado: zona esgotada', x: cx, y: cy, machine: m.id });
      if (out.length > 8) break;
    }
    this.alertList = out;
  }

  private updateAlertChips() {
    const g = this.game;
    this.computeAlerts();
    const a = this.el.left.querySelector('.alert') as HTMLElement;
    const first = this.alertList[0];
    a.style.display = first ? '' : 'none';
    if (first) {
      const html = `⚠ ${esc(first.text)}${this.alertList.length > 1 ? ` <small>+${this.alertList.length - 1}</small>` : ''} <b>Ir ›</b>`;
      if (a.innerHTML !== html) a.innerHTML = html;
    }
    const e = this.el.left.querySelector('.evchip') as HTMLElement;
    const ev = g.worldEvent;
    e.style.display = ev ? '' : 'none';
    if (ev) {
      const icon = ev.kind === 'meteor' ? '☄️' : ev.kind === 'ion' ? '⚡' : '📦';
      const html = `${icon} <span class="et">${esc(ev.title)}</span> <b>${Math.max(0, Math.ceil(ev.until - g.stats.playTime))}s${ev.kind !== 'ion' ? ' ›' : ''}</b>`;
      if (e.innerHTML !== html) e.innerHTML = html;
    }
  }

  private alertIdx = 0;
  private goToAlert() {
    if (!this.alertList.length) return;
    const a = this.alertList[this.alertIdx++ % this.alertList.length];
    if (a.machine !== undefined) { const m = this.game.machines.byId.get(a.machine); if (m) this.select(m); }
    if (a.x !== undefined && a.y !== undefined) this.app.peek(a.x, a.y);
    else if (a.tab) this.openModal(a.tab);
  }

  /** Arrows to the event and to the tutorial target; clamped to the screen edge when off-screen. */
  updatePointers() {
    const g = this.game;
    const r = this.app.renderer;
    const targets: { x: number; y: number; icon: string; label: string; cls: string }[] = [];
    const ev = g.worldEvent;
    if (ev && ev.kind !== 'ion') targets.push({ x: ev.x, y: ev.y, icon: ev.kind === 'meteor' ? '☄️' : '📦', label: `${Math.max(0, Math.ceil(ev.until - g.stats.playTime))}s`, cls: 'ev' });
    const gd = this.app.build || this.modalTab ? null : g.guide();
    if (gd && gd.x !== undefined && gd.y !== undefined) targets.push({ x: gd.x, y: gd.y, icon: '👇', label: '', cls: 'guide' });
    const layer = this.pinLayer;
    while (layer.children.length < targets.length) layer.appendChild(h(`<div class="wpin"><span class="ic"></span><span class="lb"></span><i class="ar"></i></div>`));
    while (layer.children.length > targets.length) layer.lastElementChild!.remove();
    const W = r.W, H = r.H, M = 44;
    targets.forEach((t, i) => {
      const el = layer.children[i] as HTMLElement;
      const p = r.worldToScreen(t.x, t.y);
      const top = 110, bot = H - 120;
      const inside = p.x > M && p.x < W - M && p.y > top && p.y < bot;
      let x = p.x, y = p.y, ang = 0;
      if (!inside) {
        const cx = W / 2, cy = H / 2, dx = p.x - cx, dy = p.y - cy;
        const k = Math.min((W / 2 - M) / Math.max(1, Math.abs(dx)), (dy < 0 ? cy - top : bot - cy) / Math.max(1, Math.abs(dy)));
        x = cx + dx * k; y = cy + dy * k;
        ang = Math.atan2(dy, dx);
      }
      el.className = `wpin ${t.cls} ${inside ? 'on' : 'edge'}`;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      (el.querySelector('.ic') as HTMLElement).textContent = t.icon;
      const dist = Math.round(Math.hypot(t.x - g.player.x, t.y - g.player.y) / TILE);
      (el.querySelector('.lb') as HTMLElement).textContent = inside ? t.label : `${t.label ? t.label + ' · ' : ''}${dist} m`;
      (el.querySelector('.ar') as HTMLElement).style.transform = `rotate(${ang}rad)`;
    });
  }

  private sectorBanner(name: string, money: number) {
    const b = h(`<div class="cbanner sector"><div class="k">SETOR RESTAURADO!</div><div class="t">${esc(name)} · os Glubs voltaram</div><div class="r"><span>+${fmtMoney(money)}</span></div></div>`);
    this.root.appendChild(b);
    setTimeout(() => b.classList.add('out'), 3000);
    setTimeout(() => b.remove(), 3600);
  }

  /** Compact requirement chips: icon, have/need and a thin progress bar each. */
  private reqRows(req: number[], delivered: number[] | null) {
    const g = this.game;
    let html = '<div class="rqs">';
    for (let k = 0; k < MAT_COUNT; k++) {
      if (req[k] <= 0) continue;
      const m = MATERIALS[k];
      const done = delivered ? delivered[k] : 0;
      const silo = Math.min(req[k] - done, Math.floor(g.storage[k]));
      const have = done + Math.max(0, silo);
      const pd = (100 * done) / req[k], ps = (100 * Math.max(0, silo)) / req[k];
      html += `<div class="rq ${have >= req[k] ? 'ok' : ''}" title="${m.name}"><img class="mi" src="${matIconURL(k)}" alt=""/><span class="q"><b>${fmtShort(have)}</b>/${fmtShort(req[k])}</span><div class="rb"><i class="d" style="width:${pd}%"></i><i class="s" style="width:${ps}%;left:${pd}%;background:${m.color}"></i></div></div>`;
    }
    return html + '</div>';
  }

  private renderContracts(body: HTMLElement) {
    const g = this.game;
    const cb = g.contracts;
    this.newOffers = false;
    const lvl = cb.level;
    const stars = '★'.repeat(Math.min(10, lvl)) + '☆'.repeat(Math.max(0, 10 - lvl));
    let html = `<div class="chead"><div class="rep"><span class="lv">Nível ${lvl}</span><span class="stars">${stars}</span><small>Reputação ${cb.rep} · ${cb.completed} entregues${cb.failed ? ` · ${cb.failed} vencidos` : ''}</small>${cb.streak > 0 ? `<span class="streak">🔥 Sequência ${cb.streak} · pagamentos ×${cb.streakMult.toFixed(1)}</span>` : ''}</div><div class="clock">🪐 Dia ${g.day} · ${String(Math.floor(g.hour)).padStart(2, '0')}h<small>1 dia = ${DAY / 60} min</small></div></div>`;
    if (!cb.started) html += `<p class="lead">A MÃE ainda não ligou. Colete um pouco de sucata enquanto isso.</p>`;
    const wk = cb.weekly;
    if (wk) {
      const done = wk.delivered >= wk.need;
      const left = (wk.week + 1) * DAY * 7 - g.stats.playTime;
      const can = !done && g.storage[wk.mat] >= 1;
      html += `<div class="weekly ${done ? 'done' : ''}"><div class="wk-h"><b>🏆 Meta da semana</b><span>${done ? 'Cumprida!' : `termina em ${this.planetTime(left)}`}</span></div>
        <div class="wk-b"><img class="mi big" src="${matIconURL(wk.mat)}" alt=""/><div class="wk-p"><div class="q"><b>${fmtInt(wk.delivered)}</b>/${fmtInt(wk.need)} ${MATERIALS[wk.mat].name}</div><div class="rb"><i style="width:${Math.min(100, (100 * wk.delivered) / wk.need)}%;background:${MATERIALS[wk.mat].color}"></i></div></div>
        <div class="wk-r">${wk.cores} 💠 + ${fmtMoney(wk.money)}</div>${can ? `<button class="btn green" data-weekly>Entregar ${fmtShort(Math.min(g.storage[wk.mat], wk.need - wk.delivered))}</button>` : ''}</div></div>`;
    }
    const act = cb.active;
    html += `<h3 class="mrole coleta">Em andamento <small>${act.length}/${cb.slots} vagas · entregue automaticamente quando os silos tiverem tudo</small></h3><div class="cgrid">`;
    if (!act.length && cb.started) html += `<div class="cempty">Nenhum contrato ativo. Aceite uma proposta abaixo.</div>`;
    for (const c of act) {
      const left = c.deadline - g.stats.playTime;
      const partial = c.req.some((n, k) => n > c.delivered[k] && g.storage[k] >= 1);
      html += `<div class="ccard active ${left < DAY / 2 ? 'urgent' : ''}"><div class="ch"><b>${esc(c.title)}</b><span class="tl">⏱ ${this.planetTime(left)}<small>≈ ${fmtTime(left)}</small></span></div>
        ${this.reqRows(c.req, c.delivered)}
        <div class="cf"><span class="rw">${fmtMoney(c.money)} · +${c.rep}★${c.blueprint ? ` · <b class="bp">📐 ${esc(MODULE_MAP[c.blueprint].name)}</b>` : ''}</span>${partial ? `<button class="btn ghost" data-deliver="${c.id}">Entregar parcial</button>` : ''}</div></div>`;
    }
    html += `</div>`;
    const offers = cb.offers;
    html += `<h3 class="mrole logistica">Propostas de hoje <small>${cb.completed < 1 ? 'chegam depois do contrato de boas-vindas' : 'renovam todo dia'}</small></h3><div class="cgrid">`;
    for (const c of offers) {
      const full = act.length >= cb.slots;
      html += `<div class="ccard offer ${c.blueprint ? 'hasbp' : ''} ${c.rush ? 'rush' : ''}"><div class="ch"><b>${esc(c.title)}</b><span class="tl">⏱ ${c.days} dia${c.days > 1 ? 's' : ''}<small>≈ ${fmtTime(c.days * DAY)}</small></span></div>
        ${this.reqRows(c.req, null)}
        <div class="cf"><span class="rw"><b>${fmtMoney(c.money)}</b> · +${c.rep}★${c.blueprint ? ` · <b class="bp">📐 Planta: ${esc(MODULE_MAP[c.blueprint].name)}</b>` : ''}</span><button class="btn ${full ? 'disabled' : 'green'}" data-accept="${c.id}">${full ? 'Sem vaga' : 'Aceitar'}</button></div></div>`;
    }
    if (!offers.length && cb.completed >= 1) html += `<div class="cempty">Sem propostas agora. Novas chegam no próximo dia.</div>`;
    html += `</div>`;
    if (!this.put(body, html)) return;
    body.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => {
      const e = g.acceptContract(Number((b as HTMLElement).dataset.accept));
      if (e) { this.flash(b); this.message(e, MAE); }
      this.renderModal(true);
    }));
    body.querySelector('[data-weekly]')?.addEventListener('click', () => { g.deliverWeekly(); this.renderModal(true); });
    body.querySelectorAll('[data-deliver]').forEach((b) => b.addEventListener('click', () => {
      g.deliverContract(Number((b as HTMLElement).dataset.deliver));
      this.renderModal(true);
    }));
  }

  // ------------------------------------------------------------------ workshop
  private robotPreview(): string {
    const g = this.game;
    const key = `bip:${g.toolTier}:${g.loadout.move}:${g.loadout.tank}:${g.loadout.sensor}:${g.upgrades.c_bag || 0}`;
    let url = this.thumbs.get(key);
    if (url) return url;
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 240;
    const c = cv.getContext('2d')!;
    c.translate(120, 150); c.scale(2.6, 2.6);
    drawWorker(c, 0, 0, 0.6, { facing: 'right', moving: false, walk: 0, action: 0, tier: g.toolTier, bagLvl: g.upgrades.c_bag || 0, fill: 0.5, crown: !!g.flags.crown, happy: true, loadout: g.loadout });
    url = cv.toDataURL();
    this.thumbs.set(key, url);
    return url;
  }

  private renderTools(body: HTMLElement) {
    const g = this.game;
    const d = g.d;
    let html = `<div class="wtop"><img class="bip" src="${this.robotPreview()}" alt=""/><div class="wstats"><div class="wt">BIP <small>robô modular</small></div>
      <div class="kvs"><span>Núcleos Raros</span><b>💠 ${g.cores}</b><span></span><b></b><span>Velocidade</span><b>${d.moveSpeed.toFixed(1)}</b><span>Na sucata</span><b>${Math.round((1 - d.garbageSlow) * 100)}%</b><span>Tanque</span><b>${fmtInt(d.capacity)}</b><span>Braço</span><b>${esc(g.tool.name)}</b></div>
      <p class="muted">Cada módulo muda o visual e o jeito de jogar. Plantas 📐 vêm de contratos; Núcleos 💠 vêm das metas da semana e deixam a peça Rara ★ e Lendária ★★ (locomoção: +7% velocidade, tanque: +12% carga, sensor: +6% valor por estrela).</p></div></div>`;
    for (const slot of ['move', 'tank', 'sensor'] as ModuleSlot[]) {
      html += `<h3 class="mrole processamento">${SLOT_NAMES[slot]}</h3><div class="wgrid">`;
      for (const m of MODULES.filter((x) => x.slot === slot)) {
        const st = g.moduleState(m.id);
        const miss = st === 'buy' ? g.missingFor({ money: m.money, mats: m.mats }) : null;
        const stars = g.moduleStars[m.id] || 0;
        const sc = g.starCost(m.id);
        const starUp = st === 'equipped' || st === 'owned' ? (stars < 2 ? `<button class="btn ghost star" data-star="${m.id}" title="${['Comum', 'Raro', 'Lendário'][stars + 1]}">★ Evoluir · ${sc.cores}💠 ${fmtMoney(sc.money)}</button>` : '<span class="rar">LENDÁRIO</span>') : '';
        html += `<div class="wcard ${st} r${stars}"><div class="wn">${esc(m.name)}<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(2 - stars)}</span>${st === 'equipped' ? '<span class="own cur">EM USO</span>' : ''}</div><div class="wd">${esc(m.desc)}</div>
          <div class="wf">${starUp}${st === 'equipped' ? '' : st === 'owned' ? `<button class="btn" data-eq="${m.id}">Equipar</button>` : st === 'locked' ? `<span class="lock">📐 Planta vem de contrato</span>` : `<span class="costs">${this.costHtml({ money: m.money, mats: m.mats })}</span><button class="btn ${miss ? 'disabled' : 'green'}" data-mod="${m.id}">Comprar</button>`}</div></div>`;
      }
      html += `</div>`;
    }
    html += `<h3 class="mrole coleta">Braço <small>as ferramentas de coleta, em ordem</small></h3><div class="grid">`;
    TOOLS.forEach((t, i) => {
      const owned = i <= g.toolTier;
      const next = i === g.toolTier + 1;
      if (i > g.toolTier + 2) return;
      const cost = g.toolCost(i);
      const stat = t.mode === 'single' ? `<span>${t.units} obj/ação</span><span>alcance ${t.reach} m</span>` : `<span>${t.rate}/s em área</span><span>raio ${t.radius} m</span>`;
      html += `<div class="card ${owned || next ? '' : 'locked'} ${i === g.toolTier ? 'current' : ''}"><div class="top"><img src="${this.toolThumb(i)}" alt="" style="background:radial-gradient(circle at 50% 40%, ${t.color}55, #2a1f15)"/><div class="info"><div class="t">${t.name}${i === g.toolTier ? ' <span class="own cur">EM USO</span>' : owned ? ' <span class="own">✓</span>' : ''}</div><div class="stats">${stat}</div></div></div>
        <div class="d">${esc(t.desc)}</div>
        ${next ? `<div class="foot"><div class="costs"><span class="cost ${g.money < cost ? 'no' : ''}">${fmtMoney(cost)}</span></div><button class="btn ${g.money < cost ? 'disabled' : 'green'}" data-t="${i}">Comprar</button></div>` : !owned ? `<div class="foot"><div class="lock">${fmtMoney(cost)} · compre o anterior primeiro</div></div>` : ''}
      </div>`;
    });
    html += `</div>`;
    if (!this.put(body, html)) return;
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      const e = g.buyTool(Number((b as HTMLElement).dataset.t));
      if (e) this.flash(b);
      this.renderModal(true);
    }));
    body.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
      const e = g.buyModule((b as HTMLElement).dataset.mod!);
      if (e) this.flash(b);
      this.renderModal(true);
    }));
    body.querySelectorAll('[data-star]').forEach((b) => b.addEventListener('click', () => {
      const e = g.upgradeModuleStar((b as HTMLElement).dataset.star!);
      if (e) { this.flash(b); this.toastErr(e); }
      this.renderModal(true);
    }));
    body.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => {
      g.equipModule((b as HTMLElement).dataset.eq!);
      this.renderModal(true);
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
      rows += `<div class="mat"><div class="mat-h"><img class="mi big" src="${matIconURL(k)}" alt=""/><div class="mat-n"><b>${m.name}</b><small>${fmtMoney(g.d.value[k])} por unidade</small></div><div class="mat-q"><b>${fmtInt(g.storage[k])}</b><small>${p.backpack[k] ? `+${fmtInt(p.backpack[k])} no tanque` : auto[k] > g.reserve[k] ? `guarda ${fmtShort(auto[k])} p/ máquinas` : 'no depósito'}</small></div></div>
        <div class="mat-a"><button class="toggle ${g.autoSell[k] ? 'on' : ''}" data-auto="${k}">${g.autoSell[k] ? '✓ Auto-venda' : '✗ Auto-venda'}</button>
        <button class="toggle" data-res="${k}" title="Quantidade guardada para construções">Guardar ${fmtShort(g.reserve[k])}</button>
        <button class="btn ${g.storage[k] > 0 ? '' : 'disabled'}" data-sell="${k}">Vender ${fmtMoney(val)}</button></div></div>`;
    }
    if (!this.put(body, `<p class="lead">A auto-venda vende o excedente, mas guarda sozinha o material que as máquinas desbloqueadas precisam. "Guardar" aumenta essa reserva.</p>
      <div class="inv-top"><button class="btn green" data-sellall>Vender tudo · ${fmtMoney(total)}</button><span class="muted"> Tanque do BIP ${fmtInt(p.carried)}/${fmtInt(g.d.capacity)}${p.carried > 0 ? ' · descarregue no posto' : ''}</span></div>
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
    const groundCol: Record<number, number[]> = { [G_EARTH]: [176, 160, 214], [G_CONCRETE]: [150, 170, 196], [G_ASPHALT]: [70, 72, 120], [G_GRAVEL]: [176, 160, 214], [G_RUINFLOOR]: [120, 176, 160] };
    for (let i = 0; i < N * N; i++) {
      const gv = w.garbage[i];
      let r: number, gg: number, b: number;
      if (w.occupant[i] >= 0) { r = 240; gg = 240; b = 240; }
      else if (gv > 0) {
        const t = Math.min(1, gv / 80);
        if (radar) { r = 80 + 175 * Math.min(1, t * 1.6); gg = 20 + 200 * Math.max(0, t - 0.45); b = 60 * (1 - t); }
        else { r = 92 + 40 * t; gg = 62 + 20 * t; b = 120 + 30 * t; }
      } else {
        const c = groundCol[w.ground[i]] ?? [176, 160, 214];
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
    body.innerHTML = `<h2>Mapa</h2><p class="lead">${g.d.radar ? 'Radar ativo: as cores mostram a densidade de sucata restante.' : 'Dica: o Radar de Sucata (árvore de melhorias) mostra a densidade com cores quentes.'} <button class="btn ghost" data-stats style="margin-left:6px">📊 Números</button></p>
      <div class="mapwrap"><canvas width="576" height="576"></canvas><div class="legend">
      <div><span class="sw" style="background:${g.d.radar ? '#ff3a2a' : '#7a4f8c'}"></span>Sucata ${g.d.radar ? '(quanto mais amarelo, mais denso)' : ''}</div>
      <div><span class="sw" style="background:#b0a0d6"></span>Terreno limpo</div>
      <div><span class="sw" style="background:#f0f0f0"></span>Máquinas</div>
      <div><span class="sw" style="background:#38bdf8"></span>Postos</div>
      <div><span class="sw" style="background:#ffd54f"></span>Descobertas</div>
      <div><span class="sw" style="background:#fff;border-radius:50%"></span>Você</div>
      <div style="margin-top:8px" class="muted">Limpo: <b style="color:var(--text)">${fmtPct((g.removed / TOTAL_GARBAGE) * 100)}</b></div>
      <div class="muted">Descobertas: <b style="color:var(--text)">${g.specials.filter((s) => s.revealed).length}/${g.specials.length}</b></div>
      </div></div>`;
    body.querySelector('[data-stats]')?.addEventListener('click', () => this.openModal('stats'));
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
    // restored sectors glow; the rest show how far along they are
    const sk = (WORLD_TILES / SECTORS) * k;
    c.lineWidth = 1;
    for (let q = 0; q < SECTORS * SECTORS; q++) {
      const sx = (q % SECTORS) * sk, sy = Math.floor(q / SECTORS) * sk;
      if (g.sectorsDone[q]) { c.fillStyle = 'rgba(94,234,212,0.16)'; c.fillRect(sx, sy, sk, sk); }
      c.strokeStyle = g.sectorsDone[q] ? 'rgba(94,234,212,0.55)' : 'rgba(255,255,255,0.07)';
      c.strokeRect(sx + 0.5, sy + 0.5, sk - 1, sk - 1);
    }
    // camera rect
    const v = g.view;
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5;
    c.strokeRect((v.x0 / TILE) * k, (v.y0 / TILE) * k, ((v.x1 - v.x0) / TILE) * k, ((v.y1 - v.y0) / TILE) * k);
    g.specials.forEach((s, i) => {
      // the radar sensor shows buried discoveries too
      if (!s.revealed && !g.d.findRadar) return;
      const sp = g.world.specials[i];
      c.fillStyle = s.opened ? '#ffd54f' : s.revealed ? '#fff59d' : '#c084fc';
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
      ['Sucata restante', fmtInt(g.remaining)], ['Removido', fmtInt(g.removed)], ['Conclusão', fmtPct((g.removed / TOTAL_GARBAGE) * 100)],
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
      <div class="setrow"><label>Gráficos <span class="muted">(Automático ajusta sozinho ao seu aparelho)</span></label><button class="toggle on" data-g>${({ auto: 'Automático', high: 'Alto', low: 'Leve' } as Record<string, string>)[st.gfx ?? 'auto']}</button></div>
      <div class="setrow"><label>Partículas</label><button class="toggle ${st.quality >= 1 ? 'on' : ''}" data-q>${st.quality >= 1 ? 'Alta' : 'Econômica'}</button></div>
      <div class="setrow"><label>Mostrar áreas de serviço dos postos</label><button class="toggle ${st.ranges ? 'on' : ''}" data-r>${st.ranges ? 'Sim' : 'Não'}</button></div>
      <div class="setrow"><label>Salvar agora <span class="muted">(o jogo salva sozinho a cada 15 s)</span></label><button class="btn ghost" data-save>Salvar</button></div>
      <div class="setrow"><label>Apagar todo o progresso</label><button class="btn red" data-reset>Reiniciar progresso</button></div>
      <p class="muted" style="margin-top:14px;font-size:13px">Garbage Kingdom — arte, animações, música e efeitos 100% gerados por código. Controles: WASD/setas para andar, segure o botão do mouse ou ESPAÇO para coletar, E para interagir, roda do mouse para zoom, B construir, U melhorias, T ferramentas, I depósito, M mapa, R girar esteira, Esc fechar.</p><p class="ver" data-ver>versão ${__BUILD__}</p>`;
    this.bindVersion(body);
    body.querySelectorAll('input[data-s]').forEach((i) => i.addEventListener('input', () => {
      const inp = i as HTMLInputElement;
      (st as unknown as Record<string, number>)[inp.dataset.s!] = Number(inp.value);
      this.app.applySettings();
    }));
    body.querySelector('[data-g]')!.addEventListener('click', () => { const order = ['auto', 'high', 'low'] as const; st.gfx = order[(order.indexOf(st.gfx ?? 'auto') + 1) % 3]; this.app.applySettings(); this.renderModal(true); });
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
        <p>${isNew ? 'Nébula-7, o lixão da galáxia: <b>1.000.000 de unidades de sucata</b> e um robozinho recém-montado. Limpe o planeta, cumpra os contratos da MÃE e traga os Glubs de volta.' : 'Bip-bop! O posto sentiu sua falta. A sucata também. Ela não foi a lugar nenhum.'}</p>
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
