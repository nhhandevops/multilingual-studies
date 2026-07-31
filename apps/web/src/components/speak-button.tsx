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
import { playAudio } from '../audio/player';
import { canSpeak, speak, subscribeVoices } from '../audio/tts';
import type { Db } from '../db/provider';

interface Props {
  db: Db;
  audioId: string | null;
  text: string;
  lang: string;
  /**
   * 'inline' sits in a flex row of badges (word heading); 'block' is its own labelled line
   * (review answer). Block owns its wrapper so that a card with neither a recording nor a
   * voice renders nothing at all, rather than an empty paragraph holding open the layout.
   */
  variant?: 'inline' | 'block';
}

export function SpeakButton({ db, audioId, text, lang, variant = 'inline' }: Props) {
  const { t } = useTranslation();
  // Voices arrive asynchronously in Chrome, so this must re-render when the list lands.
  const tts = useSyncExternalStore(
    subscribeVoices,
    () => canSpeak(lang),
    () => false, //  no speech synthesis during SSR/prerender
  );

  if (audioId === null && !tts) return null;

  const synthetic = audioId === null;
  const label = synthetic ? t('word.listenTts') : t('word.listen');
  const onClick = () => {
    if (audioId !== null) void playAudio(db, audioId);
    else speak(text, lang);
  };
  const button = (
    <button className={synthetic ? 'speak tts' : 'speak'} title={label} aria-label={label} onClick={onClick}>
      🔊{synthetic ? <sup aria-hidden="true">TTS</sup> : null}
      {variant === 'block' ? ` ${label}` : null}
    </button>
  );
  return variant === 'block' ? <p>{button}</p> : button;
}
