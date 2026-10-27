// Procedural beach ambience (waves, wind, the odd seagull) with the Web Audio
// API: no audio files, no network. The context is fully suspended whenever
// the beach should be silent, so Realistic Mode is guaranteed to be mute.

export class BeachAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.playing = false;
    this.muted = false;
    this.nextGull = 0;
    this.wavePhase = 0;
  }

  // Must be called from a user gesture the first time.
  _init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const brown = this._noiseBuffer('brown');
    const white = this._noiseBuffer('white');

    // Rumbling body of the waves.
    const waveSrc = this._loop(brown);
    this.waveFilter = ctx.createBiquadFilter();
    this.waveFilter.type = 'lowpass';
    this.waveFilter.frequency.value = 500;
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0;
    waveSrc.connect(this.waveFilter).connect(this.waveGain).connect(this.master);

    // Fizz of foam as the wave breaks and washes up.
    const foamSrc = this._loop(white);
    const foamFilter = ctx.createBiquadFilter();
    foamFilter.type = 'highpass';
    foamFilter.frequency.value = 2500;
    this.foamGain = ctx.createGain();
    this.foamGain.gain.value = 0;
    foamSrc.connect(foamFilter).connect(this.foamGain).connect(this.master);

    // Soft wind.
    const windSrc = this._loop(white);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.03;
    windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);
  }

  _noiseBuffer(kind) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  _loop(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0, Math.random() * buffer.duration);
    return src;
  }

  /** Start the ambience (Arcade Mode only). */
  play() {
    this._init();
    if (!this.ctx) return;
    this.playing = true;
    this.ctx.resume();
    this._applyVolume();
  }

  /** Total silence: suspend the whole audio graph. */
  silence() {
    this.playing = false;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.value = 0;
    this.ctx.suspend();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.playing) this._applyVolume();
  }

  _applyVolume() {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.9, t + 0.8);
  }

  /** Called every frame while playing; drives the wave rhythm. */
  update(dt) {
    if (!this.playing || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    // One wave roughly every 7.5 seconds: slow build, crash, long wash.
    this.wavePhase = (this.wavePhase + dt / 7.5) % 1;
    const p = this.wavePhase;
    const crash = p < 0.35 ? Math.pow(p / 0.35, 2) : Math.exp(-(p - 0.35) * 4.2);
    const wash = p < 0.4 ? 0 : Math.sin(((p - 0.4) / 0.6) * Math.PI) * 0.6;

    this.waveGain.gain.setTargetAtTime(0.12 + crash * 0.55, t, 0.08);
    this.waveFilter.frequency.setTargetAtTime(350 + crash * 1100, t, 0.1);
    this.foamGain.gain.setTargetAtTime(0.004 + crash * 0.03 + wash * 0.035, t, 0.1);

    const gust = 0.025 + 0.02 * Math.sin(t * 0.21) * Math.sin(t * 0.37 + 1);
    this.windGain.gain.setTargetAtTime(gust, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(600 + 200 * Math.sin(t * 0.13), t, 0.5);

    if (t > this.nextGull) {
      if (this.nextGull > 0) this._gull();
      this.nextGull = t + 14 + Math.random() * 26;
    }
  }

  _gull() {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const calls = 2 + Math.floor(Math.random() * 3);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain();
    out.gain.value = 0.035;
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8;
      out.connect(pan).connect(this.master);
    } else {
      out.connect(this.master);
    }
    for (let i = 0; i < calls; i++) {
      const s = t0 + i * 0.32;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 3;
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(1500, s);
      osc.frequency.exponentialRampToValueAtTime(2100, s + 0.06);
      osc.frequency.exponentialRampToValueAtTime(1100, s + 0.24);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(1, s + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.26);
      osc.connect(f).connect(g).connect(out);
      osc.start(s);
      osc.stop(s + 0.3);
    }
  }
}
