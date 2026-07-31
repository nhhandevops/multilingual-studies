import Database from 'better-sqlite3';
const db = new Database('D:/Non-work/multilingual-studies/build/packs/2026.07.31-2/content.db', { readonly: true });
console.log('rank distribution:', db.prepare(`SELECT rank, count(*) n FROM word_sentences GROUP BY rank ORDER BY rank`).all());
console.log('words with duplicate rank:', db.prepare(`SELECT count(*) n FROM (SELECT word_id, rank FROM word_sentences GROUP BY word_id, rank HAVING count(*)>1)`).get());
console.log('sentence attribution empty/null:', db.prepare(`SELECT count(*) n FROM sentences WHERE attribution IS NULL OR trim(attribution)=''`).get());
console.log('sentences with no word link:', db.prepare(`SELECT count(*) n FROM sentences s WHERE NOT EXISTS(SELECT 1 FROM word_sentences ws WHERE ws.sentence_id=s.id)`).get());
console.log('word_audio audio missing from audio table:', db.prepare(`SELECT count(*) n FROM word_audio wa WHERE NOT EXISTS(SELECT 1 FROM audio a WHERE a.id=wa.audio_id)`).get());
db.close();
