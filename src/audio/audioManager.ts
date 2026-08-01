const audioCtx = new (window.AudioContext as unknown as { new(): AudioContext })();

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.1): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export const sfx = {
  shoot: () => playTone(800, 0.05, 'square', 0.08),
  hit: () => playTone(400, 0.1, 'sawtooth', 0.06),
  kill: () => { playTone(600, 0.08, 'square', 0.1); setTimeout(() => playTone(900, 0.12, 'square', 0.1), 80); },
  death: () => playTone(200, 0.3, 'sawtooth', 0.1),
  reload: () => playTone(300, 0.15, 'triangle', 0.05),
  switch: () => playTone(500, 0.04, 'square', 0.04),
  jump: () => playTone(300, 0.08, 'triangle', 0.05),
  win: () => { playTone(523, 0.15, 'square', 0.1); setTimeout(() => playTone(659, 0.15, 'square', 0.1), 150); setTimeout(() => playTone(784, 0.2, 'square', 0.1), 300); },
  lose: () => { playTone(400, 0.2, 'sawtooth', 0.1); setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.1), 200); },
};
