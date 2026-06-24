/* ===================================================================
   MXA — Mansion Audio. A tiny zero-asset procedural sound toolkit.
   Every experience can call these for a unique sonic signature.
   AudioContext is created lazily and resumed on the first gesture,
   so it stays silent (and error-free) until the user interacts.
   =================================================================== */
window.MXA = (function () {
  let ctx, master;
  function get() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  ["pointerdown", "keydown", "touchstart"].forEach(ev => addEventListener(ev, () => get(), { passive: true }));

  function oscEnv(o, gain, dur, attack) {
    const c = get(); if (!c) return;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function tone(freq = 440, dur = 0.15, type = "sine", gain = 0.2) {
    const c = get(); if (!c) return; const o = c.createOscillator(); o.type = type; o.frequency.value = freq; oscEnv(o, gain, dur);
  }
  function sweep(f0, f1, dur = 0.2, type = "sawtooth", gain = 0.2) {
    const c = get(); if (!c) return; const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), c.currentTime + dur); oscEnv(o, gain, dur);
  }
  function noiseBuf(dur) {
    const c = get(); const n = Math.max(1, Math.floor(c.sampleRate * dur)); const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b;
  }
  function noise(dur = 0.2, gain = 0.2, freq = 2000, type = "lowpass", q = 1) {
    const c = get(); if (!c) return; const s = c.createBufferSource(); s.buffer = noiseBuf(dur);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.02);
  }

  /* ---- composite, characterful one-shots ---- */
  const A = {
    ctx: get,
    tone, sweep, noise,
    shatter() { noise(0.28, 0.3, 3500, "highpass", 0.4); for (let i = 0; i < 16; i++) setTimeout(() => tone(2200 + Math.random() * 4500, 0.06 + Math.random() * 0.12, "triangle", 0.05), Math.random() * 220); },
    crackle(dur = 0.3) { const n = 6 + (Math.random() * 8 | 0); for (let i = 0; i < n; i++) setTimeout(() => noise(0.025, 0.1, 1000 + Math.random() * 2500, "bandpass", 3), Math.random() * dur * 1000); },
    whoosh() { sweep(800, 120, 0.45, "sawtooth", 0.12); noise(0.45, 0.08, 1200, "lowpass"); },
    hiss(dur = 0.4, gain = 0.1) { noise(dur, gain, 6500, "highpass", 0.3); },
    zip() { sweep(180, 1500, 0.3, "sawtooth", 0.1); noise(0.3, 0.05, 3500, "highpass"); },
    rip(dur = 0.12) { noise(dur, 0.18, 2200, "bandpass", 1.5); },
    pump() { sweep(110, 320, 0.16, "square", 0.1); },
    pop() { tone(180, 0.05, "square", 0.25); noise(0.08, 0.18, 3500, "highpass"); },
    laser() { sweep(1300, 200, 0.16, "sawtooth", 0.1); },
    explosion() { noise(0.55, 0.32, 380, "lowpass", 1); sweep(180, 36, 0.55, "sine", 0.2); },
    thud() { tone(78, 0.18, "sine", 0.32); noise(0.1, 0.09, 300, "lowpass"); },
    click() { tone(880, 0.03, "square", 0.07); },
    tick() { tone(1500, 0.02, "square", 0.05); },
    chime(f = 880) { tone(f, 0.55, "sine", 0.14); tone(f * 1.5, 0.55, "sine", 0.07); tone(f * 2, 0.4, "sine", 0.04); },
    coin() { tone(988, 0.07, "square", 0.12); setTimeout(() => tone(1319, 0.18, "square", 0.12), 70); },
    glitch() { for (let i = 0; i < 6; i++) setTimeout(() => { noise(0.04, 0.12, 500 + Math.random() * 6000, "bandpass", 4); tone(100 + Math.random() * 2000, 0.03, "square", 0.06); }, i * 40); },
    error() { tone(220, 0.18, "sawtooth", 0.14); setTimeout(() => tone(180, 0.22, "sawtooth", 0.14), 90); },
    sandGrain() { noise(0.05, 0.04, 5000 + Math.random() * 3000, "bandpass", 2); },
    drone(freq = 55, gain = 0.04, type = "sawtooth") {
      const c = get(); if (!c) return () => {}; const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320; const g = c.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 1.5); o.connect(f).connect(g).connect(master); o.start();
      return () => { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6); o.stop(c.currentTime + 0.7); };
    },
  };
  return A;
})();
