/**
 * seed:tips — the evergreen study tips.
 *
 * WHY THESE ARE AUTHORED, NOT INGESTED. The 0.6 row asks for "a tip + evergreen tips", and the
 * daily-pull skill writes one fresh tip per day. A day-one install would then show nothing until
 * the first pull ran, and a learner who never runs the skill would see nothing ever — so the pack
 * ships a permanent rotation underneath the daily one. Original work under the pack's own
 * CC BY-SA 4.0, same as the Latin letter skeletons in latin.ts.
 *
 * TWO RULES THEY ALL FOLLOW.
 *  1. They are written for a VIETNAMESE speaker specifically — Sino-Vietnamese readings, the
 *     final-consonant problem, the fact that Vietnamese has tones and French has none. A generic
 *     "review every day" tip is worth nothing that a habit tracker could not say.
 *  2. Every tip that can point at a screen in this app does. A tip you can act on in one tap is
 *     a feature; a tip you have to remember later is a fortune cookie.
 *
 * Accuracy note: the Sino-Vietnamese material below is deliberately conservative. Every pair
 * listed was checked to be a real cognate, and the one tip on the subject exists mostly to warn
 * that the pattern MISLEADS as often as it helps (医院 is "y viện" by derivation but "bệnh viện"
 * in actual Vietnamese). Teaching a shortcut without teaching where it breaks is not teaching.
 */
import { createHash } from 'node:crypto';
import { tipId, type IdLang } from '@mls/shared';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

export const TIPS_SOURCE_ID = 'mls-tips';
const SOURCE_ID = TIPS_SOURCE_ID;
const PARSER_VERSION = 1;

/** Fixed so the IDs never move. This is the authoring date, not the build date. */
const AUTHORED = '2026-07-31';

/**
 * Slug prefix reserved for tips the /daily-pull skill writes. It is what separates the daily
 * tips from the evergreen ones inside a single source, so `seed:tips` can replace its own set
 * without deleting somebody else's.
 */
export const DAILY_TIP_PREFIX = 'daily-';

/**
 * Shared with `tips:add`, which writes the daily tip the /daily-pull skill authors. Both write
 * rows attributed to this project, so both must register the identical source.
 */
export function registerTipsSource(db: DB, retrievedAt = AUTHORED): void {
  registerSource(db, {
    id: SOURCE_ID,
    name: 'Study tips (this project)',
    url: 'https://github.com/nhhandevops/multilingual-studies',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'Study tips written for multilingual-studies and released under CC BY-SA 4.0. Written for Vietnamese speakers specifically — Sino-Vietnamese vocabulary, final-consonant clusters, French grammatical gender — rather than adapted from a general-purpose list.',
    retrievedAt,
    licenseMode: 'bundled',
  });
}

interface Tip {
  lang: IdLang; //     'zh' | 'en' | 'fr' | 'all'
  slug: string;
  technique: string;
  title: string; //    Vietnamese
  body: string; //     Vietnamese markdown
  links?: { label: string; url: string }[];
}

const TIPS: Tip[] = [
  {
    lang: 'zh',
    slug: 'am-han-viet-la-loi-tat',
    technique: 'sv-cognate',
    title: 'Âm Hán Việt là lối tắt lớn nhất bạn đang có',
    body: `Khoảng 60% từ vựng tiếng Việt có gốc Hán. Khi gặp một từ tiếng Trung mới, hãy thử đọc nó theo **âm Hán Việt** trước khi tra nghĩa — rất nhiều lần bạn sẽ tự đoán ra.

- 国家 guójiā → **quốc gia**
- 银行 yínháng → **ngân hàng**
- 经济 jīngjì → **kinh tế**
- 政府 zhèngfǔ → **chính phủ**
- 注意 zhùyì → **chú ý**
- 发展 fāzhǎn → **phát triển**

Mẹo này mạnh nhất với từ hai âm tiết mang tính trừu tượng, học thuật, chính trị — đúng loại từ khó nhớ nhất bằng cách khác.`,
  },
  {
    lang: 'zh',
    slug: 'am-han-viet-cho-sai',
    technique: 'sv-cognate',
    title: 'Nhưng âm Hán Việt cũng đánh lừa bạn',
    body: `Âm Hán Việt cho bạn *cách đọc*, không phải *cách người Trung Quốc dùng từ*. Vài cái bẫy thật:

- 医院 yīyuàn — âm Hán Việt là "y viện", nhưng tiếng Việt nói **bệnh viện** (病院).
- 麻烦 máfan — "ma phiền", nghĩa thật là *phiền phức, làm phiền*.
- 干部 gànbù — "cán bộ", nhưng sắc thái trong tiếng Trung rộng hơn nhiều.
- 大家 dàjiā — không phải "đại gia" giàu có, mà là **mọi người**.

Quy tắc an toàn: dùng âm Hán Việt để **nhớ mặt chữ**, dùng từ điển để **biết nghĩa**. Đừng đảo ngược thứ tự đó.`,
  },
  {
    lang: 'zh',
    slug: 'to-mau-thanh-dieu',
    technique: 'tone-color',
    title: 'Gán màu cho thanh điệu, rồi đừng bao giờ đổi',
    body: `Người Việt có lợi thế: bạn đã nghe được cao độ. Vấn đề chỉ là gắn cao độ đó vào đúng chữ.

Hãy tự chọn **một bảng màu cho 4 thanh** (ví dụ: thanh 1 đỏ, thanh 2 xanh lá, thanh 3 xanh dương, thanh 4 tím, thanh nhẹ xám) và dùng nó ở mọi nơi — khi viết tay, khi tạo thẻ, khi ghi chú. Điều quan trọng không phải là *màu nào*, mà là **không bao giờ đổi**. Trí nhớ hình ảnh chỉ giúp bạn khi nó nhất quán.

Đừng quy thanh điệu tiếng Trung về thanh tiếng Việt: thanh 3 (ǎ) *không* phải dấu hỏi, nó là một đường trầm kéo dài. Nghe rồi bắt chước, đừng dịch.`,
    links: [{ label: 'Luyện nghe thanh điệu', url: '/tones' }],
  },
  {
    lang: 'zh',
    slug: 'viet-de-nho-mat-chu',
    technique: 'writing',
    title: 'Viết chữ để nhớ chữ — kể cả khi bạn chỉ định gõ',
    body: `Bạn có thể học tiếng Trung mà không cần viết tay. Nhưng viết vài lần một chữ mới sẽ ép bạn nhìn thấy **cấu trúc** của nó (bộ thủ, thành phần biểu âm) thay vì nhìn nó như một đám nét.

Cách nhanh: mở chữ trong mục Tập viết, xem nó tự vẽ một lần, rồi tô lại đúng thứ tự nét. Ba mươi giây một chữ. Sau đó bạn sẽ phân biệt được những cặp mà trước đó trông y hệt nhau — 未/末, 己/已, 千/干.`,
    links: [{ label: 'Tập viết', url: '/write' }],
  },
  {
    lang: 'zh',
    slug: 'hoc-tu-theo-chu-chung',
    technique: 'keyword-method',
    title: 'Học theo chùm chữ, đừng học từ lẻ',
    body: `Một chữ Hán hiếm khi đi một mình. Khi học 电 diàn (điện), học luôn cả chùm:

- 电话 diànhuà — điện thoại
- 电脑 diànnǎo — máy tính ("điện não")
- 电影 diànyǐng — phim ("điện ảnh")
- 电视 diànshì — TV ("điện thị")

Bốn từ này rẻ hơn nhiều so với bốn từ không liên quan, vì chúng dùng chung một nửa. Trong ứng dụng, trang của mỗi chữ có sẵn danh sách "từ chứa chữ này" — đó chính là chùm cần học.`,
  },
  {
    lang: 'fr',
    slug: 'duoi-tu-quyet-dinh-giong',
    technique: 'gender-ending',
    title: 'Đuôi từ đoán được giống — khoảng 80% thời gian',
    body: `Đừng học giống của từng danh từ tiếng Pháp một cách rời rạc. Học **đuôi từ**:

**Thường là giống cái (la):** -tion, -sion, -té, -ée, -ance, -ence, -ie, -ette
→ la nation, la télévision, la liberté, la journée, la connaissance, la boulangerie

**Thường là giống đực (le):** -age, -ment, -eau, -isme, -oir
→ le fromage, le gouvernement, le bureau, le tourisme, le devoir

**Ngoại lệ phải nhớ riêng** (chúng ít nhưng rất hay gặp): la page, la plage, l'image, la cage, la nage · le musée, le lycée · le silence.

Học một quy tắc + năm ngoại lệ nhẹ hơn học ba trăm danh từ.`,
  },
  {
    lang: 'fr',
    slug: 'luon-hoc-kem-mao-tu',
    technique: 'gender-ending',
    title: 'Không bao giờ học một danh từ Pháp mà thiếu mạo từ',
    body: `Ghi nhớ **"une table"**, không phải "table". Ghi nhớ **"un livre"**, không phải "livre".

Lý do rất thực tế: giống của danh từ không nằm trong bản thân từ, nó nằm ở mọi thứ *xung quanh* từ — mạo từ, tính từ, đại từ, phân từ quá khứ. Nếu bạn nhớ từ mà không nhớ giống, bạn sẽ phải đoán lại giống ở mỗi câu bạn nói.

Khi thêm một từ tiếng Pháp vào bộ thẻ, hãy đọc to cả cụm có mạo từ. Chi phí bằng không, lợi ích kéo dài mãi.`,
  },
  {
    lang: 'fr',
    slug: 'nguyen-am-mui',
    technique: 'pronunciation',
    title: 'Nguyên âm mũi: bốn âm, không phải "n" ở cuối',
    body: `*bon*, *banc*, *bain*, *brun* — chữ n ở đây **không được phát âm**. Nó chỉ báo rằng nguyên âm trước nó đi qua mũi.

Người Việt có lợi thế thật ở đây: tiếng Việt đã có âm mũi hóa, cổ họng bạn biết cách làm. Cái khó chỉ là **không đóng lưỡi lại** ở cuối. Thử: nói "ong" nhưng dừng ngay trước khi lưỡi chạm vòm miệng.

Bảng IPA trong ứng dụng có hình cắt dọc khoang miệng cho từng âm — nhìn lưỡi nằm ở đâu dễ hơn nghe mô tả nhiều.`,
    links: [{ label: 'Bảng IPA', url: '/ipa' }],
  },
  {
    lang: 'fr',
    slug: 'lien-am-liaison',
    technique: 'pronunciation',
    title: 'Liaison là lý do bạn nghe không ra từ đã biết',
    body: `Bạn biết *les*, biết *amis*, nhưng nghe "lezami" thì không nhận ra. Đó không phải lỗi từ vựng — đó là **liaison**: phụ âm câm cuối từ sống dậy khi từ sau bắt đầu bằng nguyên âm.

- les amis → /le‿z‿ami/
- un homme → /œ̃‿n‿ɔm/
- très intéressant → /tʁɛ‿z‿ɛ̃teʁesɑ̃/

Cách chữa: luôn luyện nghe theo **cụm**, đừng luyện theo từ. Khi nghe câu ví dụ trong ứng dụng, hãy nghe lại 3 lần rồi mới nhìn chữ.`,
  },
  {
    lang: 'en',
    slug: 'phu-am-cuoi',
    technique: 'pronunciation',
    title: 'Phụ âm cuối là thứ khiến người nghe không hiểu bạn',
    body: `Tiếng Việt kết thúc âm tiết rất "đóng" và không có cụm phụ âm cuối. Tiếng Anh thì đầy: *asked* /æskt/, *texts* /teksts/, *worlds* /wɜːldz/.

Bỏ phụ âm cuối làm hỏng **ngữ pháp**, không chỉ phát âm: "he walk" và "he walked" khác nhau ở đúng một âm /t/. Người nghe mất luôn thì quá khứ.

Bài tập 2 phút: chọn 5 động từ, đọc to cả ba dạng — *work / works / worked* — và cố tình kéo dài âm cuối quá mức cần thiết. Nói quá lên khi luyện thì lúc nói thật sẽ vừa.`,
  },
  {
    lang: 'en',
    slug: 'trong-am-tu',
    technique: 'pronunciation',
    title: 'Trọng âm sai làm hỏng từ nhiều hơn nguyên âm sai',
    body: `Tiếng Anh là ngôn ngữ trọng âm. Đặt sai trọng âm khiến người bản ngữ nghe ra một từ khác — hoặc không ra từ nào cả.

Vài cặp đổi nghĩa theo trọng âm:
- **RE**cord (danh từ, bản ghi) / re**CORD** (động từ, ghi âm)
- **PRE**sent (món quà) / pre**SENT** (trình bày)
- **CON**tent (nội dung) / con**TENT** (hài lòng)

Khi thêm từ mới vào thẻ, hãy đánh dấu luôn âm tiết mang trọng âm. Nó là một phần của từ, ngang với chính tả.`,
  },
  {
    lang: 'en',
    slug: 'am-th',
    technique: 'pronunciation',
    title: 'Âm /θ/ và /ð/: đặt lưỡi, đừng đổi sang t/d',
    body: `*think* không phải "tink", *this* không phải "dis". Tiếng Việt không có hai âm này nên phản xạ tự nhiên là thay bằng âm gần nhất.

Cách làm đúng đơn giản đến mức khó tin: **đặt đầu lưỡi chạm nhẹ mép răng cửa trên rồi thổi hơi ra**. Không cần bật mạnh. /θ/ là âm vô thanh (think, three, bath), /ð/ là âm hữu thanh (this, that, mother).

Trong Bảng IPA của ứng dụng có hình cắt dọc cho cả hai — vị trí lưỡi nhìn một lần là hiểu.`,
    links: [{ label: 'Bảng IPA', url: '/ipa' }],
  },
  {
    lang: 'all',
    slug: 'phuong-phap-tu-khoa',
    technique: 'keyword-method',
    title: 'Phương pháp từ khóa: biến từ lạ thành một hình ảnh vô lý',
    body: `Cách nhớ từ vựng có bằng chứng khoa học tốt nhất cho người mới, gồm hai bước:

1. Tìm một **từ khóa** trong tiếng Việt nghe giống từ cần học.
2. Tưởng tượng một cảnh **vô lý, sống động** nối từ khóa đó với nghĩa.

Ví dụ: tiếng Pháp *le pain* (bánh mì) nghe như "panh" → hình dung một ổ bánh mì dài đang **panh** ra làm đôi. Tiếng Trung 忙 máng (bận) nghe như "măng" → hình dung bạn bận đến mức phải ăn **măng** ngay khi đang chạy.

Cảnh càng kỳ quặc, càng cụ thể thì càng dễ nhớ. Cảnh nhạt nhẽo thì vô dụng. Sau vài chục lần gặp lại, hình ảnh sẽ tự rơi ra và bạn chỉ còn nhớ từ — đó là dấu hiệu nó đã làm xong việc.`,
  },
  {
    lang: 'all',
    slug: 'it-moi-moi-ngay',
    technique: 'spacing',
    title: 'Ít từ mới mỗi ngày, nhưng không bỏ ngày nào',
    body: `Mỗi từ mới hôm nay là một khoản nợ ôn tập cho vài tháng tới. Thêm 50 từ trong một ngày hứng khởi sẽ tạo ra một ngày ôn tập 200 thẻ trong hai tuần nữa — và đó là ngày bạn bỏ cuộc.

Con số bền vững cho người đi làm là **5–10 từ mới mỗi ngôn ngữ mỗi ngày**. Ứng dụng mặc định 5 và cho bạn chỉnh trong màn hình Ôn tập.

Nguyên tắc quan trọng hơn số lượng: **ôn tập đến hết mỗi ngày**, kể cả ngày bạn không thêm từ mới nào. Thẻ đến hạn mà không ôn sẽ dồn lại, và thuật toán lịch ôn chỉ chính xác khi bạn ôn đúng lúc nó hẹn.`,
    links: [{ label: 'Ôn tập', url: '/review' }],
  },
  {
    lang: 'all',
    slug: 'nghe-truoc-nhin-sau',
    technique: 'shadowing',
    title: 'Nghe trước, nhìn chữ sau',
    body: `Khi có bản thu âm, hãy luôn **nghe trước khi đọc chữ**. Nếu nhìn chữ trước, bạn sẽ nghe thấy thứ mình *tưởng* là đúng — chữ viết sẽ đè lên âm thanh thật.

Quy trình 4 bước cho một câu ví dụ:
1. Nghe 2–3 lần, không nhìn gì cả.
2. Nói nhại lại (shadowing) ngay khi câu đang phát, không đợi nó kết thúc.
3. Bây giờ mới nhìn chữ — và để ý chỗ nào bạn nghe sai.
4. Nghe lại lần cuối trong lúc nhìn chữ.

Bước 3 là bước dạy bạn nhiều nhất. Khoảng cách giữa cái bạn nghe và cái thật sự được nói chính là bài học.`,
  },
  {
    lang: 'all',
    slug: 'giong-may-chi-la-tam-thoi',
    technique: 'listening',
    title: 'Giọng máy dùng tạm được, nhưng đừng bắt chước nó',
    body: `Từ nào không có bản thu của người thật, ứng dụng sẽ đọc bằng giọng tổng hợp và gắn nhãn 🔊TTS với viền đứt nét. Nhãn đó có lý do.

Giọng máy đủ tốt để bạn **nhận ra** một từ khi đọc. Nó không đủ tốt để bạn **học phát âm theo** — đặc biệt là thanh điệu tiếng Trung, nơi nhiều giọng tổng hợp làm phẳng đường cao độ, và nhịp điệu tiếng Pháp.

Quy tắc: nghe giọng người thật thì bắt chước; nghe giọng máy thì chỉ dùng để tra. Khi một từ quan trọng chỉ có giọng máy, hãy tìm nó trên một nguồn có người bản ngữ trước khi đưa nó vào cách nói hằng ngày của bạn.`,
  },
];

export async function run(db: DB): Promise<void> {
  const hash = createHash('sha256');
  for (const t of TIPS) hash.update(t.slug).update(t.title).update(t.body).update(t.technique);
  const inputSha = createHash('sha256')
    .update(hash.digest('hex'))
    .update(`parser:${PARSER_VERSION}`)
    .digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ tips unchanged, skipping');
    return;
  }

  registerTipsSource(db);

  const insert = db.prepare(`
    INSERT INTO tips (id, lang, date_added, title, body_md, technique, links, source_id)
    VALUES (@id, @lang, @date_added, @title, @body_md, @technique, @links, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, body_md = excluded.body_md,
      technique = excluded.technique, links = excluded.links`);

  let n = 0;
  db.transaction(() => {
    // Selection can change between runs (a tip removed from the array must leave the pack), and
    // an upsert alone never deletes. Same rule seed:sentences learned in v0.4.
    //
    // Scoped away from the DAILY tips, which `tips:add` writes under this same source because it
    // is the same authorship. Those always carry a `daily-` slug (tips:add enforces it), so this
    // clears the evergreen set without ever eating a tip the /daily-pull skill wrote.
    db.prepare(`DELETE FROM tips WHERE source_id = ? AND id NOT LIKE '%:tip:%:${DAILY_TIP_PREFIX}%'`).run(SOURCE_ID);
    for (const t of TIPS) {
      insert.run({
        id: tipId(t.lang, AUTHORED, t.slug),
        lang: t.lang,
        date_added: AUTHORED,
        title: t.title,
        body_md: t.body,
        technique: t.technique,
        links: t.links ? JSON.stringify(t.links) : null,
      });
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  const byLang = TIPS.reduce<Record<string, number>>((a, t) => ({ ...a, [t.lang]: (a[t.lang] ?? 0) + 1 }), {});
  console.log(`  ✓ tips: ${n} evergreen (${Object.entries(byLang).map(([l, c]) => `${l} ${c}`).join(' · ')})`);
}
