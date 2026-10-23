import { useSyncExternalStore } from 'react';

// Loud alarm and soft chime from the Web Audio API (no audio files, works on every phone).
// Browsers only allow sound after a tap, so the first tap anywhere unlocks it.

type Ctx = AudioContext;

class Sound {
  private ctx: Ctx | null = null;
  private loop: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  ready = false;

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    // Phones suspend audio in the background; resume when the page is visible again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    });
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  unlock() {
    try {
      this.ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.set(true), () => {});
      else this.set(true);
    } catch {
      /* no audio on this device */
    }
  }

  private set(ready: boolean) {
    if (this.ready === ready) return;
    this.ready = ready;
    this.listeners.forEach(fn => fn());
  }

  private beep(freq: number, at: number, dur: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** High–low pattern every 2 s plus vibration, until stopped. */
  startAlarm() {
    if (this.loop) return;
    const pattern = () => {
      [0, 0.25, 0.5, 0.75].forEach((at, i) => this.beep(i % 2 ? 660 : 880, at, 0.2, 0.45, 'square'));
      navigator.vibrate?.([300, 100, 300, 100, 300]);
    };
    pattern();
    this.loop = setInterval(pattern, 2000);
  }

  stopAlarm() {
    if (!this.loop) return;
    clearInterval(this.loop);
    this.loop = null;
    navigator.vibrate?.(0);
  }

  /** Two soft rising notes: something is ready / a new ticket arrived at the bar. */
  chime() {
    this.beep(784, 0, 0.35, 0.22, 'sine');
    this.beep(1175, 0.14, 0.5, 0.2, 'sine');
  }

  test() {
    this.unlock();
    this.beep(880, 0.02, 0.3, 0.4, 'square');
    navigator.vibrate?.([200, 100, 200]);
  }
}

export const sound = new Sound();

/** True once a tap unlocked audio on this page. */
export const useSoundReady = () => useSyncExternalStore(sound.subscribe, () => sound.ready, () => false);
