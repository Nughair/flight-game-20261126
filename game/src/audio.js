// audio.js — every sound is synthesized with WebAudio; there are no audio
// files. A puttering engine whose pitch follows the throttle, wind that
// rises with speed, and small honest noises for the events of a flight:
// a chime for a gate, a thud for a heavy arrival, a splash for the sea.

export class SoundBox {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
  }

  // Browsers only let audio start after a gesture; main calls this then.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    this.ctx = ctx;

    // Engine: a low sawtooth through a muffler of a low-pass filter.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 42;
    const muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(muffler).connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();

    // Wind: looped noise through a band-pass, gain follows airspeed.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx);
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 640;
    band.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(band).connect(this.windGain).connect(ctx.destination);
    noise.start();
  }

  noiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Called every frame with the aeroplane's state.
  update(plane, dt) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const engineLevel = plane.crashed ? 0 : 0.015 + plane.throttle * 0.05 + (plane.onGround && plane.speedKt > 3 ? 0.012 : 0);
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.09);
    this.engineOsc.frequency.setTargetAtTime(38 + plane.throttle * 46 + plane.speedKt * 0.12, t, 0.09);
    const windLevel = plane.onGround || plane.crashed ? 0 : Math.min(0.085, (plane.speedKt / 118) * 0.085);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    if (muted) this.ctx.suspend();
    else this.ctx.resume();
  }

  tone(freq, dur, type = 'sine', gain = 0.08, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const start = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  thud(strength = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 160;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.22 * strength, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    src.connect(low).connect(amp).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + 0.3);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'ring':
        this.tone(880, 0.16, 'sine', 0.07);
        this.tone(1318, 0.24, 'sine', 0.06, 0.07);
        break;
      case 'drop':
        this.tone(520, 0.2, 'triangle', 0.06, 0, 240);
        break;
      case 'touch':
        this.thud(0.5);
        this.tone(196, 0.12, 'sine', 0.05);
        break;
      case 'thud':
        this.thud(1);
        break;
      case 'crash':
        this.thud(1.6);
        this.tone(90, 0.5, 'sawtooth', 0.1, 0, 40);
        break;
      case 'splash':
        this.thud(0.8);
        this.tone(300, 0.4, 'sine', 0.05, 0.05, 90);
        break;
      case 'win':
        this.tone(659, 0.14, 'sine', 0.06);
        this.tone(784, 0.14, 'sine', 0.06, 0.12);
        this.tone(1046, 0.3, 'sine', 0.07, 0.24);
        break;
      case 'out':
        this.tone(220, 0.5, 'sawtooth', 0.05, 0, 55);
        break;
      default:
        break;
    }
  }
}
