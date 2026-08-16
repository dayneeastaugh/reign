/**
 * Letterpress sounds, synthesised rather than sampled — no assets to download,
 * nothing to cache, and it stays quiet and tactile: pressed ink, paper ticks, a
 * warm chord on completion. Everything is short and low-gain by design.
 *
 * The context is created lazily inside a user gesture, which is what iOS
 * requires, and WebAudio there is silenced by the hardware ring switch — so a
 * phone on silent stays silent.
 */
class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = false;
  private lastTick = 0;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.ensure();
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      const frames = Math.floor(this.ctx.sampleRate * 0.12);
      this.noise = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Filtered noise burst — the paper/ink half of a sound. */
  private burst(gain: number, cutoff: number, decay: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /** Sine tone with a soft envelope — the pitched half. */
  private tone(freq: number, gain: number, decay: number, delay = 0, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  /** A queen pressed into the paper. */
  queen(): void {
    if (!this.ensure()) return;
    this.burst(0.34, 1500, 0.09);
    this.tone(150, 0.2, 0.13);
  }

  /** A pencil tick for an × note; throttled so drags don't machine-gun. */
  mark(): void {
    if (!this.ensure()) return;
    const now = performance.now();
    if (now - this.lastTick < 45) return;
    this.lastTick = now;
    this.burst(0.16, 3800, 0.035);
  }

  /** Lifting a mark off the page. */
  lift(): void {
    if (!this.ensure()) return;
    this.burst(0.14, 2200, 0.05);
    this.tone(320, 0.09, 0.07);
  }

  /** Sweeping the board clear. */
  sweep(): void {
    if (!this.ensure()) return;
    this.burst(0.2, 2600, 0.16);
    this.tone(260, 0.08, 0.16);
  }

  /** A page consulted for a hint. */
  hint(): void {
    if (!this.ensure()) return;
    this.burst(0.16, 3000, 0.09);
    this.tone(560, 0.08, 0.1, 0.02);
  }

  /** Warm major triad, softly rolled — the completion flourish. */
  solved(): void {
    if (!this.ensure()) return;
    this.tone(523.25, 0.16, 0.5);
    this.tone(659.25, 0.14, 0.55, 0.08);
    this.tone(783.99, 0.13, 0.7, 0.16);
    this.burst(0.14, 1800, 0.12);
  }

  /** Brass fitting into place when a quest part is earned. */
  part(): void {
    if (!this.ensure()) return;
    this.tone(392, 0.14, 0.35, 0, 'triangle');
    this.tone(587.33, 0.12, 0.45, 0.09, 'triangle');
    this.tone(880, 0.09, 0.6, 0.18, 'triangle');
  }
}

export const sound = new Sound();
