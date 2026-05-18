const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function createOscillator(type, frequency, duration, volume) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

export async function resumeAudio() {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

export function clickSound() {
  createOscillator('square', 320, 0.06, 0.08);
}

export function successSound() {
  createOscillator('triangle', 620, 0.16, 0.08);
  createOscillator('sine', 720, 0.1, 0.06);
}

export function failureSound() {
  createOscillator('sawtooth', 260, 0.12, 0.08);
  createOscillator('square', 180, 0.18, 0.04);
}

export function neutralSound() {
  createOscillator('sine', 440, 0.12, 0.05);
}

export function notificationSound() {
  createOscillator('triangle', 520, 0.1, 0.06);
}
