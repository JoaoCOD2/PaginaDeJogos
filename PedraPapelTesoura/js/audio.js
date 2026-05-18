const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function createOscillator(type, frequency, duration, gainValue) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

export async function resumeAudio() {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

export function clickSound() {
  createOscillator("square", 320, 0.06, 0.08);
}

export function successSound() {
  createOscillator("triangle", 600, 0.16, 0.08);
  createOscillator("sine", 760, 0.12, 0.06);
}

export function failureSound() {
  createOscillator("sawtooth", 240, 0.12, 0.08);
  createOscillator("square", 180, 0.2, 0.05);
}

export function neutralSound() {
  createOscillator("sine", 360, 0.12, 0.05);
}

export function notificationSound() {
  createOscillator("triangle", 520, 0.1, 0.05);
}
