/**
 * Speech-synthesis fallback for words we have no human recording of.
 *
 * The pack bundles recorded audio where it is free and affordable — 7,211 Mandarin HSK words and
 * the A1–B1 French bands. Everything else (B2–C2 French, all English, unlevelled Chinese) would
 * otherwise have no pronunciation at all. `speechSynthesis` covers those with zero bundled bytes
 * and zero licensing burden: nothing is downloaded and nothing is redistributed.
 *
 * It is deliberately the *fallback*, never the default. Platform voices are intelligible but
 * flat, and for Mandarin in particular a synthetic voice can blur exactly the tone contrasts the
 * learner is trying to acquire — so a recording always wins, and synthetic playback is labelled
 * as synthetic in the UI so nobody mistakes it for a native model.
 */

/** Content langs → BCP-47 tags. 'all' (letters, IPA) is not speakable and is absent on purpose. */
const BCP47: Record<string, string> = { zh: 'zh-CN', fr: 'fr-FR', en: 'en-US' };

const listeners = new Set<() => void>();
let voices: SpeechSynthesisVoice[] = [];

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refresh(): void {
  if (!supported()) return;
  voices = window.speechSynthesis.getVoices();
  for (const fn of listeners) fn();
}

if (supported()) {
  refresh();
  // Chrome populates the list asynchronously and fires this once it has; without it the first
  // render of every page would decide "no voice" and never revisit that.
  window.speechSynthesis.addEventListener('voiceschanged', refresh);
}

/** Subscribe to voice-list changes (for `useSyncExternalStore`). */
export function subscribeVoices(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Best installed voice for a content language, or null.
 *
 * Matching is on the primary subtag: a machine may ship `zh-TW` or `fr-CA` and not the exact tag
 * we ask for, and a regional accent is worth far more than silence. Exact matches still win.
 */
export function voiceFor(lang: string): SpeechSynthesisVoice | null {
  const tag = BCP47[lang];
  if (!tag || voices.length === 0) return null;
  const primary = tag.split('-')[0]!;
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return (
    voices.find((v) => norm(v) === tag.toLowerCase()) ??
    voices.find((v) => norm(v).startsWith(`${primary}-`)) ??
    voices.find((v) => norm(v) === primary) ??
    null
  );
}

export function canSpeak(lang: string): boolean {
  return supported() && voiceFor(lang) !== null;
}

/** Speak `text`, cancelling anything already speaking. */
export function speak(text: string, lang: string): void {
  const voice = voiceFor(lang);
  if (!supported() || !voice || text.length === 0) return;
  const synth = window.speechSynthesis;
  const utter = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    // Slightly under normal pace: this is a pronunciation model, not a news reader.
    u.rate = 0.9;
    synth.speak(u);
  };
  // Queued utterances pile up if the learner taps repeatedly; only the latest is wanted. But
  // Chrome silently drops an utterance queued in the same task as cancel(), which would make
  // every repeat press do nothing — so when there is something to cancel, yield first.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(utter, 0);
  } else {
    utter();
  }
}
