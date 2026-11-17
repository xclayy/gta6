// audio.js — every sound in Sunset Harbor is synthesized with WebAudio.
// No audio files, no network: engine hum, sirens, gunfire, pickups and two
// generative radio stations are all oscillators and filtered noise.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.radioStation = 0; // 0 off, 1 Sunset FM, 2 Harbor Bass
    this.radioStep = 0;
    this.radioNext = 0;
    this.radioGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.16;
      this.radioGain.connect(this.master);
      return true;
    } catch {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // --- one-shot effects -------------------------------------------------
  blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq = 1200, type = 'lowpass') {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  gunshot(kind = 'pistol') {
    if (kind === 'shotgun') this.noiseBurst(0.28, 0.5, 700);
    else if (kind === 'rifle') this.noiseBurst(0.18, 0.4, 1600);
    else if (kind === 'smg') this.noiseBurst(0.09, 0.3, 2000);
    else this.noiseBurst(0.14, 0.35, 1200);
    this.blip(160, 0.08, 'square', 0.12, 60);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.2);
    setTimeout(() => this.blip(880, 0.09, 'sine', 0.2), 70);
    setTimeout(() => this.blip(1320, 0.14, 'sine', 0.18), 140);
  }

  coin() {
    this.blip(988, 0.07, 'triangle', 0.2);
    setTimeout(() => this.blip(1319, 0.12, 'triangle', 0.2), 60);
  }

  crash() {
    this.noiseBurst(0.3, 0.5, 500);
    this.blip(90, 0.25, 'sawtooth', 0.25, 40);
  }

  explosion() {
    this.noiseBurst(0.8, 0.7, 300);
    this.blip(70, 0.7, 'sine', 0.5, 28);
  }

  phoneRing() {
    this.blip(1200, 0.12, 'sine', 0.15);
    setTimeout(() => this.blip(1200, 0.12, 'sine', 0.15), 180);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.18, 'triangle', 0.22), i * 110));
  }

  missionFail() {
    this.blip(220, 0.3, 'sawtooth', 0.2, 110);
  }

  // --- continuous: engine + siren ---------------------------------------
  setEngine(speed01, on) {
    if (!this.ensure() || this.muted) return;
    if (!on) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, t, 0.1);
  }

  setSiren(on, dt) {
    if (!this.ensure() || this.muted) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    }
    this.sirenTimer += dt;
    const hi = Math.floor(this.sirenTimer * 1.6) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
  }

  // --- generative radio ---------------------------------------------------
  setRadio(station) {
    this.radioStation = station;
    this.radioStep = 0;
    this.radioNext = this.ctx ? this.ctx.currentTime + 0.1 : 0;
  }

  radioName() {
    return this.radioStation === 1 ? 'SUNSET FM 88.4' : this.radioStation === 2 ? 'HARBOR BASS 101.7' : 'RADIO OFF';
  }

  updateRadio() {
    if (!this.ctx || this.muted || this.radioStation === 0) return;
    const now = this.ctx.currentTime;
    while (this.radioNext < now + 0.25) {
      const step = this.radioStep % 32;
      const t = Math.max(now, this.radioNext);
      if (this.radioStation === 1) this._sunsetStep(step, t);
      else this._bassStep(step, t);
      this.radioStep++;
      this.radioNext += 0.21;
    }
  }

  _note(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.radioGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _sunsetStep(step, t) {
    // Dreamy Cmaj7 / Am7 / Fmaj7 / G loop, one chord per bar of 8 steps.
    const chords = [
      [130.81, 164.81, 196.0, 246.94],
      [110.0, 130.81, 164.81, 196.0],
      [87.31, 130.81, 174.61, 220.0],
      [98.0, 146.83, 196.0, 246.94],
    ];
    const chord = chords[Math.floor(step / 8) % 4];
    if (step % 8 === 0) chord.forEach((f) => this._note(f, t, 1.5, 'sine', 0.09));
    const melody = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];
    if (step % 2 === 0) this._note(melody[(step * 3 + 1) % 8], t, 0.35, 'triangle', 0.07);
    if (step % 4 === 2) this._note(chord[0] * 2, t, 0.2, 'sine', 0.05);
  }

  _bassStep(step, t) {
    // Synthwave: driving 8th-note bass on A minor, hats on off-beats.
    const bass = [55, 55, 65.41, 55, 82.41, 55, 73.42, 49];
    this._note(bass[step % 8], t, 0.18, 'sawtooth', 0.11);
    if (step % 8 === 0) this._note(220, t, 1.4, 'sawtooth', 0.04);
    if (step % 8 === 4) this._note(261.63, t, 1.2, 'sawtooth', 0.04);
    if (step % 2 === 1) this._note(6000, t, 0.03, 'square', 0.015);
    if (step % 16 === 8) this._note(440, t, 0.3, 'square', 0.05);
  }
}
