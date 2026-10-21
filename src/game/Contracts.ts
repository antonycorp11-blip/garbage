import { MATERIALS, MAT_COUNT, M_RARE, emptyMats } from '../data/materials';
import { MODULE_MAP } from '../data/modules';

/** One planet day in seconds of play. */
export const DAY = 180;
/** reputation needed for each contract level */
export const REP_LEVELS = [0, 3, 7, 12, 18, 25, 33, 42, 52, 63, 75];
/** blueprints handed out by contracts, in order */
export const BLUEPRINT_ORDER = ['legs', 'scanner', 'hover', 'quantum'];
/** contracts completed before each blueprint is offered */
const BLUEPRINT_AT = [2, 5, 9, 13];

export type ContractState = 'offer' | 'active';

export interface Contract {
  id: number;
  title: string;
  /** units required per material */
  req: number[];
  delivered: number[];
  days: number;
  /** play time when it expires (active) */
  deadline: number;
  money: number;
  rep: number;
  blueprint: string | null;
  state: ContractState;
  /** urgent: half the time, double pay */
  rush?: boolean;
}

export interface Weekly { week: number; mat: number; need: number; delivered: number; cores: number; money: number }

export interface ContractHost {
  readonly playTime: number;
  readonly ratePerSec: number;
  readonly value: number[];
  readonly blueprints: string[];
}

const TITLES = [
  ['Pedido urgente da Fábrica', 'Encomenda da Diretoria', 'Reposição de estoque', 'Cota semanal', 'Lote experimental', 'Projeto secreto (não pergunte)'],
  ['para o casco da nave-mãe', 'para os robôs de limpeza', 'para a festa da firma', 'para um satélite novo', 'para o museu de sucata', 'para a coleção da MÃE'],
];

const round5 = (n: number) => (n < 20 ? Math.max(1, Math.round(n)) : Math.round(n / 5) * 5);

export class ContractBoard {
  list: Contract[] = [];
  rep = 0;
  completed = 0;
  failed = 0;
  nextId = 1;
  /** day the offers were last refreshed */
  offerDay = -1;
  /** the tutorial contract has been handed out */
  started = false;
  /** contracts delivered in a row without a failure */
  streak = 0;
  weekly: Weekly | null = null;

  /** payout multiplier from the current streak */
  get streakMult() { return 1 + Math.min(0.5, 0.1 * this.streak); }

  get level() {
    let l = 0;
    while (l + 1 < REP_LEVELS.length && this.rep >= REP_LEVELS[l + 1]) l++;
    return l;
  }
  get slots() { return 1 + (this.level >= 2 ? 1 : 0) + (this.level >= 5 ? 1 : 0); }
  get active() { return this.list.filter((c) => c.state === 'active'); }
  get offers() { return this.list.filter((c) => c.state === 'offer'); }

  /** Units still missing per material over all active contracts (kept from auto-sell). */
  needs(): number[] {
    const r = emptyMats();
    for (const c of this.active) for (let k = 0; k < MAT_COUNT; k++) r[k] += Math.max(0, c.req[k] - c.delivered[k]);
    return r;
  }

  tutorial(h: ContractHost): Contract {
    const c = this.make(h, { req: [0, 25, 0, 0, 0, 0], days: 3, title: 'Contrato de boas-vindas' });
    c.money = 150;
    c.state = 'active';
    c.deadline = h.playTime + c.days * DAY;
    this.list.push(c);
    this.started = true;
    return c;
  }

  /** New offers at the start of each planet day. */
  refreshOffers(h: ContractHost) {
    const day = Math.floor(h.playTime / DAY);
    if (day === this.offerDay) return false;
    this.offerDay = day;
    this.list = this.list.filter((c) => c.state === 'active');
    const n = 3;
    // a blueprint rides on one of the offers when its time has come
    const bpIdx = BLUEPRINT_AT.findIndex((at, i) => this.completed >= at && !h.blueprints.includes(BLUEPRINT_ORDER[i]));
    for (let i = 0; i < n; i++) {
      const c = this.generate(h, i);
      if (i === 0 && bpIdx >= 0) { c.blueprint = BLUEPRINT_ORDER[bpIdx]; c.days += 1; c.money = Math.round(c.money * 0.8); }
      // one risky offer a day: half the time, double the pay
      if (i === 1 && this.level >= 1) { c.rush = true; c.days = Math.max(0.5, c.days / 2); c.money *= 2; c.rep += 1; c.title = 'URGENTE: ' + c.title; }
      this.list.push(c);
    }
    return true;
  }

  private make(h: ContractHost, o: { req: number[]; days: number; title: string }): Contract {
    const worth = o.req.reduce((a, n, k) => a + n * h.value[k], 0);
    const lvl = this.level;
    return {
      id: this.nextId++, title: o.title, req: o.req, delivered: emptyMats(), days: o.days, deadline: 0,
      money: Math.round(worth * (2.2 + 0.12 * lvl) + 40 * (1 + lvl)), rep: o.days >= 3 ? 2 : 1, blueprint: null, state: 'offer',
    };
  }

  /** A contract sized to what the player currently produces. */
  generate(h: ContractHost, variant: number): Contract {
    const lvl = this.level;
    // 0: quick and small, 1: medium, 2: big and long
    const days = [1, 2, 3][variant % 3] + (lvl >= 4 && variant === 2 ? 1 : 0);
    const rate = Math.max(3, h.ratePerSec);
    const kinds = Math.min(4, 1 + (variant === 2 ? 1 : 0) + (lvl >= 3 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0));
    const pool = [0, 1, 2, 3, 4];
    const mats: number[] = [];
    while (mats.length < kinds) mats.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const hard = 0.32 + 0.025 * Math.min(lvl, 10) + variant * 0.03;
    const total = rate * days * DAY * hard;
    const req = emptyMats();
    for (const k of mats) req[k] = round5(Math.max(10, (total * 0.22) / kinds * (0.8 + Math.random() * 0.5)));
    if (lvl >= 3 && Math.random() < 0.35) req[M_RARE] = 1 + Math.floor(Math.random() * Math.min(4, lvl - 1));
    const title = `${TITLES[0][Math.floor(Math.random() * TITLES[0].length)]} ${TITLES[1][Math.floor(Math.random() * TITLES[1].length)]}`;
    return this.make(h, { req, days, title });
  }

  accept(id: number, h: ContractHost): string | null {
    const c = this.list.find((x) => x.id === id);
    if (!c || c.state !== 'offer') return 'Contrato indisponível';
    if (this.active.length >= this.slots) return `Você só pode ter ${this.slots} contrato${this.slots > 1 ? 's' : ''} ativo${this.slots > 1 ? 's' : ''}`;
    c.state = 'active';
    c.deadline = h.playTime + c.days * DAY;
    return null;
  }

  /** Moves what storage has into the contract. Returns units moved. */
  deliver(c: Contract, storage: number[]): number {
    let moved = 0;
    for (let k = 0; k < MAT_COUNT; k++) {
      const take = Math.min(Math.floor(storage[k]), c.req[k] - c.delivered[k]);
      if (take <= 0) continue;
      storage[k] -= take;
      c.delivered[k] += take;
      moved += take;
    }
    return moved;
  }

  isDone(c: Contract) { return c.req.every((n, k) => c.delivered[k] >= n); }
  canFinish(c: Contract, storage: number[]) { return c.req.every((n, k) => c.delivered[k] + Math.floor(storage[k]) >= n); }
  progress(c: Contract) {
    const need = c.req.reduce((a, b) => a + b, 0);
    return need ? c.req.reduce((a, n, k) => a + Math.min(n, c.delivered[k]), 0) / need : 1;
  }

  remove(c: Contract) { this.list = this.list.filter((x) => x !== c); }

  /** A big goal every planet week: one material, paid in Rare Cores. */
  refreshWeekly(h: ContractHost) {
    const week = Math.floor(h.playTime / (DAY * 7));
    if (this.weekly && this.weekly.week === week) return false;
    const mat = Math.floor(Math.random() * 5);
    const need = round5(Math.max(300, Math.max(3, h.ratePerSec) * DAY * 7 * 0.06 * (1 + 0.1 * this.level)));
    this.weekly = { week, mat, need, delivered: 0, cores: 1 + Math.floor(this.level / 3), money: Math.round(need * h.value[mat] * 3) };
    return true;
  }

  serialize() {
    return { list: this.list.map((c) => ({ ...c, req: c.req.slice(), delivered: c.delivered.slice() })), rep: this.rep, completed: this.completed, failed: this.failed, nextId: this.nextId, offerDay: this.offerDay, started: this.started, streak: this.streak, weekly: this.weekly ? { ...this.weekly } : null };
  }

  load(raw: unknown) {
    const s = raw as ReturnType<ContractBoard['serialize']> | undefined;
    if (!s || typeof s !== 'object') return;
    const n = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
    const arr = (v: unknown) => Array.from({ length: MAT_COUNT }, (_, i) => Math.max(0, n(Array.isArray(v) ? v[i] : 0)));
    this.list = (Array.isArray(s.list) ? s.list : []).filter((c) => c && (c.state === 'offer' || c.state === 'active')).map((c) => ({
      id: n(c.id), title: String(c.title || 'Contrato'), req: arr(c.req), delivered: arr(c.delivered), days: n(c.days, 1), deadline: n(c.deadline),
      money: n(c.money), rep: n(c.rep, 1), blueprint: typeof c.blueprint === 'string' && MODULE_MAP[c.blueprint] ? c.blueprint : null, state: c.state, rush: !!c.rush,
    }));
    this.streak = n(s.streak);
    const wk = s.weekly as Weekly | null | undefined;
    this.weekly = wk && typeof wk === 'object' ? { week: n(wk.week), mat: Math.max(0, Math.min(4, n(wk.mat))), need: n(wk.need, 300), delivered: n(wk.delivered), cores: n(wk.cores, 1), money: n(wk.money) } : null;
    this.rep = n(s.rep); this.completed = n(s.completed); this.failed = n(s.failed);
    this.nextId = Math.max(n(s.nextId, 1), ...this.list.map((c) => c.id + 1));
    this.offerDay = n(s.offerDay, -1);
    this.started = !!s.started;
  }
}

export function reqText(req: number[]): string {
  return req.map((n, k) => (n > 0 ? `${n} ${MATERIALS[k].name}` : '')).filter(Boolean).join(' + ');
}
