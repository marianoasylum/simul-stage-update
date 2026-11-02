/**
 * Procedural Web Audio API sound engine
 * Handles microphone analysis, concert music synthesis, and sound effects
 */
import { AudioMetrics } from '../types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMusicPlaying = false;
  private musicInterval: number | null = null;
  private currentStep = 0;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private micVolumeMultiplier = 2.0;

  // Track variation
  private trackBpm = 124;
  private trackKey = 0; // 0 = A minor, 1 = D minor, 2 = F# minor

  public init(): boolean {
    if (this.ctx) return true;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.6;
      this.musicGain.connect(this.ctx.destination);
      this.musicGain.connect(this.analyser); // Feed synth to analyser

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.ctx.destination);

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return true;
    } catch (e) {
      console.warn('AudioContext failed to initialize:', e);
      return false;
    }
  }

  public async connectMicrophone(): Promise<boolean> {
    this.init();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.ctx && this.analyser) {
        this.micSource = this.ctx.createMediaStreamSource(this.micStream);
        // Connect to analyser ONLY, NOT to destination (to avoid acoustic feedback)
        this.micSource.connect(this.analyser);
        return true;
      }
    } catch (err) {
      console.warn('Microphone permission or connection failed:', err);
      return false;
    }
    return false;
  }

  public disconnectMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.micSource = null;
    }
  }

  public getAudioMetrics(): AudioMetrics {
    if (!this.analyser || !this.freqData) {
      return { volume: 0, bassLevel: 0, trebleLevel: 0 };
    }

    this.analyser.getByteFrequencyData(this.freqData);
    const length = this.freqData.length;
    if (length === 0) return { volume: 0, bassLevel: 0, trebleLevel: 0 };

    let total = 0;
    let bassTotal = 0;
    const bassBins = Math.max(2, Math.floor(length * 0.15));

    for (let i = 0; i < length; i++) {
      const val = this.freqData[i] / 255;
      total += val;
      if (i < bassBins) {
        bassTotal += val;
      }
    }

    const avgVol = (total / length) * this.micVolumeMultiplier;
    const avgBass = (bassTotal / bassBins) * 1.3;
    const trebleBinStart = Math.floor(length * 0.6);
    let trebleTotal = 0;
    for (let i = trebleBinStart; i < length; i++) {
      trebleTotal += this.freqData[i] / 255;
    }
    const avgTreble = trebleTotal / (length - trebleBinStart);

    return {
      volume: Math.min(1.0, avgVol),
      bassLevel: Math.min(1.0, avgBass),
      trebleLevel: Math.min(1.0, avgTreble),
    };
  }

  // --- Sound Effects ---

  public playCarDoor(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playFootstep(isSprinting = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Filtered noise click for footstep
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSprinting ? 600 : 400, now);
    filter.Q.value = 2.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSprinting ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isSprinting ? 0.06 : 0.09));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  public playAlarm(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startT = now + i * 0.18;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, startT);
      osc.frequency.setValueAtTime(659, startT + 0.09);

      gain.gain.setValueAtTime(0.7, startT);
      gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startT);
      osc.stop(startT + 0.17);
    }
  }

  public playSitDown(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playFlashlightClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playJump(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playWarningBeep(secondsLeft: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    // Frequency increases as urgency increases
    const freq = 880 + (5 - secondsLeft) * 120;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playExpulsionBuzzer(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Harsh double low buzzer
    for (let i = 0; i < 2; i++) {
      const startT = now + i * 0.28;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, startT);
      osc.frequency.setValueAtTime(80, startT + 0.15);

      gain.gain.setValueAtTime(0.8, startT);
      gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.24);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startT);
      osc.stop(startT + 0.25);
    }
  }

  public playCrowdApplause(): void {
    if (!this.ctx || !this.sfxGain) return;

    // Synthesize cheering & applause with filtered modulated noise
    const duration = 6.0;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        // Envelope: swell in, sustain, slow decay
        let env = 1.0;
        if (t < 1.0) env = t;
        else if (t > 4.0) env = Math.max(0, 1.0 - (t - 4.0) / 2.0);

        // Clapping pulses
        const clapPulse = Math.sin(t * 12.0 + ch * 1.5) * 0.3 + 0.7;
        channelData[i] = (Math.random() * 2 - 1) * env * clapPulse * 0.4;
      }
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  // --- Procedural Concert Synthesizer Track ---

  public startConcertMusic(): void {
    this.init();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.currentStep = 0;
    this.trackKey = Math.floor(Math.random() * 3);

    const stepTimeMs = (60 / this.trackBpm / 4) * 1000; // 16th note steps

    this.musicInterval = window.setInterval(() => {
      this.playSynthStep(this.currentStep);
      this.currentStep = (this.currentStep + 1) % 64; // 4-bar loop
    }, stepTimeMs);
  }

  public stopConcertMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private playSynthStep(step: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime + 0.01;

    // Scale notes based on chosen key
    const scales = [
      [220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0], // A minor
      [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 261.63], // D minor
      [185.0, 207.65, 220.0, 246.94, 277.18, 293.66, 329.63], // F# minor
    ];
    const scale = scales[this.trackKey] || scales[0];

    // 1. Kick Drum (4-on-the-floor on steps 0, 4, 8, 12, etc.)
    if (step % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

      kickGain.gain.setValueAtTime(0.9, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);
      kickOsc.start(now);
      kickOsc.stop(now + 0.28);
    }

    // 2. Snare / Clap on beats 4 and 12 of each bar
    if (step % 8 === 4) {
      const snareNoise = this.createNoiseBuffer(0.15);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, now);

      const snareGain = this.ctx.createGain();
      snareGain.gain.setValueAtTime(0.6, now);
      snareGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

      snareNoise.connect(filter);
      filter.connect(snareGain);
      snareGain.connect(this.musicGain);
      snareNoise.start(now);
    }

    // 3. Hi-hat on off-beats
    if (step % 2 === 1) {
      const hatNoise = this.createNoiseBuffer(0.04);
      const hatFilter = this.ctx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(7000, now);

      const hatGain = this.ctx.createGain();
      hatGain.gain.setValueAtTime(step % 4 === 2 ? 0.35 : 0.18, now);
      hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      hatNoise.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(this.musicGain);
      hatNoise.start(now);
    }

    // 4. Bassline: Rolling 16th note synthwave bass
    const bassNoteIndex = [0, 0, 2, 0, 3, 3, 0, 4][Math.floor((step % 32) / 4)] || 0;
    const baseFreq = (scale[bassNoteIndex] || 220) / 2;

    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(baseFreq, now);

    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(500 + Math.sin(step * 0.2) * 200, now);
    bassFilter.Q.value = 4.0;

    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.02, now + 0.11);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.musicGain);
    bassOsc.start(now);
    bassOsc.stop(now + 0.13);

    // 5. Arpeggiator Lead
    const arpNotes = [0, 2, 4, 6, 4, 2, 0, 3];
    const leadNote = scale[arpNotes[step % 8]] * 2;

    const leadOsc = this.ctx.createOscillator();
    const leadGain = this.ctx.createGain();
    const leadFilter = this.ctx.createBiquadFilter();

    leadOsc.type = 'square';
    leadOsc.frequency.setValueAtTime(leadNote, now);

    leadFilter.type = 'bandpass';
    leadFilter.frequency.setValueAtTime(1400 + Math.sin(step * 0.4) * 800, now);
    leadFilter.Q.value = 3.0;

    leadGain.gain.setValueAtTime(0.2, now);
    leadGain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);

    leadOsc.connect(leadFilter);
    leadFilter.connect(leadGain);
    leadGain.connect(this.musicGain);
    leadOsc.start(now);
    leadOsc.stop(now + 0.14);
  }

  private createNoiseBuffer(duration: number): AudioBufferSourceNode {
    if (!this.ctx) throw new Error('No audio context');
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    return noise;
  }

  public setMasterVolume(vol: number): void {
    if (this.musicGain) this.musicGain.gain.value = Math.max(0, Math.min(1, vol * 0.6));
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, vol * 0.5));
  }
}

export const soundEngine = new SoundEngine();
