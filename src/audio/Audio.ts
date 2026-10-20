import { SoundName } from '../game/fx';

type Ctx = AudioContext;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  sfxVol = 0.8;
  musicVol = 0.45;
  private musicOn = false;
  private nextBeat = 0;
  private beat = 0;
  private timer: number | null = null;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.reverb.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.28;
    this.reverb.connect(rg).connect(this.master);
    this.startMusic();
  }

  setSfx(v: number) { this.sfxVol = v; if (this.ctx) this.sfx.gain.value = v; }
  setMusic(v: number) { this.musicVol = v; if (this.ctx) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); }

  // ---------------------------------------------------------------- primitives
  private out(vol: number, pan: number, wet = 0): AudioNode {
    const ctx = this.ctx!;
    const g = ctx.createGain(); g.gain.value = vol;
    let node: AudioNode = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; p.connect(this.sfx); }
    else g.connect(this.sfx);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(this.reverb); }
    return g;
  }

  private tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, attack = 0.004) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noiseHit(dest: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1, freqEnd = freq) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd !== freq) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: SoundName, vol = 1, pan = 0) {
    const ctx = this.ctx;
    if (!ctx || this.sfxVol <= 0) return;
    const now = ctx.currentTime;
    const minGap: Partial<Record<SoundName, number>> = { pick: 0.035, pickMetal: 0.05, unload: 0.06, coin: 0.09, full: 0.5, drone: 0.3 };
    const lt = this.last.get(name) ?? -1;
    if (now - lt < (minGap[name] ?? 0.03)) return;
    this.last.set(name, now);
    const r = () => 0.9 + Math.random() * 0.2;
    const t = now + 0.005;
    switch (name) {
      case 'pick': {
        const o = this.out(0.5 * vol, pan);
        this.noiseHit(o, t, 0.06, 0.6, 'bandpass', 1500 * r(), 1.5);
        this.tone(o, 'sine', 180 * r(), 70, t, 0.08, 0.5);
        break;
      }
      case 'pickMetal': {
        const o = this.out(0.45 * vol, pan, 0.15);
        this.noiseHit(o, t, 0.05, 0.5, 'bandpass', 2200 * r(), 2);
        const f = 900 * r();
        this.tone(o, 'sine', f, f, t, 0.18, 0.18);
        this.tone(o, 'sine', f * 1.58, f * 1.58, t, 0.12, 0.1);
        this.tone(o, 'sine', 150, 60, t, 0.09, 0.45);
        break;
      }
      case 'pickGlass': case 'pickPaper': {
        const o = this.out(0.4 * vol, pan);
        this.noiseHit(o, t, 0.09, 0.5, 'highpass', 3000, 0.7);
        break;
      }
      case 'unload': {
        const o = this.out(0.35 * vol, pan);
        const f = 520 * r();
        this.tone(o, 'sine', f, f * 0.55, t, 0.09, 0.4);
        this.noiseHit(o, t, 0.04, 0.2, 'lowpass', 900);
        break;
      }
      case 'coin': {
        const o = this.out(0.22 * vol, pan, 0.2);
        this.tone(o, 'square', 988, 988, t, 0.07, 0.12);
        this.tone(o, 'square', 1319, 1319, t + 0.06, 0.16, 0.12);
        break;
      }
      case 'buy': case 'unlock': {
        const o = this.out(0.3 * vol, pan, 0.35);
        [72, 76, 79, 84].forEach((n, i) => this.tone(o, 'triangle', NOTE(n), NOTE(n), t + i * 0.065, 0.28, 0.35));
        this.tone(o, 'sine', NOTE(96), NOTE(96), t + 0.26, 0.4, 0.08);
        break;
      }
      case 'discover': case 'milestone': {
        const o = this.out(0.32 * vol, pan, 0.5);
        const seq = name === 'discover' ? [69, 73, 76, 81, 85, 88] : [67, 72, 76, 79];
        seq.forEach((n, i) => { this.tone(o, 'sine', NOTE(n), NOTE(n), t + i * 0.08, 0.7, 0.28, 0.01); this.tone(o, 'triangle', NOTE(n) * 1.005, NOTE(n) * 1.005, t + i * 0.08, 0.5, 0.1); });
        break;
      }
      case 'rare': {
        const o = this.out(0.25 * vol, pan, 0.5);
        [88, 91, 96, 100].forEach((n, i) => this.tone(o, 'sine', NOTE(n), NOTE(n), t + i * 0.05, 0.35, 0.2));
        break;
      }
      case 'build': {
        const o = this.out(0.55 * vol, pan, 0.2);
        this.noiseHit(o, t, 0.25, 0.8, 'lowpass', 400, 0.8, 120);
        this.tone(o, 'sine', 110, 45, t, 0.25, 0.7);
        this.tone(o, 'square', 600, 600, t + 0.08, 0.08, 0.06);
        this.tone(o, 'sine', 1400, 1400, t + 0.1, 0.25, 0.08);
        break;
      }
      case 'demolish': {
        const o = this.out(0.5 * vol, pan, 0.2);
        this.noiseHit(o, t, 0.5, 0.9, 'lowpass', 1800, 0.7, 150);
        this.tone(o, 'sawtooth', 120, 40, t, 0.4, 0.2);
        break;
      }
      case 'error': {
        const o = this.out(0.25 * vol, pan);
        this.tone(o, 'square', 155, 150, t, 0.1, 0.25);
        this.tone(o, 'square', 125, 120, t + 0.11, 0.14, 0.25);
        break;
      }
      case 'full': {
        const o = this.out(0.3 * vol, pan);
        this.tone(o, 'triangle', 520, 520, t, 0.12, 0.3);
        this.tone(o, 'triangle', 390, 380, t + 0.12, 0.2, 0.3);
        break;
      }
      case 'click': {
        const o = this.out(0.2 * vol, pan);
        this.tone(o, 'sine', 1200, 900, t, 0.04, 0.25);
        break;
      }
      case 'open': {
        const o = this.out(0.4 * vol, pan, 0.4);
        this.noiseHit(o, t, 0.4, 0.4, 'bandpass', 300, 6, 700);
        [76, 81, 88].forEach((n, i) => this.tone(o, 'sine', NOTE(n), NOTE(n), t + 0.25 + i * 0.07, 0.6, 0.22));
        break;
      }
      case 'drone': {
        const o = this.out(0.15 * vol, pan, 0.1);
        this.tone(o, 'sawtooth', 220, 330, t, 0.6, 0.15, 0.05);
        this.tone(o, 'sawtooth', 224, 334, t, 0.6, 0.1, 0.05);
        break;
      }
      case 'win': {
        const o = this.out(0.4 * vol, pan, 0.6);
        const seq = [60, 64, 67, 72, 67, 72, 76, 79, 84];
        seq.forEach((n, i) => { this.tone(o, 'triangle', NOTE(n), NOTE(n), t + i * 0.14, 0.9, 0.3, 0.01); this.tone(o, 'sine', NOTE(n - 12), NOTE(n - 12), t + i * 0.14, 0.9, 0.15); });
        break;
      }
    }
  }

  // ---------------------------------------------------------------- generative music
  private startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    this.nextBeat = this.ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  stopMusic() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.musicOn = false;
  }

  private schedule() {
    const ctx = this.ctx!;
    if (this.musicVol <= 0.001) { this.nextBeat = ctx.currentTime + 0.1; return; }
    const spb = 60 / 84 / 2; // eighth notes
    // Am7 - Fmaj7 - C - G (lo-fi, slightly melancholic)
    const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]];
    const bass = [45, 41, 48, 43];
    const scale = [69, 72, 74, 76, 79, 81, 84];
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const t = this.nextBeat;
      const step = this.beat % 16;
      const bar = Math.floor(this.beat / 16) % 4;
      const m = this.music;
      if (step === 0) {
        // pad chord
        for (const n of chords[bar]) {
          for (const det of [-6, 6]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
            const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16 + 0.2);
            o.connect(f).connect(g); g.connect(m);
            const w = ctx.createGain(); w.gain.value = 0.6; g.connect(w).connect(this.reverb);
            o.start(t); o.stop(t + spb * 16 + 0.3);
          }
        }
      }
      if (step === 0 || step === 6 || step === 10) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(bass[bar] - 12 + (step === 10 ? 7 : 0));
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 3);
        o.connect(g).connect(m); o.start(t); o.stop(t + spb * 3 + 0.05);
      }
      if (step % 8 === 0) { // soft kick
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(m); o.start(t); o.stop(t + 0.22);
      }
      if (step % 8 === 4) { // rim / snare
        const s = ctx.createBufferSource(); s.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        s.connect(f).connect(g).connect(m); s.start(t, Math.random()); s.stop(t + 0.13);
      }
      if (step % 2 === 1) { // hat
        const s = ctx.createBufferSource(); s.buffer = this.noise;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = ctx.createGain(); g.gain.setValueAtTime(step % 4 === 3 ? 0.035 : 0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        s.connect(f).connect(g).connect(m); s.start(t, Math.random()); s.stop(t + 0.05);
      }
      // marimba-like melody, sparse
      if ((step % 2 === 0) && Math.random() < 0.28) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = NOTE(n);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = NOTE(n) * 4;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.02, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g); o2.connect(g2); g.connect(m); g2.connect(m);
        const w = ctx.createGain(); w.gain.value = 0.8; g.connect(w).connect(this.reverb);
        o.start(t); o2.start(t); o.stop(t + 0.65); o2.stop(t + 0.1);
      }
      this.nextBeat += spb;
      this.beat++;
    }
  }
}
