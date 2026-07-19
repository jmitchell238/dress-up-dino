'use strict';

let audioCtx = null;

function ensureAudio() {
  if (save.muted) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.05, slide = 0, delay = 0 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sfxClick() { tone({ freq: 520, dur: 0.05, type: 'square', gain: 0.02 }); }
function sfxEquip() {
  tone({ freq: 440, dur: 0.08, type: 'sine', gain: 0.035, slide: 80 });
  tone({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.03, delay: 0.06 });
}
function sfxUnequip() {
  tone({ freq: 360, dur: 0.08, type: 'sine', gain: 0.025, slide: -60 });
}
function sfxFavorite() {
  tone({ freq: 523, dur: 0.08, type: 'sine', gain: 0.04 });
  tone({ freq: 659, dur: 0.1, type: 'triangle', gain: 0.04, delay: 0.07 });
  tone({ freq: 784, dur: 0.14, type: 'sine', gain: 0.035, delay: 0.14 });
}
function sfxRoar() {
  tone({ freq: 180, dur: 0.18, type: 'sawtooth', gain: 0.03, slide: 40 });
  tone({ freq: 140, dur: 0.2, type: 'square', gain: 0.02, delay: 0.1, slide: -30 });
  tone({ freq: 220, dur: 0.12, type: 'triangle', gain: 0.025, delay: 0.22 });
}
function sfxShowOff() {
  sfxRoar();
  tone({ freq: 523, dur: 0.1, type: 'sine', gain: 0.04, delay: 0.35 });
  tone({ freq: 659, dur: 0.1, type: 'sine', gain: 0.04, delay: 0.44 });
  tone({ freq: 784, dur: 0.16, type: 'triangle', gain: 0.045, delay: 0.53 });
  tone({ freq: 1046, dur: 0.2, type: 'sine', gain: 0.03, delay: 0.65 });
}
function sfxMatch() {
  tone({ freq: 392, dur: 0.1, type: 'sine', gain: 0.04 });
  tone({ freq: 523, dur: 0.1, type: 'sine', gain: 0.04, delay: 0.1 });
  tone({ freq: 659, dur: 0.14, type: 'triangle', gain: 0.045, delay: 0.2 });
}
function sfxShuffle() {
  tone({ freq: 300, dur: 0.05, type: 'square', gain: 0.02, slide: 100 });
  tone({ freq: 400, dur: 0.05, type: 'square', gain: 0.02, delay: 0.06, slide: 80 });
  tone({ freq: 500, dur: 0.06, type: 'square', gain: 0.02, delay: 0.12, slide: 60 });
}
