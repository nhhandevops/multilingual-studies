/**
 * One 🔊 button for both pronunciation paths, so the word page and the review card can never
 * drift apart: a bundled human recording when the pack has one, otherwise the platform's
 * speech synthesiser, otherwise nothing at all.
 *
 * The synthetic case is visibly labelled (`.speak.tts`, its own tooltip). A learner copying a
 * robot's Mandarin tones is worse off than one who knows to go find a native model.
 */
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { playAudio, stopAudio } from '../audio/player';
import { canSpeak, speak, stopSpeech, subscribeVoices } from '../audio/tts';
import type { WordAudioRow } from '../db/queries';
import type { Db } from '../db/provider';

interface Props {
  db: Db;
  /**
   * The clip to play, `null` when we know there is none, `undefined` while the lookup is still
   * in flight. The three states are distinct on purpose: treating "still loading" as "no
   * recording" made a word that HAS a native recording paint as a synthetic-voice button for
   * the length of a worker round-trip, and clicking in that window really did speak the robot.
   */
  audio: WordAudioRow | null | undefined;
  text: string;
  lang: string;
  /**
   * 'inline' sits in a flex row of badges (word heading); 'block' is its own labelled line
   * (review answer). Block owns its wrapper so that a card with neither a recording nor a
   * voice renders nothing at all, rather than an empty paragraph holding open the layout.
   */
  variant?: 'inline' | 'block';
}

export function SpeakButton({ db, audio, text, lang, variant = 'inline' }: Props) {
  const { t } = useTranslation();
  // Voices arrive asynchronously in Chrome, so this must re-render when the list lands.
  const tts = useSyncExternalStore(
    subscribeVoices,
    () => canSpeak(lang),
    () => false, //  no speech synthesis during SSR/prerender
  );

  if (audio === undefined) return null; //  lookup in flight — decide nothing yet
  if (audio === null && !tts) return null;

  const synthetic = audio === null;
  const label = synthetic ? t('word.listenTts') : t('word.listen');
  const onClick = () => {
    // Each path stops the other. They are separate playback engines, so without this a tapped
    // example sentence talks over the headword recording still playing beside it.
    if (audio !== null) {
      stopSpeech();
      void playAudio(db, audio.id);
    } else {
      stopAudio();
      speak(text, lang);
    }
  };
  const button = (
    <button className={synthetic ? 'speak tts' : 'speak'} title={label} aria-label={label} onClick={onClick}>
      🔊{synthetic ? <sup aria-hidden="true">TTS</sup> : null}
      {variant === 'block' ? ` ${label}` : null}
    </button>
  );
  // CC BY/BY-SA want the author named wherever the work is used, and these are hundreds of
  // different volunteers — the Licenses screen cannot stand in for a per-clip credit.
  const credit = audio !== null ? <span className="audio-credit">{audio.attribution}</span> : null;
  return variant === 'block' ? (
    <p>
      {button}
      {credit}
    </p>
  ) : (
    <>
      {button}
      {credit}
    </>
  );
}
