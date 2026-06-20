/**
 * EngineAudio — procedural airplane engine + propeller sound using Web Audio API.
 * Pitch and volume scale with throttle and speed for immersive flight audio.
 */
export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.masterGain = null;

    // Oscillator nodes
    this.engineOsc = null;   // Low engine rumble
    this.propOsc = null;     // Propeller whir
    this.windNoise = null;   // Wind noise at speed

    // Gains
    this.engineGain = null;
    this.propGain = null;
    this.windGain = null;

    // Start on first user interaction (browsers require user gesture)
    const startOnClick = () => {
      if (!this.started) this._init();
      document.removeEventListener('click', startOnClick);
      document.removeEventListener('keydown', startOnClick);
    };
    document.addEventListener('click', startOnClick);
    document.addEventListener('keydown', startOnClick);
  }

  _init() {
    this.started = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);

    // ── 1. Engine rumble (low frequency sawtooth) ──
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    // Low-pass filter for warm rumble
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 200;
    engineFilter.Q.value = 2;

    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    // ── 2. Propeller whir (triangle wave, higher pitch) ──
    this.propOsc = this.ctx.createOscillator();
    this.propOsc.type = 'triangle';
    this.propOsc.frequency.value = 120;

    this.propGain = this.ctx.createGain();
    this.propGain.gain.value = 0;

    // Band-pass for propeller character
    const propFilter = this.ctx.createBiquadFilter();
    propFilter.type = 'bandpass';
    propFilter.frequency.value = 300;
    propFilter.Q.value = 1.5;

    this.propOsc.connect(propFilter);
    propFilter.connect(this.propGain);
    this.propGain.connect(this.masterGain);
    this.propOsc.start();

    // ── 3. Wind noise (white noise through bandpass, volume scales with speed) ──
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.windNoise = this.ctx.createBufferSource();
    this.windNoise.buffer = noiseBuffer;
    this.windNoise.loop = true;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.5;

    this.windNoise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windNoise.start();
  }

  /**
   * Call every frame with current flight data.
   * @param {number} throttle  0..1
   * @param {number} speed     m/s
   * @param {boolean} parked
   */
  update(throttle, speed, parked) {
    if (!this.started || !this.ctx) return;

    const t = this.ctx.currentTime;
    const smoothing = 0.08; // seconds for parameter transitions

    if (parked) {
      // Silence when parked
      this.engineGain.gain.setTargetAtTime(0, t, smoothing);
      this.propGain.gain.setTargetAtTime(0, t, smoothing);
      this.windGain.gain.setTargetAtTime(0, t, smoothing);
      return;
    }

    // ── Engine: pitch 45-90 Hz based on throttle, volume 0.15-0.5 ──
    const engineFreq = 45 + throttle * 45;
    const engineVol = 0.15 + throttle * 0.35;
    this.engineOsc.frequency.setTargetAtTime(engineFreq, t, smoothing);
    this.engineGain.gain.setTargetAtTime(engineVol, t, smoothing);

    // ── Propeller: pitch 80-220 Hz based on throttle, volume 0.1-0.35 ──
    const propFreq = 80 + throttle * 140;
    const propVol = 0.1 + throttle * 0.25;
    this.propOsc.frequency.setTargetAtTime(propFreq, t, smoothing);
    this.propGain.gain.setTargetAtTime(propVol, t, smoothing);

    // ── Wind: volume scales with speed (louder at high speed) ──
    const speedNorm = Math.min(speed / 180, 1); // 0..1
    const windVol = speedNorm * speedNorm * 0.18; // quadratic for realism
    this.windGain.gain.setTargetAtTime(windVol, t, smoothing);
  }
}
