// All of VICE HARBOR's sound is synthesised live with WebAudio — there
// is not one audio file in the game. A sawtooth engine hum follows the
// throttle, a two-tone siren swells with the nearest cruiser, a quiet
// synth pad hangs over the city, and every pickup, checkpoint, payout
// and crash is a small oscillator gesture.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.sirenFlip = 0;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    // engine voice
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // siren voice
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    // ambient pad: three detuned triangles breathing through one gain
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.032;
    this.padGain.connect(this.master);
    for (const f of [110, 164.81, 220]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      o.connect(this.padGain);
      o.start();
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  engine(ratio, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = Math.abs(ratio);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + r * 0.05 : 0, t, 0.09);
    this.engineOsc.frequency.setTargetAtTime(55 + r * 165, t, 0.07);
    this.engineFilter.frequency.setTargetAtTime(300 + r * 900, t, 0.1);
  }
  siren(level, tNow) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(level * 0.045, this.ctx.currentTime, 0.2);
    if (level > 0) {
      const flip = Math.floor(tNow * 1.6) % 2;
      if (flip !== this.sirenFlip) {
        this.sirenFlip = flip;
        this.sirenOsc.frequency.setValueAtTime(flip ? 880 : 660, this.ctx.currentTime);
      }
    }
  }
  tone(freq, dur = 0.12, type = 'sine', vol = 0.16, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  crashNoise() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.26);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(ctx.currentTime);
  }
  play(name) {
    if (!this.ctx || this.muted) return;
    if (name === 'pickup') {
      this.tone(660, 0.1, 'square', 0.1);
      this.tone(990, 0.14, 'square', 0.1, 0.08);
    } else if (name === 'checkpoint') {
      this.tone(784, 0.09, 'sine', 0.14);
      this.tone(1175, 0.13, 'sine', 0.12, 0.07);
    } else if (name === 'cash') {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.13, i * 0.07));
    } else if (name === 'complete') {
      [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.13, i * 0.1));
    } else if (name === 'fail') {
      this.tone(220, 0.3, 'sawtooth', 0.1);
      this.tone(174, 0.4, 'sawtooth', 0.1, 0.18);
    } else if (name === 'crash') {
      this.crashNoise();
    } else if (name === 'busted') {
      [660, 660, 660].forEach((f, i) => this.tone(f, 0.16, 'square', 0.1, i * 0.22));
    } else if (name === 'enter') {
      this.tone(330, 0.08, 'sine', 0.1);
      this.tone(392, 0.1, 'sine', 0.1, 0.06);
    }
  }
}
