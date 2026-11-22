// Tiny synthesized sounds: no audio files, just the Web Audio oscillator, created lazily
// on the first user gesture so a silent browser never complains. Every call is guarded,
// so a game with no audio device plays exactly the same.
export function createSound() {
  let context = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function blip(frequency, duration, type, gain) {
    const audio = ensure();
    if (audio === null) return;
    try {
      if (audio.state === 'suspended') void audio.resume();
      const oscillator = audio.createOscillator();
      const amplifier = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      amplifier.gain.setValueAtTime(gain, audio.currentTime);
      amplifier.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(amplifier);
      amplifier.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** A card leaves the hand. */
    play() {
      blip(520, 0.12, 'triangle', 0.12);
    },
    /** A creature strikes. */
    attack() {
      blip(180, 0.16, 'sawtooth', 0.1);
    },
    /** A spell resolves. */
    spell() {
      blip(760, 0.2, 'sine', 0.1);
    },
    /** The turn passes. */
    turn() {
      blip(330, 0.09, 'triangle', 0.07);
    },
    /** The pact is won: a rising three-note flourish. */
    win() {
      [523, 659, 784].forEach((frequency, index) => {
        window.setTimeout(() => blip(frequency, 0.25, 'triangle', 0.12), index * 130);
      });
    },
    /** The pact is lost: a low falling note. */
    lose() {
      blip(196, 0.5, 'sawtooth', 0.08);
    },
  };
}
