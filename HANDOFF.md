# HANDOFF — continue the work from any machine

> **🌐 App đang chạy thật tại <https://nhhandevops.github.io/multilingual-studies/>** —
> mở trên điện thoại, "Thêm vào màn hình chính" là cài được; sau lần mở đầu tiên thì
> học offline hoàn toàn. Gói dữ liệu nằm trên GitHub Releases (CC BY-SA 4.0).
>
> **TL;DR (tiếng Việt):** Dự án đang ở **v0.9** (đã xong — **ứng dụng cài được, học offline**),
> và phần **triển khai thật của v1.0 đã xong** (Pages + Releases, xem "Current state").
> Mới nhất (2026-08-04): sửa xong **5 script kiểm thử còn đỏ**, và trong lúc đo đạc phát hiện
> **ba lỗi thật chưa ai báo** — nặng nhất là ứng dụng **tự tắt lời nhắc sao lưu dựa trên một
> bản sao lưu có thể không tồn tại** (bấm "Tải bản sao lưu" rồi huỷ tải là app im lặng suốt
> 7 ngày). Giờ app hỏi lại "đã lưu được file chưa?" và chỉ ghi nhận khi bạn xác nhận;
> xuất lỗi thì báo lỗi; trình duyệt từ chối quyền lưu trữ bền vững thì nói ra. Chi tiết trong
> "Current state". Gói dữ liệu mới nhất là **`2026.08.04-1`** (đã phát hành + deploy), có thêm
> bản tin ngày **2026-08-03**; **toàn bộ 19 script kiểm thử xanh hết — lần đầu tiên**.
> Lưu ý cho máy mới: dữ liệu daily nằm trong `build/staging.db`, **bị gitignore nên không đi theo
> repo** — máy nào chưa từng chạy daily pull thì chạy `pnpm ingest daily:all` rồi build lại pack,
> nếu không `/today` chỉ có kho VOA và `verify-v06` sẽ đỏ. Cách tự kiểm tra: xem mục `verify-v06`
> trong "Current state".
>
> Cập nhật cuối ngày 2026-08-04: đã chạy daily pull, pack **`2026.08.04-2`** đang live. Việc cắt
> bản này lộ ra **ba lỗi thật của quy trình hai máy** và cả ba đã được vá — nặng nhất là **hai máy
> đúc ra cùng một tên phiên bản pack cho hai nội dung khác nhau**, mà app lại so sánh đúng chuỗi
> tên đó để biết có bản mới, nên người dùng giữ bản kia sẽ bị báo "đã mới nhất" vĩnh viễn.
> Từ nay có sổ **`packs.lock.json`** (được commit) giữ chỗ tên đã dùng; `pack publish` **từ chối**
> tái dùng tên cho nội dung khác. **Luôn `git pull` trước khi chạy `/daily-pull`** — sổ chỉ bảo vệ
> được nếu máy bạn đã đồng bộ. Chi tiết ở đầu "Current state".
>
> **Cập nhật 2026-08-11 — pack `2026.08.11-1` đang live.** Chuyện hai máy **đã được quyết, không
> code vòng nữa**: từ nay **chỉ máy Windows `d:\Non-work\multilingual-studies` được publish pack**;
> máy khác cứ pull code, chạy app, chạy script kiểm thử, nhưng không `pack publish`. Ngay lần
> publish đầu theo luật đó, kho tin **175 → 274 mục** (lấy lại phần bị cắt), tips **17 → 18**.
> Phiên này chạy `/daily-pull` **và** `/curate-pack` cùng lúc để cả hai vào CHUNG một pack.
> Ba lỗi thật tìm được, không lỗi nào có ai báo:
> **(1)** cổng ID-churn **không nhìn thấy** ID biến mất so với bản đang chạy thật (nó chỉ so với pack
> cũ nằm trong `build/` của chính máy đang build) — một tip do máy kia viết suýt bị xoá im lặng,
> đã cứu lại **từ chính bytes đã publish**, đúng ID cũ; **(2)** "từ của ngày" **có thể trỏ vào một từ
> không có nghĩa nào**, và `pack verify` cho qua — `en:w:cefrj:media` đã ship thật 2 ngày, mặt sau
> thẻ trống; **(3)** gloss tiếng Anh hay **dẫn nghĩa phụ trước** (4/10 mẫu), nặng nhất là
> `resilience` **không hề có nghĩa về con người**. Thêm: giấy phép 8.918 clip tiếng Trung ghi
> `CC BY-SA 3.0` nhưng **nguồn chưa bao giờ nói phiên bản nào** (README chỉ ghi "CC-by-sa", trang gốc
> đã chết). Sổ sự cố mới: [docs/warning_bug_and_solutions.md](docs/warning_bug_and_solutions.md).
> ⚠️ **Sáu ngày 08-05 → 08-10 không pull là mất hẳn** (nguồn là feed trực tiếp, không có kho lưu):
> cửa sổ 30 ngày nào chứa đủ sáu ngày đó cũng chỉ còn tối đa 24 lần < 25, nên **đồng hồ cổng v1.0
> tính lại từ 2026-08-11**.
>
> **👉 Việc tiếp theo, ai cầm máy nào cũng làm được** (xem mục "Next up" để có chi tiết):
> **(1) Thử trên iPhone thật** — đây là tuyên bố CUỐI CÙNG của v0.9 chưa ai kiểm chứng, và
> **không script nào thay thế được** vì bản chất là hành vi Chrome không tái hiện. Bảng 6 bước
> đã viết sẵn trong "Next up", chỉ cần một chiếc iPhone + Safari + Wi-Fi, không cần cài gì trên
> máy tính. **(2) Chạy `/daily-pull` mỗi sáng** — đây chính là cổng v1.0 (30 ngày, ≥25 lần), và
> là phần duy nhất không thể rút ngắn bằng code.
> Ngay sau đó là một **đợt sửa UX** (2026-08-03, cùng ngày): tab đang mở giờ có highlight,
> mỗi màn hình có một câu hướng dẫn, màn hình **không còn báo sai "không có dữ liệu"** lúc đang
> tải (trước đây `/review` từng nói "bộ thẻ trống" với người ĐANG có thẻ), thanh điều hướng
> không còn tràn ngang trên điện thoại (219px ở màn 390px → 0px), và bảng IPA hết chồng chữ +
> hết 13 nút trùng nhau không phân biệt được. Chi tiết: [docs/UX-FIXES.md](docs/UX-FIXES.md).
> Cài vào màn hình chính điện thoại rồi học khi không có mạng: service worker giữ vỏ ứng dụng,
> dữ liệu nằm sẵn trong máy. **Gói dữ liệu tách đôi**: bản chính còn **56 MB** (trước là 130 MB) —
> đủ tra từ, câu ví dụ, ngữ pháp, tập viết, bảng pinyin có tiếng; **gói âm thanh 74 MB** (giọng
> người thật cho ~10.000 từ Trung/Pháp) là **tuỳ chọn**, tải thêm khi muốn, xoá lúc nào cũng được.
> Chưa tải thì từ vẫn đọc bằng giọng máy có nhãn TTS — không bao giờ giả vờ là giọng thật.
> Kèm: nhắc sao lưu hằng tuần, xin quyền lưu trữ bền vững, biểu ngữ báo có bản mới, và hướng dẫn
> "Thêm vào MH chính" cho iPhone/iPad.
>
> Trước đó, v0.8 — **thống kê & dự báo**:
> Mục `/stats`: vốn từ của bạn so với **thang HSK/CEFR** (thanh tiến độ theo từng cấp), và **mô
> phỏng tải ôn tập** chạy bằng chính FSRS-6 — kéo thanh trượt "7 từ mới/ngày" là thấy ngay:
> ~68 lượt ôn/ngày ≈ 15 phút, phủ hết từ vựng HSK1–3 khoảng **tháng 6 2027**. Kèm mốc giờ
> Cambridge/FSI với ghi chú cho người Việt (2.200 giờ tiếng Trung là TRẦN — thanh điệu đã có sẵn,
> ~60% từ vựng Việt gốc Hán). Và chính các cặp gốc Hán đó giờ nằm trên thẻ: **8.342 từ tiếng
> Trung** hiện **từ Hán Việt có kiểm chứng** (大学 → đại học, 注意 → chú ý) — chỉ những cặp
> từ điển Wiktionary xác nhận là từ Việt thật, không ghép âm bừa (手机 KHÔNG có, vì "thủ cơ"
> không phải tiếng Việt).
>
> Trước đó, v0.7 — **từ vựng nghề IoT**:
> Mục `/tech`: **161 thuật ngữ** IoT/nhúng/mạng/bảo mật, mỗi khái niệm hiện tên ở **bốn thứ
> tiếng** — firmware / 固件 / firmware (micrologiciel) / Phần sụn — kèm định nghĩa tiếng Anh
> (Wikipedia hoặc NIST) và nút ＋ đưa thẳng vào bộ thẻ ôn tập (bộ thẻ "Nghề" riêng, không ăn vào
> hạn mức từ mới của ba thứ tiếng). Tên tiếng Trung **luôn là giản thể** (có cổng kiểm tra trong
> `pack verify`); ô nào trống là Wikidata thật sự chưa có tên — hiện là khoảng trống, không bịa.
> Phủ tiếng Việt: **134/161 (83%)**, trong đó 83 tên thuần Việt, còn lại là từ mượn (MQTT, GPIO…).
>
> Trước đó, v0.6 — **bản tin mỗi ngày**:
> Mục `/today`: tin tức thật, mới trong ngày, ở cả ba thứ tiếng — **VOA tiếng Trung** (miền công
> cộng), **Global Voices** tiếng Anh và tiếng Pháp (CC BY), và mục "tin vắn" của Wikipedia Pháp/Trung.
> Kèm theo: **160 bài đọc tiếng Anh phân cấp** từ kho VOA Learning English, **từ của ngày** lấy từ
> chính bài đọc hôm đó (bấm ＋ là vào bộ thẻ ôn tập), và **mẹo học mỗi ngày** (16 mẹo viết riêng cho
> người Việt). Chạy `/daily-pull` mỗi sáng để làm mới; không chạy thì màn hình vẫn dùng được.
> ⚠️ Một phần ba kho VOA Learning English **không phải miền công cộng** (bài lấy lại từ AP/AFP) —
> đã lọc bỏ tự động, xem bên dưới.
>
> Trước đó, v0.5 — **ngữ pháp**:
> Mục `/grammar`: **573 điểm ngữ pháp HSK chính thức** (chia cấp HSK1→7-9, đọc offline được),
> **toàn bộ 130 trang** Tex's French Grammar (có vài bài kèm giọng đọc thật), và 17 chương
> ngữ pháp tiếng Anh từ Wikibooks. Chỗ nào bị giấy phép cấm đóng gói (Chinese Grammar Wiki,
> CC BY-NC-SA) thì **chỉ để liên kết ra ngoài** — và chỉ liên kết khi trang đó có thật.
>
> Trước đó, v0.4 — **câu ví dụ + âm thanh**:
> Mỗi thẻ có câu ví dụ thật (68.683 câu Tatoeba, có pinyin và bản dịch tiếng Anh) ·
> 7.211 từ HSK và 2.782 từ Pháp A1–B1 có giọng người thật · từ nào không có bản thu thì
> đọc bằng giọng máy (TTS), kể cả câu ví dụ — nên **không từ nào là câm**.
> v0.3 trước đó: xem 好 tự viết rồi tự tô · tô chữ `é` · nghe đủ 1.707 âm tiết pinyin ·
> luyện thanh điệu · bảng IPA có hình cắt dọc.
> ⚠️ Gói dữ liệu nay **tách đôi**: bản chính **56 MB** (bắt buộc) + gói âm thanh **74 MB**
> (tuỳ chọn) — xem "Pack size" bên dưới.
> Trên máy mới: `pnpm install` → `pnpm ingest seed:all` → `pnpm pack:build` → `pnpm ingest pack publish` → `pnpm dev`.

Keep this file current: update the **Current state** and **Next up** sections at the end of every
working session, and commit it with the session's push. It is the single source of truth for
"where were we?" on a fresh clone.

## Current state (updated 2026-08-11)

- **Pack `2026.08.11-1` is live, and this clone is now the ONE machine that publishes.** The
  two-machine question left open on 2026-08-04 was decided rather than coded around: the Windows
  clone at `d:\Non-work\multilingual-studies` publishes; other clones pull code, run the app and run
  acceptance scripts, but never `pack publish`. Recorded as a rule in [CLAUDE.md](CLAUDE.md).
  The first publish under that rule **restored the archive the alternation had been eating**:
  daily items **175 → 274**, tips **17 → 18**. Core 56.5 → **56.6 MB** gz, media steady at 74.1 MB.
  - **Why nominating a machine was the right call and not laziness.** `staging.db` is 249 MB here
    and is the real database; the ledger shows the alternation cost 212→166 and 238→175. Making
    staging portable was the alternative and it is still open, but it is a per-clone 249 MB
    download for a problem that one sentence in CLAUDE.md removes entirely.
  - **This session ran `/daily-pull` and `/curate-pack` together on purpose**, so both landed in ONE
    pack instead of two. Curate's data step (prune) runs before the pull's build; there is nothing
    else to sequence.

- **The ID-churn gate cannot see IDs that vanished relative to what is LIVE — and one already had.**
  This is the most important finding of the session, because `tips` sits *inside* that gate and was
  therefore believed safe.
  - `findPreviousPack(packsDir, …)` compares against the previous pack in the **local**
    `build/packs/`. `build/` is gitignored. So on a two-machine setup the gate compares this clone's
    new pack against this clone's old pack — a tip authored on the other clone was never in either,
    and 0 of 0 vanished is a pass.
  - Measured: the live pack `2026.08.04-2` carried **17 tips**, this clone's staging held **16**.
    `words` (147,261), `grammar_topics` (720) and `tech_terms` (161) were identical, so `tips` was
    the only divergence — but publishing blind would have silently deleted a hand-written tip.
  - **Recovered from the published bytes, not retyped from a description.** `gh release download`
    → stream-gunzip → read `tips` → diff against staging. `tips:add` takes an optional `date`
    (`assertIsoDate`, not the new `assertPullDate`), so `tipId(lang, date, 'daily-'+slug)` lands
    back on the **original id** `fr:tip:2026-08-04:daily-tu-viet-giong-doc-khac`. Re-adding, not
    re-creating.
  - Not fixed in code. The fix is for the gate — or `pack publish` — to compare against
    `packs.lock.json`/the newest release rather than the local directory. See "Next up".

- **`daily_plan` can point at a word with NO senses, and `pack verify` passes it.** The verify gate
  only asks whether the word exists (`NOT EXISTS (SELECT 1 FROM words …)`). A word row with zero
  `senses` satisfies that, so "word of the day" ships a card whose answer is blank.
  - Already shipped: **`en:w:cefrj:media`**, planned on 2026-07-31 and 2026-08-01.
  - Scale of the class: levelled words with zero senses — **en 289/8,648 (3.34%)**,
    **fr 100/5,000 (2.00%)**, **zh 0**. The French ones are overwhelmingly inflected forms and
    determiners (`ma`, `toute`, `ceux`, `uns`, `chacune`): Lexique lists word FORMS, the gloss
    source (kaikki) has LEMMA entries, and nothing joined them.
  - Worked around for this pull by checking all 18 planned words before `daily:select`; the gate
    itself is not written yet.

- **The English glosses lead with the wrong sense often enough to matter.** 30 random glosses
  (10 per language): zh 10/10 and fr 10/10 sound, **en 4/10 lead with a rare or technical sense** —
  `discovery` (B1) with the *legal-disclosure* sense, `smash` with "a conspicuous success",
  `elevation` with the astronomy sense, `impulsive` with the physics sense. Cause: senses come from
  Open English WordNet, whose sense order is not frequency-ordered.
  - Worst case found while curating: **`resilience` has no human sense at all** — both its senses
    are material elasticity, while the article that surfaced it means "recovering from disaster".
    It was dropped from the day's words for that reason, along with `cocoa`, `shed`, `fortement`
    and `lesquelles` (the last has zero senses, per the bug above).
  - No data change yet; this needs a decision on sense ordering, not a patch.

- **Licence audit at the artifact (curate step 1): `audio-cmn` / `audio-cmn-hsk`, 8,918 clips.**
  Chosen because a single blanket licence string over thousands of files is the exact shape of the
  v0.4 Lingua Libre bug. Result: the blanket string is *probably* fine — one collection, two named
  speakers — but **the version we assert is not the source's**.
  - The README says literally `CC-by-sa`, **no version**, and defers to
    `packs.shtooka.net/cmn-caen-tan/readme.txt`, which is **dead**. The repo has no LICENSE file
    (GitHub's licence API 404s). Our DB stamps `CC BY-SA 3.0` on all 8,918 rows — our inference.
  - `shtooka.net` has changed squatters again: the ledger recorded a 301 to us-stemcell.com on
    2026-07-29; on 2026-08-11 it serves HTTP 200 as *"Copyright © 2020 Xoilac TV"*.
  - The Wayback Machine returned **429 to every request** from this network, so the true version is
    **unresolved**, and that is written down rather than guessed. Correction filed in
    [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md); the 8,918 data rows are unchanged pending
    a decision.
  - Contrast kept in the ledger: `lingualibre-fra` after the v0.4 fix carries **four** per-file
    licences (CC0 1,870 · CC BY-SA 4.0 902 · CC BY 4.0 9 · CC BY-SA 3.0 1).

- **Source liveness (curate step 4): all three daily sources current; VOA English still frozen.**
  The pull itself is the evidence — 28 items, **0/3 sources failed**, newest VOA-zh 11 Aug, GV-en
  11 Aug, GV-fr 10 Aug, both wiki-itn revisions fresh. VOA Learning English has **not** revived:
  newest item **468 days old** (`voanews.com/api/epiqq` 513 days). No version-scoping change.
  Prune (step 3) removed nothing — the 90-day cutoff is 2026-05-13 and the oldest daily row is
  2026-07-31. The 160-article VOA archive is never pruned.

- **A new operational trap, and it is this machine, not the code: `pnpm -r typecheck` dies with
  exit 134.** `FATAL ERROR: … JavaScript heap out of memory` reads like a compile failure in
  `apps/web`. It is not: free RAM was **0.97 GB of 15.8 GB** (VMware 1.6 GB + VS Code 0.9 GB +
  Brave ~3.5 GB). The same `tsc --noEmit` run directly in `apps/web` while memory was available
  passed **clean**. PowerShell's `Out-String` throws `OutOfMemoryException` under the same pressure,
  which is why the ingest commands in this session ran through Bash. Recorded with the rest in the
  new [docs/warning_bug_and_solutions.md](docs/warning_bug_and_solutions.md) (the file the global
  rules ask for; it did not exist until now).

- **The 2026-08-05 → 2026-08-10 gap is unrecoverable, and it resets the v1.0 clock.** Six days with
  no pull, and `assertPullDate` correctly refuses to invent them. Arithmetic worth stating once: any
  30-day window containing all six missed days holds at most 24 pull-days, which is below the gate's
  ≥25. **The earliest window that can pass therefore starts 2026-08-11.**

## Current state (updated 2026-08-04, later)

- **Daily pull for 2026-08-04 shipped, and cutting it exposed three real defects in the
  two-machine workflow.** Pack `2026.08.04-2` is live (release `pack-2026.08.04-2`, deploy green,
  `verify-v10-live` PASS). 9 curated items (3 per language), 24 planned words, and a French tip on
  homographs (*est · plus · fils · tous · sens*). But the pull was cut from the **second clone**,
  and that is where everything below came from. New committed file: **`packs.lock.json`**.
  - **Two clones minted the same pack version for different content.** `nextPackVersion` counted
    `-N` from the local `build/packs/` directory only — and `build/` is gitignored, so this clone
    started the counter from scratch and produced a `2026.08.04-1` while a *different*
    `2026.08.04-1` (sha `ee622228…` vs `6643d065…`) was already published. **The app compares the
    version STRING in its update check**, so shipping that would have told anyone holding the
    other pack that they were permanently up to date. Caught before publication; this release is
    `-2` for that reason. Fix: `packs.lock.json`, a committed ledger of published versions.
    `pack build` skips reserved names; `pack publish` **refuses** to reuse a name for different
    bytes and is idempotent for identical bytes. Backfilled with all four released packs.
  - **`daily:all --date <past>` fabricates data, and now refuses.** Every source is a live feed
    with no archive, so `--date` never selected a day's news — it only chose which day the current
    fetch was *filed under*. Trying to recover the missing days this way filed 27 of today's
    articles under 2026-08-03. They were removed with `daily:select` (empty `keep`), which is the
    documented undo. `assertPullDate` in [lib/daily.ts](apps/ingest/src/lib/daily.ts) now rejects
    past and future dates on the PULL commands only — `daily:select`/`daily:candidates` still take
    a past date, because editing rows that exist invents nothing.
  - **A pack can silently lose daily history, and already had.** `build/staging.db` is gitignored,
    so whichever clone builds publishes only the days *it* pulled: this pack has 175 daily items
    where the previous had 238. `pack verify` cannot catch it — its ID-churn gate deliberately
    excludes `daily_items`. Checking the ledger showed the same thing had happened before and gone
    unnoticed: **212 → 166 between `2026.08.03-1` and `2026.08.03-2`**. `pack publish` now warns
    on any decrease. It is a warning, not an error: a `/curate-pack` prune is a legitimate shrink,
    and the lost items are unrecoverable either way — what mattered was that nobody was told.
  - **Also fixed in the skill:** it hardcoded a repo path from another machine
    (`d:\Non-work\multilingual-studies`), and `pnpm ingest <cmd> --file X` does not work here at
    all — the root `ingest` script ends in `--`, which pnpm forwards literally, so commander reads
    `--file` as an operand and reports it missing. Both commands in the skill now bypass the
    wrapper.
  - **Open, and it needs a decision rather than more code:** the pack pipeline is effectively
    single-machine. `staging.db` is the real database and does not travel, so alternating which
    clone publishes will keep trimming the daily archive. Either nominate one publishing machine,
    or make staging portable (it is ~156 MB — a release asset would work, at the cost of a large
    download per clone).

## Current state (updated 2026-08-04)

- **The five red acceptance scripts are fixed — and the README's diagnosis of three of them was
  wrong.** After the UX pass this suite stood at 14 of 19 with the failures recorded as
  "pre-existing", which is true but was never a root cause. Measuring them produced two test
  bugs and **three product bugs nobody had reported**. Script for the new ones:
  `tools/e2e/verify-backup-honesty.mjs`. Suite now **19 of 20**, with the one gap explained below.
  - **The download tests were clicking the wrong button.** The README guessed "the browser
    profile blocks the `user.db` backup download". It does not: a real export delivers a
    65,536-byte file whose header is `SQLite format 3\0`, in headless AND headed Chrome, and
    Chrome's own DownloadManager reported `completed` on 5 of 5 attempts. The real cause is that
    `:first-of-type` is scoped to an element's OWN parent, so the DESCENDANT selector
    `.backup button:first-of-type` began matching TWO buttons the day v0.9 added
    `StorageStateLine` inside `.backup` — and `page.click()` is non-strict, so it silently took
    the first in document order: "Bảo vệ dữ liệu". Instrumented with capture-phase listeners
    rather than inferred. The export button now carries `className="export-backup"`.
  - **The app was silencing its own backup reminder on a backup that may not exist.** `onExport`
    wrote `last_backup_at` immediately after `a.click()`. An anchor download reports nothing
    back — cancelled, blocked and saved are the same event — so cancelling the download made
    `.backup-nag` disappear and STAY gone across a reload. Measured with `download.cancel()`.
    `user.db` is the only irreplaceable data in this product and this reminder is PLAN risk #3's
    entire mitigation. The export now records the ATTEMPT under its own key,
    `backup_export_pending_at`, and **the learner confirming they have the file is the only
    writer of `last_backup_at`.**
  - **The first version of that fix was itself wrong in four ways, and a review of the diff
    caught all four.** Worth reading before touching this code again, because two of them
    re-created the exact bug being fixed:
    - It wrote the export attempt into `backup_nag_snoozed_at`, a key that already meant "the
      learner pressed Để sau". Throwing away the one fact we had left the reminder unable to say
      anything true: measured, it repeated *"Đã hơn 7 ngày chưa sao lưu"* 25 hours after an
      export, on 6 days out of 7 — one dishonesty swapped for another, and an alarm a learner
      would train themselves to click past. The attempt now has its own key, and the nag branches
      on it: *"Bạn vừa tải bản sao lưu nhưng chưa xác nhận là đã lưu được file"* with a one-click
      **Rồi, đã có file**.
    - `onBackupConfirmed` had **no catch and cleared the prompt before awaiting** — so a failed
      write on the app's ONLY writer of `last_backup_at` left the learner with the file on disk,
      no message, and nothing left to click. That is bug (1)'s description verbatim, inside the
      function added to fix bug (1).
    - The snooze write shared a `try` with the download, so a failed settings write reported
      *"Không tạo được bản sao lưu"* for a file that **had** downloaded, and removed the
      confirmation with it. Producing the file and recording that we produced it are now separate
      blocks with separate messages.
    - The confirmation was `useState` in `Review`, so **one route change destroyed it** and the
      backup became unrecordable. It is now derived from settings on every refresh, and the nag
      carries the same one-click answer from anywhere in the app.
  - **The trade is deliberate and worth restating**: the reminder can now appear the day after an
    unconfirmed export. That is correct — it is a true statement with a one-click answer, not a
    repeat of an alarm already acted on. A reminder that returns is a smaller failure than one
    that never returns at all.
  - **A failing export said nothing.** With blob creation made to throw, the screen was
    byte-identical before and after the click while the rejection escaped as an unhandled
    `pageerror` — the handler is invoked as `void onExport()`. It now reports the reason, the way
    the import path always has.
  - **"Bảo vệ dữ liệu" was a silent no-op on denial** — `ensurePersisted()` returns the resulting
    state and `StorageStateLine` threw it away, so a browser saying no produced a
    character-identical panel. This is the button the three broken tests had been clicking since
    v0.9, and its silence is why the failure looked like a download problem.
  - **A picker-based fix was proposed, measured, and rejected.** `window.showSaveFilePicker` is
    the only web API that reports save-vs-cancel, but headless Chrome 150 EXPOSES it and rejects
    with `AbortError`, so "if it exists, call it; on AbortError return silently" would have made
    export a silent no-op in the harness and re-broken the three scripts with the same invisible
    signature as the bug being fixed. `AbortError` also cannot distinguish "user cancelled" from
    "no picker can be shown". Presence-based feature detection was not enough.
  - **Two scripts were machine-specific, which the e2e README explicitly forbids.**
    `verify-upgrade-v02-to-v03` hardcoded pack versions that exist only on the machine that built
    them (bare `ENOENT` anywhere else); it now derives the pair from pack CONTENT and, as a
    bonus, exercises a longer upgrade path than before (v0.1-era pack → the v0.9 split pack).
    `verify-v04-p1` imported `newestPack` and never called it — the v0.7 stale-pack trap, still
    live in one file.
  - **`verify-v06` is a DATA PREREQUISITE, not a defect — and what it needs differs per clone.**
    `build/staging.db` is gitignored, so daily content never travels with the repo: a clone that
    has only run `seed:all` holds the seeded VOA archive and zero rows from the `daily:*`
    modules. The script now fails with the command that fixes it (`pnpm ingest daily:all`, then
    rebuild the pack) instead of "expected daily content in all three languages", which read
    like a regression. **This is a property of a CLONE, not of the product** — do not write it
    into this file as a fact about "this machine", which is what the first version of this note
    did and what made it false on the very next machine to read it.
    Tell which case your clone is in before running anything:
    `node -e "const D=require('./apps/ingest/node_modules/better-sqlite3');const db=new D('build/staging.db',{readonly:true});console.log(db.prepare('SELECT source_id,count(*) n FROM daily_items GROUP BY source_id').all())"`
    — a listing with only `voa-learning-english` is the seed-only case, and it owes
    `daily:all` → `pack:build` → `pack:verify` → `pack publish`.

- **The outstanding pack chore is DONE, and the suite is 19/19 for the first time.** (2026-08-04)
  The Windows clone had a 2026-08-03 pull sitting in staging that no published pack carried —
  `2026.08.03-1` stopped at 08-01. Rebuilt, verified and published as **`2026.08.04-1`**
  (daily items 212 → **238**; the 08-03 day is 5 EN · 10 FR · 11 ZH), released as
  `pack-2026.08.04-1` and deployed. Core still 56.5 MB gz, media 74.1 MB gz.
  - **Every acceptance script now passes at once — 19 of 19**, dev server for the seventeen and
    the static server for `verify-v09` + `verify-upgrade-v02-to-v03`. The five that the UX
    session had recorded as "pre-existing failures" are green on their real fixes (this session
    only confirmed them), and `verify-v06` is green because this clone now ships the daily
    content it needs. Nothing in the suite is skipped or tolerated.
  - **Two testing lessons, both paid for.** The acceptance script now checks the export result is
    *in the viewport*, not merely in `main.review`'s `textContent` — the messages were rendering
    ~800 px above the button that produced them, which is the state-layer bug re-created in the
    layout, and a `textContent` assertion is satisfied by an invisible message. And its
    failure-injection **counts its own hits on `window`**: the first version keyed on `msg.args`
    when the field is `params`, matched nothing, and reported a clean pass for a case it never
    exercised. An injection that silently matches nothing looks exactly like a product that
    handled the failure.

- **UX pass shipped — four reported defects, and the three worse ones under them.** A user
  reported: no active-tab highlight, no per-screen guidance, blank frames while loading,
  overflowing IPA chips. Auditing each against the code (and measuring the header in a real
  Chrome) found every one sitting on something more serious. Plan and reasoning:
  [docs/UX-FIXES.md](docs/UX-FIXES.md). Script: `tools/e2e/verify-ux.mjs`.
  - **The app was stating something FALSE, not merely looking unfinished.** Six screens
    initialised list state to `[]` and treated emptiness as "there is nothing here", so the
    pack's genuine empty-state message rendered during the first query: `/write` said "Không có
    chữ nào cho lựa chọn này" (the reporter's screenshot), and **`/review` told a learner who
    HAS cards that their deck is empty** — `[].every()` is vacuously true. `null` now means
    "not answered yet", `[]` means "genuinely empty". The pattern already existed here
    (ipa/pinyin/tones used `T[] | null`; today.tsx even carried a comment explaining this exact
    bug class) and was simply never applied uniformly.
  - **Every null sentinel got a failure path.** Without one a rejected query turns a
    wrong-but-terminal message into a PERMANENT spinner. write.tsx caught only to set `tooOld`;
    browse/grammar/today/review/tech had no `catch` at all.
  - **On a phone, four tabs were unreachable.** `header.top nav` had no wrap and no overflow, so
    the strip's intrinsic 593px sat in a 358px column: the page scrolled sideways **219px** at
    390px and the last four tabs were off-screen. Now a horizontal scroller that auto-centres
    the lit tab — **0px overflow at 360/390/430/780/1280**. `overflow-x: auto` is load-bearing
    beyond scrolling (it releases the min-content floor), which the CSS says so a later cleanup
    cannot silently undo it.
  - **The IPA chart had 13 indistinguishable buttons, not 7 overflowing ones.** Six glyphs are
    duplicated — ǃ×3, s/ʃ/z ×2 (apical vs laminal), voiceless×2, pulmonic×2 — and the four
    consonant collisions are **correct IPA that no data fix could separate**, so the view now
    carries a short caption. The seven word-glyphs get Vietnamese names via `t(key, packFallback)`.
    `aria-label` goes only on captioned chips: on a word chip it would replace the visible
    Vietnamese with raw English (WCAG 2.5.3, and the Vietnamese-first rule reversed for AT users).
  - Also fixed in passing: **white on the dark-theme accent is 2.2:1** — a contrast failure on
    every active chip in the app, not just IPA.
  - **`verify-ux.mjs` closes a gap nothing else checked: vi/en key parity** (234 keys). A key
    landing in one file only would have shipped the literal string `browse.intro` to the other
    language while every existing script passed.
  - **Two test-quality lessons, both earned.** The first "no data while loading" check passed on
    an EMPTY deck, where the message is simply true — it now seeds a card first. And
    `verify-v06` waited on the ABSENCE of "đang trống", a predicate that only worked while the
    loading state rendered the empty message; the spinner satisfied it instantly. A predicate
    that passes on a state you are not waiting for is not a wait.
  - **Suite status: 14 of 19 green.** The 5 that fail were measured as PRE-EXISTING by restoring
    `apps/web/src` + `tools/e2e` to the commit before this work and re-running — three are a
    blocked `download` event, two assume a word recording that v0.9 moved into the optional
    media pack. Recorded in [tools/e2e/README.md](tools/e2e/README.md) with the fix for each,
    along with the trap that cost a full run: the pre-v0.9 scripts hardcode `localhost:5173` in
    their off-origin allow-list, so running them against the static server reports the server's
    own URLs as off-origin.

- **v1.0's deploy half is DONE — the app is live.** <https://nhhandevops.github.io/multilingual-studies/>
  serves pack `2026.08.03-1` from GitHub Pages; packs are release assets on
  `pack-2026.08.03-1` (see "Release flow" below). The first-ever `deploy-pages` run went
  green in 35 s — but only because a pre-flight adversarial review (12 agents) caught four
  real defects in the never-run pipeline first, all fixed in `fb047b1`:
  - **`createdAt` is the TAG COMMIT's date, not the publish date** — the release-selection
    jq provably picked v0.9's stale packs over the newer `pack-2026.08.03-1` (both carry
    `manifest.json`; the inversion already existed in the live repo). Now `publishedAt`.
  - **A release mid-upload passes a manifest-only check**: `manifest.json` (750 B) finishes
    uploading long before the 74 MB `media.pack`, and `gh release download` exits 0 on a
    partial match. Selection now requires all three assets in `state == "uploaded"`, and the
    downloaded files are asserted non-empty.
  - **workbox's precache glob is case-sensitive on Linux** (`nocase` defaults false on
    posix): the Windows build precached `licenses/ARPHICPL.TXT`, the ubuntu-latest deploy
    build silently dropped it — the Arphic licence text 404'd offline, exactly the file the
    licence obliges us to ship. `TXT` added to the glob; single entry on both platforms.
  - **The needsAppUpdate banner was a dead-looking two-click update**: it polled
    `getNeedRefresh()` right after `reg.update()` resolves — which is at "installing",
    before the new SW precaches and reaches "waiting" — so the check was always false and
    the reload re-served the OLD shell. `checkForUpdate()` now reports whether an SW
    handled it; the banner reloads only when none did (dev/unsupported).
  - **The auto-created `github-pages` environment only allowed branch `main`**, so a
    tag-triggered deploy was REJECTED at the environment gate — the `v*` tag rule was
    added by hand (2026-08-03, see "Release flow"; the API call is permission-gated, so
    the owner ran it). The first deploy ran via manual `workflow_dispatch`; the `v1.0`
    tag push then exercised the tag-triggered path for real.
  - **Verified live**: `tools/e2e/verify-v10-live.mjs` — packs served next to the shell, a
    COLD deep link to `/stats` boots through Pages' `404.html` fallback and the router
    resolves it under the non-root base (a path no local script runs at), the SW takes
    control after reload, 0 off-origin requests, and the only console entry is the
    document-level 404 that IS how Pages serves a SPA fallback. `verify-v09.mjs` re-run
    green against the patched shell. **What remains of v1.0 is the gate itself**: the
    30-day habit, plus the real-iPhone test.

- **v0.9 shipped — "Real PWA".** The app installs to a home screen, boots and runs a full
  session with no network, and the 130 MB pack is finally split. Pack `2026.08.03-2`.
  - **The split, and where the line falls.** Word-pronunciation blobs (9,991 clips, 78 MB raw)
    move to an optional `media.pack`; everything else stays in `content.pack`, which drops
    **130.5 → 56.4 MB gz**. The line is `audio.kind`, chosen so no core surface goes silent:
    the 1,707 pinyin-chart syllables and Tex's grammar clips stay in core (v0.3's acceptance
    asserts the chart plays, and a silent chart would be a regression), as do the sagittal SVGs.
    The whole `audio` METADATA table stays in core too — the app must know a recording exists to
    offer the download, and the CC BY credit has to ship wherever the clip is referenced.
    It is a build-time decision only ([build.ts](packages/content-pack/src/build.ts)): staging
    keeps every blob, no seed re-ran, no schema changed, and audio IDs are untouched, so the two
    files stay joinable and `pack verify` checks them as a PAIR (ATTACHed, cross-file).
  - **The TTS label cannot lie.** `getWordAudio` now confirms the blob is actually reachable
    before reporting a recording, so a metadata row whose bytes are not installed presents as
    "no recording" and the button shows the labelled synthetic voice. The media nudge appears
    only on words that really have a recording we cannot currently play.
  - **A real dead-end was found and fixed, not documented away.** Playing a word and then
    reloading left the app on the storage-locked screen — the outgoing document keeps the pool's
    exclusive OPFS handles for ~20 s (measured), and once `installOpfsSAHPoolVfs` has failed once,
    retrying inside that document never succeeds. The app now releases audio on `pagehide`, asks
    its worker to terminate on a real unload, and — the part that actually works — reloads itself
    once, guarded by `sessionStorage`. `verify-v09.mjs` plays a clip before its reload precisely
    so this stays fixed.
  - **Service worker precaches the app shell ONLY** (18 entries, 1.8 MB: JS/CSS/wasm/icons/
    ARPHICPL.TXT). `/packs/*` is NetworkOnly and excluded from precache and from the SPA
    fallback — OPFS is the pack cache, and a second copy of 130 MB in the Cache API would be
    both wasteful and a way to poison a verified download. `registerType: 'prompt'`, so a new
    shell never swaps mid-review; the update banner offers it.
  - Also: `storage.persist()` requested on the first user.db WRITE (not at boot — a new learner
    has nothing to lose and the prompt is noise), a weekly backup nag that clears itself when
    you actually export, a post-boot update check (visibility + 15-min tick, throttled hourly),
    runtime `minAppVersion` enforcement with its own screen, an iOS Add-to-Home overlay, and
    `.github/workflows/deploy.yml` for GitHub Pages (never run yet — see "Next up").
  - **Verified**: `verify-v09.mjs` (pack-split gates incl. mp3 magic on sampled blobs, in-place
    upgrade from the v0.8-format pack with cards/streak intact, media absent → labelled TTS,
    media installed → real voice plays, webmanifest + SW control, a full offline session, zero
    off-origin requests) and `verify-v08.mjs` re-run green against the split pack.
  - 15 findings from an adversarial review of the client-side commit were fixed first, including
    one that broke the production build outright (`workbox-window` was never declared) and two
    that only bite under a deploy base path (`./favicon.svg` resolves against the current ROUTE;
    `license_url` values are root-relative and need `import.meta.env.BASE_URL`).

- **v0.8 shipped — "Stats + forecast".** A `/stats` screen (dashboard · simulator · anchors) and
  **8,342 attested Sino-Vietnamese cognates** on the zh vocabulary — the `sv_cognate` column that
  had been NULL since v0.1. The roadmap clause renders for real: *at 7 zh words/day you cover
  HSK1–3 vocabulary ~Jun 2027, ~15 min/day* (68 reviews/day, measured by simulation, not quoted
  from a rule). Pack `2026.07.31-11`: +0.2 MB, 30 sources.
  - **The cognates are ATTESTED, not composed — the version's defining decision.** A cognate is
    stored only when the Vietnamese word's own Wiktionary entry records "Sino-Vietnamese word
    from X" (the `vi-etym-sino` template in the kaikki.org Vietnamese extract, CC BY-SA). Both
    facts matter: the Vietnamese word EXISTS, and its descent from that exact Chinese word is on
    record. The tempting alternative — composing per-character Hán-Việt readings — was measured
    and rejected: 手机 composes to "thủ cơ" and 老师 to "lão sư", but Vietnamese says điện thoại
    and giáo viên. A reading that composes is not a word that exists. Result: 大学→đại học,
    注意→chú ý, 银行→ngân hàng… and 手机 correctly gets NOTHING.
  - **Unihan's kVietnamese was disqualified by measurement** before the design settled: 68%
    coverage of our 3,034 levelled characters with 電 (điện!), 学, 愛 simply absent, and Nôm
    readings mixed in unmarked. The ledger's [RECOMMENDED] for Unihan stands — for radicals and
    strokes; its Vietnamese field does not survive contact with the data. Ledger updated.
  - **Two traps in the chosen source, both measured** ([zh/sv-cognates.ts](apps/ingest/src/sources/zh/sv-cognates.ts)):
    the `vi-etym-sino` template's numbered args may be COMPONENTS (ngân hàng is {1:銀,2:行}), so
    the source word is the concatenation of all Han-carrying args — reading arg 1 alone both
    missed ngân hàng/chính phủ/công ti AND mis-attached điện thoại *viên* to 电话. And the match
    must be on the template, never the etymology text: the corpus contains "NON-Sino-Vietnamese
    reading of…" sentences that a text regex happily matches. Coverage: HSK1 196/508 · HSK2
    321/753 · HSK3 524/964 (the SV stratum is the abstract/formal vocabulary, so coverage RISES
    into the literary levels — consistent with the linguistics, not a bug).
  - The cognate rides `CardSnapshot.svCognate` (optional, additive — every earlier card still
    validates) and renders on the zh word page and the review answer, from the snapshot
    (invariant 6). For a Vietnamese learner it is the answer's strongest memory hook, so it
    renders above the glosses.
  - **The simulator RUNS FSRS-6, it does not quote the 10× rule** ([simulate.ts](packages/shared/src/srs/simulate.ts)):
    the same `rate()` wrapper, weights and 0.9 retention target that schedule real reviews,
    day by day over 365 simulated days, grades drawn from a seeded LCG so the same inputs give
    the same curve on every reload — a forecast that changes when you refresh is a mood. The
    simulation independently lands at **9.2–9.8× steady-state reviews per new card**, inside the
    research's 8–12× band: the rule of thumb is confirmed by the engine rather than assumed.
    ~350 ms per 365-day run, cached per slider value.
  - **Three kinds of number, labelled as what they are.** MEASURED: deck-vs-level-table bars
    (light = in deck, dark = reviewed at least once; denominators are the pack's own level
    counts) and the learner's seconds-per-card from their own history — used only past 50
    reviews, before that a default that SAYS it is a default. SIMULATED: the review load.
    ANCHORS: Cambridge GLH and FSI hours, quoted with the caveat that they assume an English
    speaker — for a Vietnamese learner the Mandarin 2,200 h is framed as a CEILING (tones are
    native equipment; ~60% of Vietnamese vocabulary is Sino-Vietnamese — the very pairs this
    version puts on the cards). The reach forecast is explicitly labelled VOCABULARY COVERAGE,
    not proficiency.
  - **The first e2e run failed its own test honestly**: the "set sliders to zh=7" assertion
    accepted any positive number, which the INITIAL 5/5/5 render already satisfies — it read 138
    (3×46) as if it were the zh=7 figure. The wait now requires the line to CHANGE from its
    captured initial state, in both the load check and the determinism check. A predicate the
    starting state already satisfies is a stub kinder than the real API.
  - Also fixed while building: the seed's first join ran a per-pair SELECT against the unindexed
    `alt_form` column — 147k-row scan × 13,866 pairs, killed at the ten-minute timeout — and was
    rewritten as one full-table read into maps (seconds).
  - Verified against pack `2026.07.31-11`: 大学 shows đại học on the word page, freezes it into
    a new card, and the review answer renders it from the snapshot; dashboard denominators equal
    the pack's level table and the just-added card is counted; the simulator is deterministic
    across reloads, its 7/day figure is 68 reviews ≈ 15 min/day, and the HSK-reach year matches
    the arithmetic; anchors carry the Vietnamese-adjustment framing. **0 off-origin requests,
    0 console errors. All 16 acceptance scripts pass.** Script: `tools/e2e/verify-v08.mjs`.

- **v0.7 shipped — "IoT vocabulary".** A `/tech` module over **161 curated concepts** in six
  domains (hardware 24 · electronics 28 · firmware 29 · networking 35 · security 20 · cloud 25),
  each showing its name in **four languages** with an English definition, per-term provenance, and
  a ＋ into its own SRS deck. The roadmap clause holds: *learn firmware/固件/micrologiciel with a
  Vietnamese label; drill in SRS*. Pack `2026.07.31-10`: 130.4 → **130.4 MB gz** (+0.05 MB — text
  is cheap), 29 sources.
  - **The term list is CURATED, not crawled** ([tech/terms.ts](apps/ingest/src/sources/tech/terms.ts)).
    NIST is 9,541 records of which 55% are acronym stubs and most of the rest is compliance
    vocabulary; Wikipedia's glossaries are organised by academic field. 161 hand-picked concepts an
    IoT engineer actually meets beat both — thin and correct, the v0.5 English-grammar call again.
    **The slug is ours and is the ID key** (`tech:t:iot:firmware`): Wikipedia renamed I²C → I2C
    live during recon, and an ID derived from the title would have forked and orphaned SRS state.
  - **Labels come from Wikidata (CC0), and the obvious implementation ships wrong data three
    ways** — all measured, all guarded now:
    (1) **the `zh` label is often traditional** (韌體, 編譯器 — whatever script the last editor
    typed). The seed requests `zh-hans` with `languagefallback=1`, which really converts and
    reports `source-language`. (2) **zh-hans itself is not a guarantee**: telemetry's zh-hans
    label is the mixed-script "遥測", typed into the simplified field by an editor. Labels AND
    aliases both pass the same screen — the lexicon-derived traditional-only character set from
    v0.4 — and a failing label is replaced by its first clean alias (遥测) or shipped as a gap
    (HSM). `pack verify` re-checks every zh label/alias against the same construction, so this
    cannot regress silently. (3) **`languagefallback` substitutes English silently**: a missing
    vi label arrives as `{value:"edge computing", language:"en", "for-language":"vi"}` under the
    `vi` key. The accept rule stores a label only when `language` is the requested one (or `mul`,
    Wikidata's explicit "identical everywhere" — Wi-Fi). Well-formed and untrue, v0.4's licence
    bug in a new field.
  - **Vietnamese coverage, with its counting rule beside it**: 134/161 terms (83%) carry a genuine
    vi-language label; 83 of those (52% of all terms) are Vietnamese prose (vi điều khiển, cảm
    biến, điện toán đám mây), the rest loanwords the vi community records verbatim (MQTT, GPIO,
    Raspberry Pi). **A gap ships as a gap** — the UI shows "chưa có tên trong tiếng này", never an
    English placeholder, because the gap is the true state of the data.
  - **The roadmap's own showcase was half wrong and ships honestly**: Wikidata's fr LABEL for
    firmware is "firmware" — *micrologiciel* is the fourth alias. Aliases ship too (they carry the
    everyday terms: 单片机 rides zh-hans, 传感器 rides aliases), so the quartet renders; the
    acceptance script asserts micrologiciel among label+aliases, not as the label.
  - **Definitions: glossary 60 · NIST 36 · article intro 65**, per-row provenance in a new
    `tech_terms.attribution` column (Wikipedia page + revid, or the NIST source publication —
    NIST asks for the citation; CC BY-SA wants the revision). Chain: Wikipedia's EEE/hardware/CS
    glossaries (median 92-char plain-English definitions) → NIST CSRC (authoritative, public
    domain, integrity-checked against its own `.meta` sha256 of the unzipped JSON) → the article's
    intro extract (guaranteed present). Two NIST traps fixed after the first run shipped them:
    a naive sentence-splitter broke on "(e.g.," and emitted a definition starting mid-phrase, and
    indexing a record's definition under all its abbrSyn expansions filed a definition of the
    Wireless Application Protocol under "wireless access point" — NIST's "WAP" record lists three
    UNRELATED expansions. Expansion keys are now used only when there is exactly one.
  - **Join hygiene** ([tech/vocab.ts](apps/ingest/src/sources/tech/vocab.ts)): batch 50,
    `redirects=1` always, correlate by title through `normalized[]`+`redirects[]` (the response is
    pageid-sorted, not request-ordered), and reject disambiguation pages by `ppprop` key presence —
    a bare "Node" resolves to a VALID QID whose labels translate "list of things called node".
    All 161 titles joined; risky ones are pre-qualified in the term list. The acceptance script
    re-checks a live sample of shipped QIDs for P31=Q4167410.
  - **Tech cards are the fifth deck.** `CardSnapshot.kind` gained `'tech'` and an optional
    `labels {zh,fr,vi}` field — both optional, so every card from v0.2–v0.6 still validates
    (the same additive pattern as v0.3's `kind` and v0.4's `example`). Cards store `lang='tech'`:
    a separate deck with its own daily budget, so drilling job vocabulary never eats the zh/en/fr
    allowance — and `review.tsx`'s LANGS list is exactly where v0.3's note said a new content lang
    must be added. The review answer renders vi/zh/fr labels from the snapshot (invariant 6); the
    prompt speaks with an English voice ('tech' matches no speech-synthesis voice).
  - `/tech` searches ACROSS languages — typing 固件 or 单片机 finds the English row, which is what
    an engineer who half-remembers a name actually does. Aliases are searchable for the same
    reason they are displayed.
  - **A latent v0.5-era bug in the whole suite surfaced**: every acceptance script picked the
    newest pack with a lexical `sort().at(-1)`, and the day's TENTH build ('2026.07.31-10') sorts
    before its ninth — verify-v07 validated a stale pack on its first run. All ten scripts now use
    a shared numeric-suffix `newestPack()` in [paths.mjs](tools/e2e/paths.mjs). The bug was
    harmless for fourteen versions because no day had ever reached ten builds; it fired the first
    day one did.
  - Verified against pack `2026.07.31-10`: 0 uncredited terms, 0 orphan labels, 0 traditional
    characters in zh labels/aliases, 8 sampled QIDs live-checked as non-disambiguation; 固件
    narrows the browse to exactly Firmware; the firmware card reaches the "Nghề (IoT)" deck and
    its review answer shows 固件 from the snapshot. **0 off-origin requests from the app, 0
    console errors. All 15 acceptance scripts pass.** Script: `tools/e2e/verify-v07.mjs`.

- **v0.6 shipped — "The daily pull".** A `/today` screen over **186 daily items** (26 pulled today
  + a 160-article graded archive), **16 evergreen tips**, and a per-day word plan that feeds the
  SRS deck. Both roadmap clauses hold: *run `/daily-pull` with coffee* · *open the app to fresh
  curated content*. Pack `2026.07.31-8`: 130.1 → **130.4 MB gz** (+0.32 MB), 26 sources.
  The skills are real now: [.claude/skills/daily-pull/SKILL.md](.claude/skills/daily-pull/SKILL.md)
  and [curate-pack](.claude/skills/curate-pack/SKILL.md).
  - **P1 — three daily sources, each with a licence trap that had to be measured.**
    `daily:voa-zh` ([zh/daily-voa.ts](apps/ingest/src/sources/zh/daily-voa.ts)) pulls VOA Chinese,
    the only verified public-domain DAILY Mandarin service. Its feed URL is **hardcoded on
    purpose**: `/rssfeeds` is not deterministic — two fetches two minutes apart returned two
    structurally different pages (46 VOA Learning English programme feeds one time, 27 Chinese
    section feeds the next), so resolving it at run time makes the pull depend on which page the
    CDN served.
  - `daily:globalvoices` ([shared/daily-globalvoices.ts](apps/ingest/src/sources/shared/daily-globalvoices.ts))
    pulls English and French. **`<dc:creator>` is the TRANSLATOR, not the author** — on the French
    feed for 10 items out of 10, and on the English feed for syndicated pieces. CC BY's one real
    condition is naming the author, so the obvious field credits the wrong person on most rows.
    This is v0.4's French-audio bug in a new costume: *a licence field filled from the nearest
    plausible place is not a licence field*. The real credit is parsed from each article's
    `gv-rss-footer` block, which distinguishes "Written (English) by" from "Traduit (Français) par".
    The **licence is verified per article** too, read only from `div.post-credit-container` — a
    page-wide regex would pick up a Wikimedia photo's CC BY-SA 3.0 or an RDF URL with a doubled
    slash, i.e. somebody else's licence.
  - `daily:wiki-itn` ([shared/daily-wiki-itn.ts](apps/ingest/src/sources/shared/daily-wiki-itn.ts))
    pulls the French and Chinese current-events blurbs. **The ledger's Chinese page name was
    wrong**: `Portal:新闻动态` redirects to a portal that transcludes the content, returns 508 KB
    with 778 list items, and reports its own revid as the attribution handle for text living
    elsewhere. `Template:Itn` is the content page. The French list **nests** — one entry holds a
    sub-list of two events and has no sentence of its own — so items are split at depth 0 and
    sub-items are emitted separately, inheriting the parent's date. Under `variant=zh-cn` the
    **hrefs stay traditional while the `title` attributes are converted**, so display text comes
    from the attribute or a simplified-only app shows 熊本縣.
  - **The licence is fetched, never remembered.** `meta=siteinfo&siprop=rightsinfo` returns each
    wiki's own statement — and the two wikis link their *localised* deeds (`deed.fr` vs `deed.zh`),
    which is one licence in two languages. Comparing the URLs verbatim made an agreement look like
    a conflict and failed the first run.
  - **P2 — the VOA Learning English archive, and the finding that shaped it.**
    `seed:voa-le` ([en/voa-le.ts](apps/ingest/src/sources/en/voa-le.ts)) crawled 900 pages of the
    frozen archive and kept **160 articles, 673 KB of text**. **314 of those 900 pages — 35% —
    were rejected as wire-agency-derived.** VOA's terms put material produced *exclusively* by VOA
    in the public domain, and a third of Learning English is AP or AFP reporting a VOA writer
    adapted: *"Mark Long reported this story for the Associated Press. Anna Matteo adapted it for
    VOA Learning English."* Two of those rejections were re-fetched by hand to confirm the screen
    is accurate rather than over-broad. **No `license_mode` check could ever catch this** — the
    source really is public domain, just not for those rows. The screen distinguishes two shapes
    that mean opposite things: a trailing "reported this story for X" byline disqualifies the
    piece; an inline "spoke to the Associated Press" is a quoted attribution and is kept. Measured
    on the shipped pack: **0 derived, 47 merely quoting.**
  - The rule lives in [packages/shared/src/wire.ts](packages/shared/src/wire.ts) and is applied
    **twice** — by the ingest module, and again by `pack verify` over the finished pack. The second
    pass is the one that matters: it catches a future module that forgets the first.
  - **The level is not in VOA's data**, and their own index contradicts itself. No article page
    carries a level (the only "Beginning/Intermediate/Advanced" strings are the site-wide nav), and
    the three level landing pages are an editorial index of *programmes* that files "Words & Their
    Stories" under Advanced while that programme's own blurb says it is written "at the
    intermediate and upper-beginner level". So no level is copied from VOA.
  - **Levels are MEASURED instead** ([lib/level.ts](apps/ingest/src/lib/level.ts)): the band at
    which 90% of the words we recognise sit at or below, against the pack's own HSK/CEFR lexicon.
    It is not a CEFR grading and the UI says so. It declines to answer below 20 recognised tokens —
    a threshold set by measurement, not taste: the reported band moves by 1/n per token, so at n=8
    one token is worth 12.5%, coarser than the 90% it is compared against, and *"le Slovène Tadej
    Pogačar remporte le Tour de France pour la cinquième fois"* came out **C2**. One-line news
    blurbs therefore get no level, which is the honest answer.
  - Result on the archive: **A1 3 · A2 75 · B1 75 · B2 7** — sensible for a controlled-vocabulary
    corpus, and the A2/B1 quotas are what stopped the crawl. **No audio is bundled**: one clip is
    3,450,715 bytes (the `_hq` sibling is exactly twice that), so the full set is ~113 GB. The MP3
    URL is stored and offered as an outbound link, never fetched.
  - **P3 — `/today`, built around the fact that the pack is older than today.** It is downloaded
    once and read offline, so "today's news" can only mean "the newest day this pack holds" — and
    the screen states which day that is rather than implying freshness it does not have. Every
    section degrades instead of vanishing: news falls back to the newest pulled day, graded reading
    is dateless, the word plan falls back to the newest plan, and the tip falls back to a
    deterministic pick from the evergreen set (deterministic, because "today's tip" that reshuffles
    on reload is a shuffle button).
  - **`daily:all` writes a provisional word plan** from the words today's own articles contain, so
    the screen works for someone who never runs the skill; `daily:select` replaces it with curation.
    It only writes where no plan exists, so re-running the pull cannot overwrite Claude's choices.
    A curated word shows its reason; an auto-picked one says so.
  - **P4 — the skills are real.** `/daily-pull` is a six-step operational document, not a stub:
    pull → curate → tip → select → build/verify/publish → commit → report, with the traps inline
    (stop `pnpm dev` before publishing; a non-empty `unknownWords` must be fixed, not ignored; a
    wire-screen failure means drop the item, never relax the check). `/curate-pack` is the weekly
    counterweight: rotate one source per week and verify its licence **at the artifact**, prune
    daily items past 90 days (never the archive), ping each source, and watch for VOA English
    reviving.
  - **`pack verify` gained the v0.6 gates**: every daily item must carry a per-item credit, no item
    may have neither body nor link, no planned word may be missing from the pack, tips must have a
    registered source and a body, and **no bundled body may be wire-derived**. The ID-churn gate
    now also covers `tips`; `daily_items` is deliberately excluded, because a pull replacing the
    day's items is the feature.
  - **A pre-existing v0.4 bug surfaced and is fixed.** On a pack older than v0.4 the review screen
    threw `SQLITE_ERROR: no such table: word_audio` three times per card — a feature added later
    assumed a table older packs do not have. `getWordAudio` now tolerates exactly "no such
    table"/"no such column" and returns nothing; every other SQL error still propagates. Found by
    running the upgrade acceptance script, which the blanket suite loop had been running in the
    wrong environment (it needs the static server, not `pnpm dev`) — the README's runner is fixed.
  - Verified against pack `2026.07.31-8`: re-running a pull the same day leaves the row count and
    the ids identical; an injected source failure still stores 3 source/language pairs, names the
    failure and exits 0; `/today` states the day it is showing, opens an item with 21 blocks of
    text and its per-item credit, and the word of the day lands in the SRS deck ("1 thẻ trong bộ");
    the tip is stable across reloads. **0 off-origin requests, 0 console errors. All 14 acceptance
    scripts pass.** Script: `tools/e2e/verify-v06.mjs`.

- **v0.5 shipped — "Grammar".** A `/grammar` reader over **720 topics**: the official HSK 3.0
  syllabus (573 points, graded HSK1→7-9), Tex's French Grammar in full (130 pages), and 17
  Wikibooks English chapters. Both roadmap acceptance clauses hold: *read HSK-2 的/得/地 offline*
  · *Tex's grammar with audio*. Pack `2026.07.31-6`: 128.9 → **130.1 MB gz** (+1.2 MB), 21 sources.
  - **P1 — the Chinese syllabus.** `seed:zh-grammar`
    ([apps/ingest/src/sources/zh/grammar.ts](apps/ingest/src/sources/zh/grammar.ts)) ingests
    ivankra/hsk30's `hsk30-grammar.csv`. **573 points, not the 625 lines the file has** — 38
    records wrap across lines inside quoted fields, so a per-line split silently reads garbage.
    `parseCsv()` in [text.ts](apps/ingest/src/lib/text.ts) is a whole-document RFC-4180 parser;
    use it for any CSV not known to be one-line-per-record.
  - **Nothing is translated that we cannot translate honestly.** The source is entirely Chinese.
    Its `Group` column is a real closed taxonomy (12 values) — but `Category` has **135 values and
    most are grammar PATTERNS** (`还是……吧`, `X就X（点儿）吧`), not category names. So the point
    text stays Chinese (a Chinese grammar point's name *is* Chinese) and only the taxonomy is
    localised, in the UI through i18next where user-facing strings belong. `title_vi` is NULL
    rather than machine-translated.
  - **P2 — Tex's French Grammar, bundled verbatim.** `seed:fr-grammar`
    ([apps/ingest/src/sources/fr/grammar.ts](apps/ingest/src/sources/fr/grammar.ts)) takes all
    **130 grammar pages** in the site's own index order — that order is the pedagogy, so it
    becomes `ord`. Tex is not CEFR-graded, so `level` is NULL rather than invented.
    CC BY 3.0 is **verified on each page** (`creativecommons.org/licenses/by/`) before it is
    bundled, not assumed from the ledger. Pages are iso-8859-1 and use named entities, so both
    the bytes and `&eacute;` need decoding — `decodeHtml()` handles the Latin-1 set, including
    the semicolon-less legacy form (`ne&nbsp pas`) that appears in the conjugation pages.
  - **P3 — English, from the OTHER Wikibooks book.** The 0.5 row named "English in Use"; that is
    deliberately **not** what ships. Measured: its contents page says it is "intended for use by
    native speakers of English or advanced learners", its About page records that the initial text
    was copied from **Goold Brown's 1851 grammar**, and `thou`/`hath`/`OBS.`/Brown's citations
    still run through its Syntax, Punctuation, Commas and Articles chapters. Its modern companion
    "English Grammar" ships instead — 17 chapters, 46 KB, **0 archaic markers**. Thin and correct
    beats thick and misleading. This is v0.4's licensing lesson in a new dimension: **the ledger
    describes a source, it does not vouch for every page of it.**
  - **The Grammar Wiki links were nearly all dead, and measuring is what caught it.** The Chinese
    Grammar Wiki is CC BY-NC-SA — link only, never bundled — and the first implementation pointed
    each point at a search URL. Sampled over 16 real HSK1–2 points, **2 resolved and 14 landed on
    "There were no results"**. Linking the point's individual TOKENS instead resolved **15 of 16**:
    the wiki is organised by particle (的, 得, 地, 把, 虽然), not by syllabus wording. The seed now
    splits each point into tokens, checks every distinct token once against the live wiki (cached
    to disk), and **stores a link only where a real article exists** — a point with no match gets
    no link at all. A "learn more" that dead-ends is worse than admitting we have nothing.
    Full-run result: **239/576 tokens have a real article; 273/573 points carry ≥1 verified link**;
    the wiki itself is registered as a `link-only` source so its NC licence shows on `/licenses`.
    Two operational notes from the crawl: cache only DEFINITIVE answers (a throttle recorded as
    "no article" silently deletes a link that exists and looks exactly like a correct result), and
    pace GENTLY — at `polite()`'s standard 250 ms spacing this wiki rate-limits every request into
    the full 2s/4s/8s retry ladder (~15 s/token); at ~800 ms spacing the same checks answer
    instantly. Gentler was literally faster.
  - **The acceptance script had the same blind spot** and passed while shipping dead links,
    because it asserted an `<a>` was *present*, never that it *resolved*. It now fetches the 得
    link and fails on a "no article" body, and fails outright if any topic still stores a search
    URL. Checking existence is not checking correctness.
  - `/grammar` renders by **`license_mode`, not by language**: a link-only topic shows an explicit
    reason and its outbound link instead of a blank page, and the reader refuses to print body
    text for such a source even if a future seed wrongly stored some. Markdown is rendered by
    [markdown.tsx](apps/web/src/components/markdown.tsx), which emits React elements and never
    touches `dangerouslySetInnerHTML` — the same reasoning that made IPA diagrams `<img src="data:">`.
  - **Tex's audio is a lever, not a default — and never bundle the podcast copies.** The RSS
    enclosures point at `/tex/aud/itunes/…`, and every one of those files carries an ID3 `APIC`
    frame with the same ~82 KB cover JPEG (adj2_ex1: 136,798 B as the iTunes copy, 54,960 B plain
    at `/tex/aud/…` — identical audio). The seed strips `/itunes/` from the URL and refuses any
    clip that still contains `APIC`. Real totals: 730 clips ≈ 57 MB plain (the feed's "114 MB"
    double-counts cover art); all 11 chapters at one clip per page ≈ 22 MB. `AUDIO_CHAPTERS`
    defaults to `['adj']` — 8 clips, **1.0 MB** — which proves the feature end to end; everything
    else falls back to v0.4's TTS.
  - `pack verify`'s **ID-churn gate now covers `grammar_topics`** as well as `words`, so a slug-
    derivation change fails the build instead of surfacing as a bug report. (Chinese grammar IDs
    include the HSK level and the point text — fine for a reader, revisit before cards.)
  - Verified against pack `2026.07.31-6`: 得 opens at HSK2 and reads offline with a Grammar Wiki
    link **fetched and confirmed to resolve during the test** (checking a link exists is not
    checking it works); a French page renders 47 blocks and 78 emphasised spans with no literal
    `**` left; a Tex clip plays 6.40 s from a `blob:` URL; 0 link-only rows carry body text;
    0 orphan sources; 0 search URLs. **0 off-origin requests, 0 console errors.** All 11 earlier
    acceptance scripts still pass. Script: `tools/e2e/verify-v05-p1-p2.mjs`.

- **v0.4 shipped — "Sentences + sound".** Pack `2026.07.31-4`: 68,683 sentences, **11,700 audio
  clips** (1,707 pinyin syllables + 7,211 HSK words + 2,782 French words), 9,993 word→audio links,
  17 sources, **128.9 MB gz**. Both roadmap clauses are met: *every card has a real example* ·
  *most words speak with a human voice* — and anything without a recording now speaks with a
  synthetic one, so no word is silent.
  - **P3 done — French words speak too.** `seed:fr-word-audio`
    ([apps/ingest/src/sources/fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts))
    ingests **2,782** Lingua Libre recordings from Wikimedia Commons — **93% of the A1–B1 words**
    (2,782/3,000), 56% of all levelled French, from **17 different speakers**.
  - **No Commons category crawl was needed.** `Category:Lingua Libre pronunciation-fra` holds
    430,990 files (~860 paginated calls, and no word→file mapping). The kaikki French extract we
    **already download** for `seed:fr-kaikki-en` carries `sounds[].audio` + `sounds[].mp3_url` per
    entry, already joined to the headword. Re-reading that cached file replaces the whole crawl.
  - **Commons' mp3 transcode, not the source WAV**: `bonjour` is 117 KB as WAV and 15 KB as the
    transcode. Across thousands of clips that difference decides whether the feature ships at all.
    There is no `.opus`/`.oga` transcode, and no local re-encode (a fresh machine has no ffmpeg).
  - **Licenses are verified per file against the Commons API** (batched 50/call, cached to disk),
    never inferred from the filename — and that is what caught the biggest bug of this version.
  - **P4 done — TTS fallback, so no word is silent.** One shared `SpeakButton` picks a bundled
    recording, else the platform speech synthesiser, else renders **nothing at all** (never a
    button that cannot play). Synthetic playback is labelled `🔊TTS` and dashed-bordered: a
    learner copying a robot's Mandarin tones is worse off than one who knows to find a native
    model. Zero bundled bytes and zero licensing burden — nothing is downloaded or redistributed.
  - **Example sentences get TTS too**, and always will: Tatoeba's own sentence recordings are
    CC BY-NC-ND, so they can never be bundled. Synthesis is the only pronunciation they will have.
  - Two real browser failure modes, both found by testing rather than reasoning: Chrome populates
    `getVoices()` **asynchronously** (availability is read through `useSyncExternalStore` on
    `voiceschanged`, else the first render decides "no voice" forever), and Chrome **silently
    drops an utterance queued in the same task as `cancel()`** — which made every *repeat* press
    do nothing. Yield before re-speaking.
  - `pack verify` gained a gate: **every bundled clip must name its speaker.** Every clip is
    CC0/CC BY/CC BY-SA, and for the BY family naming the author is the licence's one real
    condition; a corpus-level credit cannot discharge it when Lingua Libre is hundreds of people.
  - Verified: `être` plays a 1.04 s decodable clip from a `blob:` URL with its credit rendered,
    voices arriving late light the button up, a recorded word never flashes as TTS, a repeat press
    speaks again after exactly one `cancel()`, and with no voice *and* no recording exactly 0
    buttons render. **0 off-origin requests, 0 console errors.**
    Script: `tools/e2e/verify-v04-p3-p4.mjs`.

- **v0.4 P3/P4 hardened after a second adversarial review** (4 lenses; 15 findings raised,
  **9 refuted, 6 confirmed**). Two of the nine refutations were themselves wrong and were
  reinstated after checking the code by hand — a refuter that refutes nothing is broken, but so
  is one trusted blindly. What was real:
  - **Every French clip was stamped `CC BY-SA 4.0`.** The per-file license was fetched from
    Commons, used as an accept/reject test, then thrown away while the INSERT hardcoded one
    constant. The truth, measured over all 2,782 files: **CC0 ×1870, CC BY-SA 4.0 ×902,
    CC BY 4.0 ×9, CC BY-SA 3.0 ×1** — so **68% of rows asserted ShareAlike obligations over
    recordings whose authors had dedicated them to the public domain.**
    [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md) says "Lingua Libre uploads are
    CC BY-SA 4.0"; that is **wrong for most of the corpus**, and only per-file verification
    showed it. **No `pack verify` check could ever have caught this** — the license string was
    well-formed, just untrue. Treat a vetted source's stated license as a starting hypothesis.
  - **The speaker credit the new gate mandates was stored and never rendered.** `getWordAudioId`
    is now `getWordAudio` and returns speaker + attribution, shown beside the button.
  - **`audioId` conflated "lookup in flight" with "no recording exists"**, so a word we *do* have
    a native recording of painted as a synthetic-voice button for a worker round-trip — and a
    click in that window really did speak the robot. The three states are now distinct in the
    type: `undefined` = loading, `null` = none, row = play it.
  - **`await res.arrayBuffer()` sat outside the download try/catch.** undici resolves `fetch()`
    on *headers*, so one reset socket mid-body would escape the 100-failure budget and abort the
    whole seed — and under `seed:all`, the seeds after it too.
  - **The "permanently missing" markers were inert**: written as zero-byte files, then filtered on
    `size > 0`, so every known-404 was re-requested on every future run. They are a separate
    `.missing` sentinel now — a zero-byte mp3 means an *interrupted write*, which must retry, and
    the two must not look alike (`writeFileSync` is not atomic; `lib/download.ts` uses `.part`).
  - **TTS and recorded playback could talk over each other**; each path now stops the other.
  - **The test was wrong in the way that matters most.** Its `speechSynthesis` stub returned a
    full voice list on the first `getVoices()` and never fired `voiceschanged`, so the
    async-arrival path — one of the two failure modes P4 claims to handle — was never exercised.
    It now starts empty and delivers voices the way Chrome does, which **failed until the code was
    right**. A stub that is kinder than the real API is a test that passes for the wrong reason.

- **Crawl politeness is measured, not guessed.** upload.wikimedia.org answers **429 above ~2
  concurrent**: raising `polite()`'s budget to 8 made throughput *worse* (0.5 → 0.3 files/s) and
  lost files to refusals. Wikimedia's documented "~15,000 files/hour" describes their bulk
  tooling, not transcode URLs. The default (2 in flight, 250 ms apart) is right; the full crawl
  takes ~2 hours and is checkpointed, so an interrupted run resumes from cache. The license
  lookups are cached to disk too, so a resumed run re-asks Commons nothing.

- **⚠️ Pack size is now the open decision: 87.6 → 128.9 MB gz.** French audio added ~41 MB.
  Nothing is broken — it is a one-time download for a local-first app — but it should be a
  choice. The lever is one constant, `LEVELS` in
  [fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts); already-downloaded clips stay
  cached, so trimming costs only a re-run:
  `['A1','A2']` ≈ 1,977 clips (−14 MB) · `['A1']` ≈ 990 clips (−34 MB).
  Other levers, unchanged: drop zh word audio to `18k-abr` (−8 MB), restrict stroke data to
  HSK + top-N (−9 MB), or **split media into an optional second pack** — the real answer, which
  v0.9 (PWA + deploy) forces anyway.

- **Deliberately deferred: curated sentence audio** (the one 0.4 roadmap item not built). Filtered
  to bundleable licenses, Tatoeba offers ~6,663 English and ~2,126 French clips and **zero
  Mandarin** (all CK recordings are CC BY-NC-ND, the rest carry empty licenses). Sentence clips
  are far larger than word clips, so it would add heavily to an already-128 MB pack to buy
  coverage for two of three languages. TTS reads example sentences today. Revisit when media
  splits into its own pack.

- **v0.4 P1/P2 (built earlier in the version):**
  - **P1 done — every card has a real example.** `seed:sentences`
    ([apps/ingest/src/sources/shared/tatoeba.ts](apps/ingest/src/sources/shared/tatoeba.ts))
    ingests Tatoeba (CC BY 2.0 FR) filtered to words we actually ship. First run: 73,389
    sentences / 96,202 word links; **68,683 / 81,783 after the content and script filters
    below** — that smaller number is what ships, and is the one to trust.
    Coverage of levelled words at that first run: **HSK1 99% · HSK2 97% · HSK3 94% ·
    EN 93% · FR 94%**. ZH readings are generated with `pinyin-pro`, not taken from Tatoeba's
    patchy transcriptions export.
  - **Attribution is per sentence, not per corpus.** CC BY 2.0 FR requires crediting the
    contributor, so every row stores `sentence #<id> by <username>` and the UI always renders it.
    `pack verify` now **fails** on any sentence missing attribution, on orphan `word_sentences`,
    and on a zh sentence with no reading.
  - **Selection quality is deliberate.** Sentences are assigned shortest-first (simple examples,
    and they cover common words anyway) but with a substance floor — without it the "best"
    example for a word was 哈哈 / "Ok!" / "Si.", which are real Tatoeba sentences that teach
    nothing. Floors: ≥3 Han characters for zh, ≥12 characters for en/fr. Also caps: 3 examples
    per word, 30k sentences per language, ≤70 characters.
  - **Cards freeze their example** (`CardSnapshot.example`, optional so v0.2/v0.3 cards still
    validate). A review renders it from the snapshot — never by joining content.db (invariant 6).
  - Verified: word pages show reading + translation + credit; the review answer shows the frozen
    example with its credit; export → import round-trips a card carrying one.
    Script: `tools/e2e/verify-v04-p1.mjs`.
  - Pack: 47.5 → **57.7 MB gz** (sentences + their FTS index).
  - **P2 done — most words speak with a human voice.** `seed:zh-word-audio` ingests **7,211**
    HSK word recordings from `hugolpz/audio-cmn` — same repo as the syllable chart but a
    **different speaker and collection** (Yue Tan / cmn-caen-tan vs Chen Wang), so it registers
    its own `sources` row: the attribution has to name the right person. Only recordings that
    match a **levelled** pack word are downloaded at all, so a fresh machine doesn't pull 36 MB
    to discard a third of it. Coverage: **7,211 / 11,470 levelled zh words = 63%**.
  - Audio hangs off a new **`word_audio`** join table, not a `words.audio_id` column: audio comes
    from a different source than the word, and a word may later have several speakers.
  - **Deliberate, narrow exception to invariant 6:** the review card looks its audio up by card
    id instead of freezing it into the snapshot. Audio is *enrichment*, not card content — if the
    word vanishes from a newer pack the button simply disappears and the card still reviews.
    Freezing megabytes of mp3 into `user.db` would be far worse. Documented at `getWordAudioId`.
  - Verified: 🔊 on the word page and on the review answer both play a decodable clip from a
    `blob:` URL, **0 off-origin requests**, and the PLAN's v0.4 gate holds — **0 audio rows with
    NULL attribution, 0 NC/ND clips**. Script: `tools/e2e/verify-v04-p2.mjs`.
  - **Pack: 57.7 → 88.3 MB gz.** This is now the project's biggest open question. Levers, in
    order of how little they cost: drop word audio to `18k-abr` (−8 MB), restrict word audio to
    HSK1–6 (−12 MB), restrict stroke data to HSK + top-N frequency (−9 MB), or — the real answer —
    **split media into an optional second pack**, which v0.9 (PWA + deploy) will force anyway.
    Nothing is broken at 88 MB; it is a one-time download for a local-first app. But it should be
    a decision, not a drift.
  - **P1/P2 hardened after an adversarial review** (29 agents; 25 findings raised, 7 survived
    refutation, 18 refuted). Four were real and are fixed:
    - **No content filter.** Tatoeba is an open corpus and shortest-first selection actively
      *favours* its worst sentences. The rank-0 example was 操你妈！for HSK1 妈 ("mum"),
      殺了他/殺了她 for 他/她, and "I raped her." for A1 "her" — and `addCard` was freezing those
      into `user.db` permanently. `isBlocked()` now screens the sentence **and** its translation
      and rejects it outright; deranking would only make it example #2. **This is a denylist,
      not a guarantee** — it catches the egregious cases; an open corpus always holds more.
    - **Traditional-script sentences** (26.5% of zh) matched neither our simplified headwords,
      stroke animations nor audio, *and* broke transcription. Now rejected, using a
      traditional-only character set derived from our own lexicon (chars in `alt_form` but never
      in `headword`) rather than a hardcoded list.
    - **Wrong polyphones**: 嗎 read "má" in 307/307 sentences, 們 "mén" 590/590, 車 "jū" 125/125.
      Root cause was the traditional text above; on simplified-only input pinyin-pro is correct.
      Now 3 suspect syllables across 18,748 aligned sentences.
    - **Substring matching without segmentation** linked words that only straddled a boundary
      (有名 from 我没有名字, 人们 from 客人们, 大人 from 加拿大人). Replaced with greedy
      longest-match segmentation against our own headword list.
    - **Translations were uncredited.** The bundled English translation is a separate CC BY 2.0
      FR work by a different contributor; 45,983 rows now carry `translation #<id> by <user>`.
  - **A fix that looked right and was inert.** The blocklist was first written through a Python
    heredoc where `` became **literal backspace bytes (0x08)**, so the regex required a control
    character and matched nothing. Typecheck passed, the seed ran clean, counts looked plausible
    — only re-auditing the rebuilt data caught it. Use the Edit tool for regex/escape-heavy code.
  - **A fix that was worse than the bug.** Transcription was rebuilt on our own CC-CEDICT
    readings; measured, that was *worse* (吗 "má", 行 "háng", a capitalised "Néng" from a
    proper-noun entry) because one character's entries carry no sentence context. Reverted to
    pinyin-pro plus two targeted corrections — erhua (哪儿 "nǎr", 一块儿 too; 儿子 untouched) and
    the structural 得 (做得好 "zuò de hǎo"). **Known limitation:** 得 after a pronoun is left
    alone, since it is genuinely ambiguous there between modal děi (您得小心) and the verb dé
    (我得了金牌, which pinyin-pro reads correctly). Resolving it needs POS tagging.
  - Cost of the filtering: zh coverage of levelled words **71.2% → 63.4%** (HSK1 99% → 98%),
    en 92.6%, fr 94.0%. Pack 88.3 → **87.6 MB gz**. Worth it — a smaller set that is simplified,
    clean and correctly transcribed beats a larger one that is not.
  - Audit script: `tools/e2e/audit-v04-fixes.cjs`. It checks polyphones **character-aligned**,
    not by substring — a naive search flags 门 "mén", 儿子 "ér" and 德语 "dé" as errors when they
    are correct. Three of my own audit checks were wrong that way before being tightened.
  - **Seeds must delete before they insert.** Re-running with stricter filters left 77k rejected
    rows behind, because `INSERT … ON CONFLICT` upserts and never removes. `seed:sentences` now
    clears its own rows (scoped by `source_id`) first. Any seed whose *selection* can change
    needs this — an input-hash guard alone does not cover it.

- **v0.3 shipped & tagged** — "Writing systems". Built in seven committed phases (P1–P4d), each
  verified in headless Chrome before the next started. Pack `2026.07.30-5`: 147,261 words,
  **11,254 graphemes** (9,432 hanzi + 1,707 pinyin syllables + 51 IPA phones + 64 Latin letters),
  1,707 audio clips, 51 sagittal diagrams, 14 sources, **47.5 MB gz**.
  Every roadmap clause for 0.3 is met: *watch 好 draw itself and trace it · trace é · hear every
  pinyin syllable*.
  - **P1 done — hanzi stroke data in the pack.** `seed:zh-strokes`
    ([apps/ingest/src/sources/zh/strokes.ts](apps/ingest/src/sources/zh/strokes.ts)) ingests
    makemeahanzi `graphics.txt` (Arphic PL) → `graphemes.stroke_json` for **9,432 characters**
    and `dictionary.txt` (LGPL-3.0+) → a **separate `hanzi_info` table** (definition, pinyin,
    IDS decomposition, radical, etymology). Two licenses ⇒ two `sources` rows ⇒ two tables;
    never merge them. `graphemes.reading` is filled from CC-CEDICT single-char entries (already
    bundled) so the APL table carries no LGPL data. `graphemes.ord` = stroke count.
  - Coverage: **HSK 1 through 7-9 have 0 characters missing stroke data.** 4,959 of the 14,391
    distinct characters in CEDICT content have no upstream stroke data (rare glyphs) — expected,
    not a bug. Only characters present in our words are ingested (142 upstream glyphs dropped).
  - `pack verify` gained the v0.3 gates: no `kind='hanzi'` row without `stroke_json`, every HSK1
    character present, no orphan `hanzi_info`, and **ARPHICPL.TXT must exist** in
    `apps/web/public/licenses/` whenever Arphic data is bundled. The seed writes that file; it
    is committed, and shipping it unaltered is a condition of the license.
  - **Pack grew 27.7 MB → 41.2 MB gz** (76 MB → 117 MB raw) — stroke JSON is 30.2 MB of it.
    Accepted deliberately: strokes for every lookup-able word beat a smaller download. Lever if
    it ever needs trimming: restrict the seed to HSK + top-N frequency (~3k chars, ≈ −9 MB gz),
    or split strokes into an optional second pack.
  - The **ID-churn gate ran for real for the first time** (two pack dirs now exist in
    `build/packs/`) and reported **0 vanished word IDs** across the schema change.
  - **P2 done — you can watch 好 draw itself and trace it.** `hanzi-writer@3.7.3` (MIT) is
    wrapped by [stroke-writer.tsx](apps/web/src/components/stroke-writer.tsx); its
    `charDataLoader` returns the JSON we already hold, so it **never touches the network**.
    New routes: `/write` (browse by HSK level or by stroke count) and `/write/:glyph`
    (animate · trace · reveal, reading, radical, definition, IDS decomposition whose
    components are links when we have their strokes, and the words the character appears in).
    Characters in a word page's headword now link into `/write/:glyph` — the discovery path.
  - Verified in headless Chrome: the trace quiz was driven with **real pointer events replayed
    along the character's own medians** and completed 6/6 with zero mistakes, proving the
    packed stroke data is usable and not just present. Licenses screen lists Arphic PL + LGPL
    and `/licenses/ARPHICPL.TXT` serves the 6,900-byte text. 0 console errors.
    Script: `tools/e2e/verify-v03-p2.mjs` (it reads medians from the built pack itself and
    inverts hanzi-writer's Positioner — bounds `(0,-124)..(1024,900)` — to hit real coordinates).
  - **Fixed a real navigation bug found on the way** (see the storage-lock note below).
  - **P3 done — writing cards go through the v0.2 SRS loop.** ＋ on `/write/:glyph` creates a
    card keyed on the **grapheme ID** (`zh:g:mmah:好`) in the same `cards` table, scheduled by
    the same FSRS engine, counted in the same per-language due/new budgets. `CardSnapshot`
    gained two **optional** fields — `kind: 'word' | 'grapheme'` and `strokeJson` — so every
    card written by v0.2 still passes import validation; absent `kind` means `'word'` (helper
    `snapshotKind()`). The stroke data is frozen into the snapshot, so a review renders the
    writer **without joining content.db** (invariant 6).
  - In `/review`, a grapheme card shows the glyph as the prompt and the interactive writer on
    the answer side (recall first, then practise); word cards are untouched, and the footer link
    points at `/write/:glyph` instead of `/word/:id`.
  - Verified: mixed deck of one word card + one grapheme card in a single session; the writer
    appears only on the grapheme card; FSRS advanced it **2 d → 16 d** under a +4 d debug clock
    (the same growth v0.2 measured for words); export → import round-tripped a user.db
    containing a grapheme card. 0 console errors. Script: `tools/e2e/verify-v03-p3.mjs`.
  - **P4a done — hear every pinyin syllable.** `seed:zh-pinyin-audio` ingests all **1,707**
    Mandarin syllable recordings from `hugolpz/audio-cmn` (CC BY-SA, Chen Wang, via the dead
    Shtooka project's mirror). At the `24k-abr` encoding the whole chart is **7.5 MB**, so it
    ships **inside the content pack** — the separate audio pack this file previously suggested
    turned out to be unnecessary. Bytes live in a new `audio_blobs` table beside `audio`
    (metadata is scanned constantly by `pack verify`; blobs are only fetched one at a time).
  - `/pinyin` renders the classic initials × finals grid per tone (39×24 for tones 1–4, 14×2 for
    the 19 neutral-tone syllables); clicking a cell plays the clip from a Blob URL.
    [audio/player.ts](apps/web/src/audio/player.ts) caches one object URL per clip — creating one
    per click leaks them.
  - Verified: all **1,707** syllables are reachable across the five tone tabs, hǎo decoded to a
    1.28 s clip from a `blob:` URL, and **zero off-origin requests** were made (the whole feature
    is offline). Script: `tools/e2e/verify-v03-p4.mjs`.
  - Pack: 41.2 → **47.4 MB gz** (mp3 is already compressed, so it adds close to its raw size).
  - Two ingest traps fixed here, both worth remembering:
    - GitHub's **contents** API silently caps a directory listing at 1,000 entries *and* ignores
      `page`, so it reported 1,000 of the 1,707 files and re-served the same page. Use the **git
      trees API** (`/git/trees/{ref}?recursive=1`) and check its `truncated` flag.
    - `alreadyIngested()` keys on the input hash, so fixing a **parser** leaves the database
      stale — the seed just skips. `zh-pinyin-audio` folds a `PARSER_VERSION` into the ingest
      hash (but *not* into the lock hash, which must only move when upstream moves). Any seed
      whose parsing is non-trivial should do the same.
  - **P4b done — tone listening drill.** `/tones` plays a syllable, hides it, and asks which of
    the four tones it was; after answering it reveals the tone-marked form, marks the right and
    wrong buttons, and offers all four variants side by side to hear the contrast. Only the
    **421 bases that carry all four tones** are drilled — a partial set would give the answer
    away. Score + streak are in-memory only (deliberately: this is a warm-up, not SRS).
  - Verified: prompt hidden until answered, right/wrong both scored, exactly one button marked
    correct, four distinct contrast variants, answering twice cannot re-score, 0 off-origin
    requests, 0 console errors. Script: `tools/e2e/verify-v03-p4b.mjs`.
  - **P4c done — IPA chart + sagittal diagrams.** `seed:ipa-sagittal` ingests all **51** CC0
    vocal-tract SVGs from `drammock/phonetics-teaching-assets` (Richard Wright & Dan McCloy) as
    `lang='all'`, `kind='ipa_phone'` graphemes whose `diagram_ref` points into a new generic
    **`asset_blobs`** table. The filename→phone map in the seed is **explicit on purpose**:
    upstream encodes variants (`s_apical` vs `s_laminal`, the 3-frame click `kǃ_1..3`) that no
    rule recovers, and a silently wrong IPA symbol is worse than a missing one. IDs key on the
    filename stem, since apical/laminal variants share one symbol and would otherwise collide.
    (Upstream ships no `ʒ_laminal` — ʃ/s/z have both variants, ʒ only apical.)
  - `/ipa` groups the phones into consonants / vowels / glottis states / airstream and shows the
    selected diagram. Diagrams render as **`<img src="data:image/svg+xml,…">`, never injected as
    markup** — an SVG inside `<img>` cannot execute scripts, so no sanitiser is needed even if
    upstream art changes. They sit on a white surface in **both** themes: inverting line art
    would flip the anatomical shading and mislead.
  - `pack verify` now also fails on **dangling media**: a grapheme pointing at an `audio_id` with
    no blob, or at a missing `diagram_ref` asset.
  - Verified: 51 buttons in 4 categories, apical/laminal kept distinct, four diagrams decoded at
    654×925 from `data:` URLs, no inline `<svg>` in the DOM, CC0 authors credited on the Licenses
    screen, 0 off-origin requests, 0 console errors. Script: `tools/e2e/verify-v03-p4c.mjs`.
  - Pack: 47.4 → **47.5 MB gz** (13 sources, 11,190 graphemes).
  - **P4d done — trace é.** The last clause of the 0.3 roadmap row. **64 Latin glyphs**
    (a–z, A–Z, and é è ê ë à â ù û ô î ï ç) authored in
    [latin.ts](apps/ingest/src/sources/shared/latin.ts) as parametric stroke skeletons, then
    converted to hanzi-writer records: each centreline is offset by ±46 units into a **closed
    outline** with rounded caps, and the authored centreline *is* the median, so tracing follows
    exactly the path the animation draws.
  - **Why authored rather than derived from Relief SingleLine**, contradicting the original plan:
    hanzi-writer clips a thick animated line against the `strokes` paths, so a single-line font's
    centrelines would clip to nothing — an offsetting step was unavoidable either way. Once you
    are offsetting anyway, authoring is both simpler and better: stroke *order and direction* are
    the entire point of a tracing drill, and a font encodes neither. Result: original work under
    the pack's own CC BY-SA 4.0, and no OFL obligations enter the pack. Accented forms compose
    (base strokes then the mark; i/j drop their tittle first), so 26 letter definitions plus five
    marks yield all 38 lowercase forms.
  - `/write` gained a script toggle (Hán tự / Chữ Latin). Chip rows now carry stable classes
    (`.chips.script`, `.chips.levels`, `.chips.strokes`) — positional selectors broke a test when
    a row was inserted above them.
  - Verified: all 64 glyphs listed, é is 2 strokes (e body then acute, acute above the body),
    **traced end to end with 0 mistakes** through the same component that draws hanzi, and added
    to the SRS deck. Script: `tools/e2e/verify-v03-p4d.mjs`.
  - **Two real bugs this phase surfaced**, both fixed:
    - `graphemes.ord` means stroke count for hanzi but teaching order for letters, so the glyph
      page showed "é — 26 nét". Stroke count is now counted from `stroke_json` itself; never
      display `ord` as a stroke count.
    - Letters and IPA phones are `lang='all'`, but `/review` only queued `zh|en|fr` — a Latin
      writing card could be added and would then **never come up for review**. `'all'` is now a
      first-class deck ("Chữ viết chung" / "Writing systems"). Any future `lang='all'` content
      inherits this; adding a new content lang means adding it to `LANGS` in `review.tsx` too.
  - Small UX wart noticed, not fixed: clicking "Ôn tập" in the nav while the done screen is up
    leaves `phase='done'` (the route doesn't change, so nothing remounts). The done screen's own
    back button works. Worth a `useEffect` on location if it annoys.
- **v0.2 shipped & tagged** — "Daily review loop":
  - `user.db` (SRS state) lives in the browser's OPFS **beside** the content pack, in the same
    `mls-pool` SAH pool, same worker — the pack-update path never touches it. Schema (cards /
    append-only `review_log` / settings / daily_stats) + migrations live in
    `packages/shared/src/srs/schema.ts`; `USER_SCHEMA_VERSION` derives from the migration list.
  - `ts-fsrs@5.4.1` wrapper in `packages/shared/src/srs/fsrs.ts` (subpath `@mls/shared/srs`) —
    pure functions, explicit `now`, cards cross as plain field objects = `cards` columns.
  - Add-to-deck ＋ buttons on browse rows + word pages; cards key on **raw word IDs** and carry
    a `snapshot` JSON (headword/reading/glosses/level) so they survive pack swaps.
  - `/review`: per-language due/new counts, per-language new-card budget (default 5/day,
    `settings.new_per_day.<lang>`), session with Again/Hard/Good/Easy + interval previews,
    learning-step cards loop within the session, daily stats + streak, done screen.
  - user.db export/import buttons on `/review`. Import validates on a scratch pool copy FIRST
    (header, integrity, `user_version` ∈ [1..N] **before** migrating, 4 tables, Zod-checked
    snapshots), keeps a persistent `/user-backup.db`, and restores on any failure.
  - Debug clock for verification: `localStorage.setItem('mls_debug_clock_offset_ms', String(3*864e5))`
    + reload = +3 days; a red ⏱ badge shows on `/review` while active.
  - Verified end-to-end in headless Chrome: FSRS interval grew 2d → 16d under a +4d offset;
    export → mutate → import rewound state; non-backup SQLite files rejected with progress intact.
  - Hardening from the adversarial review: worker falls back to the installed pack when the
    manifest fetch OR the pack download/verify fails offline; re-entrancy guards on rating /
    add-to-deck / load-more; budget input commits on blur; back-link and double-URI-decode
    bugs inherited from v0.1 fixed.
- **v0.1 shipped & tagged** — "Three real dictionaries in the browser":
  147,261 words / 171,479 senses / 9 sources, pack `2026.07.29-2` at 27.7 MB gz.
  - ZH: full CC-CEDICT + HSK 2.0/3.0 levels (11,430 words) + OpenSubtitles freq ranks
  - EN: 8,648-word CEFR backbone (CEFR-J + Octanove) + WordNet glosses + ipa-dict IPA + freq
  - FR: 15,000 Lexique lemmas + **derived** CEFR bands (see PLAN — no redistributable FR list exists) + Wiktionary/kaikki glosses & IPA
  - Web app: Vietnamese-first UI (EN toggle), FTS + pinyin + CJK-substring search, browse by level, word detail, licenses screen. Verified end-to-end in headless Chrome.
- Versions/roadmap: [docs/PLAN.md](docs/PLAN.md) · Source/license verdicts: [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md)
- Deviation from plan: NGSL skipped in 0.1 (download URL 404s; CEFR-J + freq cover the need).
- Pack `2026.07.29-2` is published on [GitHub Releases (v0.1)](https://github.com/nhhandevops/multilingual-studies/releases/tag/v0.1) under CC BY-SA 4.0 — see "The database" below.
- 2026-07-30: git history was rewritten (force-push) to purge 142 MB of accidentally committed pack duplicates; `.gitignore` now blanket-ignores `*.gz`. If an old clone exists somewhere, delete and re-clone instead of pulling.

## Next up: v1.0 — "Daily driver" (an acceptance gate, not a feature version)

v0.9 is complete. [docs/PLAN.md](docs/PLAN.md)'s 1.0 row is a GATE with no new features:
30 consecutive days of real use (≥25 `/daily-pull` runs), ≥1,500 studyable words per language
with level + example and ≥60% human audio, a daily loop under 45 minutes, `pack verify` green,
the pack published on GitHub Releases under CC BY-SA, and a proven backup/restore on a second
browser profile. Most of those are already true; **the one that is not is the habit itself.**
So 1.0 is mostly a month of using the app, with `/curate-pack` weekly to catch source rot.

Two things worth doing before/while that month runs:

1. ~~**Deploy it for real.**~~ **DONE 2026-08-03** — live at
   <https://nhhandevops.github.io/multilingual-studies/>, verified by
   `tools/e2e/verify-v10-live.mjs`. See "Current state" for the four pipeline defects fixed
   first, and "Release flow" below for how to cut the next release. Both one-time repo
   settings are in place (Pages enabled; `v*` tag rule on the environment), so a `v*` tag
   push deploys automatically. Lighthouse's installability audit is still unrun (manual
   step; the criteria themselves are asserted by verify-v09).
2. **Test the real iPhone path — the last unverified claim in the version.** The Add-to-Home
   overlay, standalone display mode, and Safari's storage limits are all coded and reasoned from
   documentation; none has met an actual iPhone. **No script can cover this** — the whole point
   is behaviour Chrome does not reproduce — so it is a manual run, and the procedure is written
   here so it does not have to be re-derived. Needs nothing local: the live URL is the target.

   *Prep:* **Safari** (only Safari creates a true standalone web app on iOS), **Wi-Fi** (the
   first run downloads ~56 MB), ~500 MB free.

   | # | Do | Must see | A failure here means |
   |---|---|---|---|
   | 1 | Open the live URL in a Safari TAB | The Add-to-Home note at the foot of the page (`ios.hint` + `ios.steps`) | `isIos()` in [ios-a2hs.tsx](apps/web/src/components/ios-a2hs.tsx) is wrong on this device |
   | 2 | Let the pack install in the tab | "Đang tải gói dữ liệu (56 MB…)" then `Gói dữ liệu 2026.08.04-1` in the footer | **the riskiest step** — Safari's quota vs a 56 MB OPFS pack. Record the exact message |
   | 3 | Share (□↑) → Thêm vào MH chính | The icon on the home screen (the real 192/512 PNG, not a page snapshot) | the webmanifest icons are not being picked up |
   | 4 | Open from the icon | **No address bar, no Safari chrome**, and the Add-to-Home note is GONE | standalone is not active, or `isStandalone()` is wrong on iOS |
   | 5 | Airplane mode, reopen from the icon | Search, `/review` and `/grammar` all work | the v0.9 offline promise does not hold on iOS |
   | 6 | Airplane off → `/review` → "Sao lưu tiến độ" | The storage line: persisted or not, plus MB used. If not persisted, press **Bảo vệ dữ liệu** | note whether Safari grants it or shows `storage.protectDenied` — Safari differs from Chrome here and the docs are vague |

   **Expected, NOT a bug:** the home-screen app has storage separate from the Safari tab, so
   step 4 downloads the 56 MB pack a second time. That is iOS, not us.
   **The one that needs patience:** Safari evicts site data after **7 days unused** for tab
   usage; home-screen apps are supposed to be exempt. Leaving the installed app untouched for
   8–9 days and finding study progress intact is the only real proof, and nothing else can
   substitute for it.
3. **The v1.0 gate itself: 30 days of real use, ≥25 daily pulls.** `pnpm ingest daily:all` →
   `pack:build` → `pack:verify` → `pack publish` (stop `pnpm dev` first), driven by the
   `/daily-pull` skill. Note this is per-clone work in one respect: `build/staging.db` is
   gitignored, so a clone that has never pulled has `/today` without fresh news and cannot pass
   `verify-v06` — see the `verify-v06` note in "Current state" for the one-liner that tells you
   which case you are in.
4. **The backup confirmation is new UX and has only met an acceptance script.** An export now
   asks "did the file save?" and only a Yes records the backup. If a month of real use shows the
   prompt is noise, the lever is `onExport` in [review.tsx](apps/web/src/routes/review.tsx) — but
   do not go back to recording a backup nobody confirmed; that is the bug it replaced.
5. **Three defects found on 2026-08-11 are diagnosed and measured but NOT fixed.** Each needs a
   decision rather than a keystroke, which is why none was patched in passing:
   - **Make the ID-churn gate compare against what is LIVE.** Today it compares against the
     previous pack in the local `build/packs/`, so it cannot see a row that exists only in the
     published pack — which is exactly how a hand-written tip nearly disappeared. `packs.lock.json`
     already carries `dbSha256` per published version; the cheap version is for `pack publish` to
     refuse when a gated table shrinks against the newest release, the thorough version is to
     download that release and diff IDs. Decide which.
   - **Gate `daily_plan` on senses, not just existence.** One line in
     [verify.ts](packages/content-pack/src/verify.ts) next to the existing `orphanPlan` check:
     a planned word with zero `senses` is a card with a blank answer, and `en:w:cefrj:media`
     shipped that way twice. The 289 en / 100 fr senseless levelled words stay searchable —
     only *planning* one should fail the build.
   - **Decide what to do about WordNet sense order.** 4 of 10 sampled English words lead with a
     rare sense and `resilience` has no human sense at all. Options: reorder senses by frequency
     (a frequency list is already in the pack — `freq-hermitdave`), or pick the sense at curation
     time and store it on the plan row. The second is smaller but only helps the day's words.
6. **Two smaller carried-forward decisions, both stated so they are not rediscovered.**
   - The 8,918 `audio-cmn*` rows still say `CC BY-SA 3.0` while the source says only `CC BY-SA`.
     Either change them to an unversioned string or retry the Wayback lookup (it 429'd on
     2026-08-11) and record the real version. Credit + share-alike is correct under either.
   - Making `staging.db` portable is still the alternative to the one-publishing-machine rule.
     It is 249 MB here; it only becomes worth building if a second machine has to publish.

## Release flow (referenced by deploy.yml)

Cutting a release that the deploy workflow will pick up:

1. Build + verify + publish locally: `pnpm pack:build` → `pnpm pack:verify` →
   `pnpm ingest pack publish` (stop `pnpm dev` first — Windows EBUSY).
2. Create the release with ALL THREE assets from `apps/web/public/packs/` (the exact
   basenames are the contract with deploy.yml):
   `gh release create pack-<packVersion> --target main --title "Content pack <packVersion>" --notes-file <notes> apps/web/public/packs/manifest.json apps/web/public/packs/content.pack apps/web/public/packs/media.pack`
   The notes must carry the CC BY-SA statement and the credits pointer (see the
   `pack-2026.08.03-1` release for the template). A `pack-*` tag deliberately does NOT
   trigger the deploy workflow (its trigger is `v*`) — so a half-uploaded release can
   never deploy itself; the workflow also refuses any release whose three assets are not
   all `state == "uploaded"`.
3. Deploy: `gh workflow run deploy-pages --ref main` (or push a `v*` tag once the
   environment rule below is in place). The workflow picks the newest PUBLISHED
   non-draft, non-prerelease release carrying all three assets.
4. Verify: `cd tools/e2e && node verify-v10-live.mjs` — drives the public URL, needs
   nothing local.

One-time repo settings (already done unless the repo is re-created — both are outside git,
so a fork must repeat them):

- Enable Pages with Actions as the source: `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow` ✅ done 2026-08-03
- Allow tag deploys through the auto-created environment (without this, every `v*`
  tag-triggered run is REJECTED at the environment gate — the auto-created policy only
  allows branch `main`): `gh api -X POST "repos/<owner>/<repo>/environments/github-pages/deployment-branch-policies" -f name='v*' -f type=tag` ✅ done 2026-08-03 (run by the owner — the call is permission-gated for the agent)

Carried forward from 0.9, none blocking:

1. **The storage-lock takeover protocol is still not implemented** — but its worst symptom is
   gone. Measured this session: a document that has been playing audio keeps the pool's
   exclusive OPFS handles for ~20 s past a reload, and once `installOpfsSAHPoolVfs` has failed
   once, retrying *inside that document* never succeeds (sqlite-wasm logs "removeVfs() failed
   with no recovery strategy"). Only a fresh document recovers. So the app now reloads itself
   once, guarded by a `sessionStorage` flag ([app.tsx](apps/web/src/app.tsx)), and the outgoing
   page releases audio + asks its worker to terminate ([provider.tsx](apps/web/src/db/provider.tsx)).
   A genuine second tab still gets the manual screen, which is correct. A real takeover protocol
   would remove even the one reload.
2. **The media pack is all-or-nothing** — 74 MB for zh + fr together. Per-language media packs
   are a natural next step (the split is keyed on `audio.kind` in
   [build.ts](packages/content-pack/src/build.ts); keying on `audio.lang` too is a small change).
3. **`minAppVersion` is now enforced but has never fired in anger.** The path is covered by code
   and by an i18n string (`db.appTooOld`), not by an acceptance test — testing it needs a pack
   built with a deliberately-too-high requirement.
4. **Lighthouse's installability audit has not been run** — the app satisfies its criteria
   (manifest with 192+512 icons, standalone display, service worker controlling the page, all
   asserted in `verify-v09.mjs`), but the audit itself is a manual step for the deploy.

Carried forward from 0.8, none blocking:

1. **Cognates are word-level only.** The glyph pages (`/write/:glyph`) show no per-character
   Hán-Việt reading, deliberately: a character reading without an attested word invites exactly
   the composition trap the seed refuses. If ever added, keep it visually distinct from the
   attested cognates and label it "âm", not "từ".
2. **The simulator models one grade mix** (8/12/70/10 ≈ 92% pass). A learner with much lower
   retention will see more reviews than forecast. The mix is a named constant in
   [simulate.ts](packages/shared/src/srs/simulate.ts); parameterising it is cheap if wanted.
3. **`measuredSecondsPerCard` is global**, not per-language — zh cards plausibly take longer
   than en. Split when there is enough history for the split to mean something.
4. **The reach forecast ignores the daily budget cap** vs the slider: it divides by the slider
   value even if the learner's actual budget is lower. The slider defaults to the real budgets,
   so the mismatch only appears while experimenting — acceptable, but worth a label if noticed.

Carried forward from 0.7, none blocking:

1. **The term list is 161 concepts; growing it is editorial work, not code.** Add entries to
   [tech/terms.ts](apps/ingest/src/sources/tech/terms.ts) (exact article title + our slug +
   domain), re-run `seed:tech-vocab`, rebuild. The seed rejects disambiguation pages and missing
   articles loudly, so a bad title costs a log line, not bad data. Slugs are the ID contract —
   never rename one.
2. **27 terms have no Vietnamese name and 2 no Chinese.** That is Wikidata's real coverage today.
   If it matters, the fix is upstream (add the labels to Wikidata — they are CC0 and it takes a
   minute each) and a re-run picks them up; do not hand-patch the pack.
3. **Tech terms have no audio.** The term page and card offer English TTS only. Bundled
   pronunciation would need per-term recordings from a source not yet vetted.
4. **`domain` is a flat six-value tag.** Fine at 161 terms; revisit only if the list triples.

Carried forward from 0.6, none blocking:

1. **The daily pull has never run unattended.** Everything is verified by acceptance script and by
   one real pull today; the habit itself — thirty consecutive days, which is v1.0's gate — has not
   been exercised. The first thing that will break is the pinned VOA feed token; `/curate-pack`
   step 4 is where that gets noticed.
2. **`level_est` is a coverage measure, not a grading**, and it inherits v0.1's derived French
   CEFR bands, which put `cinquième` and `technologie` at C2 because they are frequency-derived
   over only 5,000 lemmas. The measure is honest about itself, but French levels are the weakest
   input it has.
3. **Chinese daily items carry no pinyin.** Word and sentence rows do; `daily_items` has no
   `reading` column, so a beginner reading VOA Chinese gets characters only. Adding one is cheap
   (`pinyin-pro` is already a dependency and `lib/pinyin.ts` exists) but was outside the 0.6 row.
4. **`license_mode='verbatim-only'` is STILL unexercised** — and v0.6 found the reason it keeps
   not happening. The natural candidate was The Conversation France (CC BY-ND, a vetted daily
   French source), and it is genuinely unusable here: ND forbids excerpting, so even a preview line
   on the Today card is a modification, *and* their republishing terms ask for a 1×1 tracking
   pixel, which an app whose every acceptance run asserts **0 off-origin requests** cannot serve.
   Worth recording as a verdict rather than a to-do.
5. **Old daily items are never pruned automatically.** `/curate-pack` step 3 does it by hand at 90
   days. At ~26 items a day that is ~2,300 rows before anyone notices — small, but it grows.
6. **The archive is 160 articles of a possible 32,737.** `QUOTA_PER_BAND` in
   [en/voa-le.ts](apps/ingest/src/sources/en/voa-le.ts) is the lever; the cost is one HTTP request
   per candidate, not bytes (160 articles are 673 KB of text).

Carried forward from 0.5, none blocking:

1. **The pack size decision.** 130.1 MB works but should be chosen, not inherited. Levers, in
   order of how little they cost: French word audio `LEVELS`
   ([fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts), −14 MB for A1+A2 only), zh word
   audio at `18k-abr` (−8 MB), stroke data restricted to HSK + top-N (−9 MB), or **split media
   into an optional second pack** — the real answer, which v0.9 forces anyway.
2. **Grammar is a reader, not a deck.** No grammar cards, no `CardSnapshot` change — that was
   outside the 0.5 row. If grammar ever becomes card-backed, revisit the Chinese IDs first: they
   key on the point's text, so an upstream rewording moves the ID, which is harmless for a reader
   and not for SRS state.
3. **The Tex audio link rides in `external_links` as a pseudo-URL** (`audio:<id>`), filtered out
   by the reader before rendering. Works, but if grammar examples ever grow past one clip per
   page, give them a real `grammar_examples` table instead of overloading a links column.
4. **`license_mode='verbatim-only'` is still unexercised.** Every grammar source so far is either
   `bundled` (Tex CC BY, Wikibooks CC BY-SA, the HSK list) or linked without a source row at all.
5. **地 has thinner coverage than 的 and 得.** All three link out, but if a bundled explanation is
   ever wanted, Wikibooks Chinese (Mandarin) Lesson 3 covers 的 and 得 and **not** 地.

**The v0.2 → v0.3 in-place upgrade is verified**, not assumed: an existing install on the
pre-v0.3 pack with real SRS state (cards, a review, a streak) upgrades on reload — pack version
advances, `user.db` is untouched, streak/daily stats/deck survive, v0.2-era cards still render
from their own snapshots, and every v0.3 feature works afterwards.
Script: `tools/e2e/verify-upgrade-v02-to-v03.mjs`.

If the pack update is unreachable (offline) the worker keeps the installed pack, which may
predate v0.3. `graphemes` has existed since v0.1, so those pages get **empty results, not
errors** — they now say so explicitly (`db.packTooOld`) instead of showing a bare empty grid.

Known follow-ups from v0.3, none blocking:

- **Tone drills are not SRS-backed.** `/tones` scores in memory only. Making a tone card a real
  card is now cheap: syllable graphemes carry `audio_id`, `playAudio()` exists, and
  `CardSnapshot.kind` is an optional enum that can take a third value (keep it optional — v0.2
  cards must still validate).
- **Uppercase letterforms are geometric**, not handwriting models: A–Z are straight-line
  skeletons. Fine for tracing, but a cursive/print teaching model would be better.
- **The pack is 47.5 MB gz.** Levers if that becomes a problem: restrict stroke data to HSK +
  top-N frequency (~−9 MB), drop to `18k-abr` audio (~−2.5 MB), or split media into an optional
  second pack. Nothing needs this yet.
- **`/write` browses hanzi by HSK level or stroke count only** — no search box on that page.
- The **storage-lock takeover protocol** is still owed (see below); it is the oldest real debt.

## Fresh-machine setup

Requirements: Node ≥ 20, pnpm ≥ 9, git. (Python 3.12 not needed until 0.4+.)

```sh
git clone https://github.com/nhhandevops/multilingual-studies && cd multilingual-studies
pnpm install                  # build approvals for better-sqlite3/esbuild are committed in pnpm-workspace.yaml
pnpm ingest seed:all          # ~170 MB of downloads → apps/ingest/data-cache/ (gitignored), builds build/staging.db
pnpm pack:build && pnpm pack:verify
pnpm ingest pack publish      # copies pack into apps/web/public/packs/
pnpm dev                      # http://localhost:5173
```

**Budget ~2.5 hours for a first `seed:all`, almost all of it in one seed.**
`seed:fr-word-audio` fetches 2,782 individual files from Wikimedia Commons, which throttles to
roughly 2 concurrent requests — about 2 hours on its own. Everything else together is minutes.
It is checkpointed per file and caches its license lookups, so an interrupted run resumes
where it stopped; leave it running and come back. To skip it for a first look, run the other
seeds individually (`pnpm ingest seed:zh-cedict`, …) — French words then simply fall back to TTS,
and nothing else is affected. To bundle *less* French audio, narrow `LEVELS` in
[fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts) before the first run.

Notes:

- `seed:all` is idempotent and resumable; re-runs skip unchanged inputs (hash check).
  If a downloaded file's hash differs from `sources.lock.json`, you get a warning, not a failure — upstream moved; that's expected for CC-CEDICT (updated daily).
- **Fixing a parser is not enough to re-ingest** — the skip is keyed on the input hash, so bump
  the seed's `PARSER_VERSION` (it folds into the ingest hash, never the lock hash) or the corrected
  run is skipped as "unchanged". This has bitten twice; `zh-pinyin-audio` and `fr-word-audio` both
  carry one.
- The pack in `apps/web/public/packs/` is **gitignored** — every machine builds its own from sources (same stable IDs ⇒ same user progress compatibility).
- Acceptance scripts live in [tools/e2e/](tools/e2e/) (`cd tools/e2e && npm install`, then
  `node verify-v06.mjs` with `pnpm dev` running). They need an installed Chrome; set
  `CHROME=/path/to/chrome` if it is not in a standard location. **All 17 pass on v0.9.** One of
  them, `verify-upgrade-v02-to-v03.mjs`, must run against `static-server.mjs` rather than
  `pnpm dev` — see [tools/e2e/README.md](tools/e2e/README.md); running it in a blanket loop
  always "fails", which is how a real v0.4 bug stayed hidden until v0.6.
- `gh` CLI is optional: plain `git push` works with stored credentials; repo creation was done via API.

## The database (content pack) — what it is and how to use it

> **Tiếng Việt:** `content.db` là từ điển SQLite (147k từ EN/ZH/FR) được build tự động từ các
> nguồn miễn phí. KHÔNG sửa file .db bằng tay — muốn thêm dữ liệu thì viết/chạy module trong
> `apps/ingest` rồi build lại pack. File này không nằm trong git; máy khác lấy nó bằng cách
> tự build (cách A) hoặc tải từ GitHub Releases (cách B).

> **Size as of v0.9: the pack is SPLIT.** `content.pack` **56.4 MB gz** (was 130.5 as one file:
> 87.6 in v0.4 → 130.1 in v0.5 → 130.4 in v0.6/v0.7 → 130.6 in v0.8) plus an OPTIONAL
> `media.pack` **74.1 MB gz** holding the 9,991 word recordings. A first install downloads only
> the core; the audio pack is offered where its value shows and can be removed any time.
> Roughly 30 MB of the core is stroke JSON — the largest remaining payload.
> Both files sit under the GitHub Pages 100 MB/file cap, which is what makes the deploy possible.
> Further levers if the core still needs to shrink: restrict stroke data to HSK + top-N, and the
> `LEVELS` constant in [fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts) (which now
> only changes the MEDIA pack). The published v0.1 release asset is still the old 27.7 MB pack:
> it works, but has no `graphemes`/`hanzi_info`/`audio`/`sentences`, so `/write`, `/pinyin`,
> examples and every 🔊 will be empty — rebuild from sources (way A) or use the v0.9 release.

**What it is.** `content.db` is a read-only SQLite database holding all study content
(tables: `words`, `senses`, `graphemes`, `hanzi_info`, `audio`, `audio_blobs`, `sources`, `meta`,
FTS index `words_fts`;
later: sentences, grammar…). It is **generated, never edited**: `apps/ingest` downloads vetted sources into
`data-cache/`, normalizes them into `build/staging.db`, and `pack build` produces
`build/packs/<version>/content.db` (+ `content.db.gz` + `manifest.json` with sha256).
`pack publish` copies it to `apps/web/public/packs/content.pack`; the web app downloads that once,
verifies the hash, and installs it into the browser's private OPFS storage. At runtime the app
never reads from the repo folder. User progress will live in a **separate** `user.db` (from v0.2)
— per-device, never in git, never inside the pack.

**Getting the DB on another machine — two ways:**

- **A. Rebuild from sources (canonical):** `pnpm ingest seed:all && pnpm pack:build && pnpm pack:verify && pnpm ingest pack publish`. ~110 MB of downloads, a few minutes. Deterministic IDs ⇒ the result is compatible with any machine's user progress.
- **B. Download the ready-made pack:** grab `content.db.gz` + `manifest.json` from the [v0.1 release](https://github.com/nhhandevops/multilingual-studies/releases/tag/v0.1), rename `content.db.gz` → `content.pack`, put both files in `apps/web/public/packs/`. Done — `pnpm dev` serves it. (Keep the `.pack` name — see invariant 3.)

**Adding/updating data — the only correct path:**

1. Vet the source's license in [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md) first (NC/ND/GPL = do not bundle).
2. Write or extend an ingest module in `apps/ingest/src/sources/<lang>/` — it must call `registerSource()` and derive IDs via `@mls/shared` `ids.ts`. Register the command in `apps/ingest/src/cli.ts` SEEDS map.
3. Run it (`pnpm ingest seed:<name>`), then `pnpm pack:build && pnpm pack:verify` (verify enforces attribution, license modes, and ID stability) and `pnpm ingest pack publish`.
4. Commit the code + `sources.lock.json` change; publish the new pack to GitHub Releases when a version ships.

Hand-editing a `.db` file is always wrong: it gets overwritten by the next build, bypasses license
checks, and its changes exist on one machine only. The ingest modules ARE the database's source of truth.

**Inspecting the data:** open `build/packs/<version>/content.db` (or `build/staging.db`) with any
SQLite tool — [DB Browser for SQLite](https://sqlitebrowser.org/), `sqlite3` CLI, or DBeaver.
Try: `SELECT headword, reading, level FROM words WHERE lang='zh' AND level='HSK1' LIMIT 20;`

**About stray `content.db*.gz` files:** on 2026-07-29 the dev-server pack URL was downloaded
several times in a browser, leaving 7 identical `content.db*.gz` copies in the repo root; 6 were
accidentally committed and later purged from git history (force-push, 2026-07-30). `.gitignore`
now blanket-ignores `*.gz`. If you see such files: they are redundant browser downloads — delete them.

## Invariants — do not break

1. **Stable content IDs** ([packages/shared/src/ids.ts](packages/shared/src/ids.ts)) — the contract that keeps future SRS state alive across pack upgrades. Never change derivation without a rename/migration plan; `pack verify` fails on >0.5% word-ID churn between consecutive packs.
2. **License discipline** — never add a data source not vetted in [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md). Known traps: Chinese Grammar Wiki (CC BY-NC-SA → link-only), Oxford 3000 (© OUP), RFI (scraping ban), Verbiste/FreeDict (GPL data vs App Store), Tatoeba CK audio (NC-ND). Every ingest registers a `sources` row; `license_mode` ('bundled'/'verbatim-only'/'link-only') is enforced by `pack verify`.
3. **Pack file extension** — the published pack is `content.pack` (gzip inside). Do not rename to `*.gz`: servers (incl. Vite dev) special-case `.gz` with `Content-Encoding` and corrupt the stream. The worker sniffs gzip magic bytes either way.
4. **Schema changes** — edit [packages/content-pack/src/schema.sql](packages/content-pack/src/schema.sql), bump `SCHEMA_VERSION` in build.ts if breaking, delete `build/staging.db` and re-run `seed:all` (cached downloads make this fast). FTS tables are contentless (`content=''`) — clear with `INSERT INTO x(x) VALUES('delete-all')`, never `DELETE`.
5. **Git flow** — commit + push at the end of every session; each finished version gets an annotated tag (`git tag -a v0.x`) pushed with `--follow-tags`. Update this HANDOFF before the final push.
6. **user.db is sacred and separate** (from v0.2) — the learner's SRS state lives in OPFS at
   `/user.db`, never inside the content pack, never in git. Rules: the pack-update path may only
   ever touch `/content.db`; never call `poolUtil.wipeFiles()`/`removeVfs()` as a recovery tactic
   (it destroys progress); `user.db` migrations in
   [packages/shared/src/srs/schema.ts](packages/shared/src/srs/schema.ts) are **append-only** —
   add a batch, never edit a shipped one, and let `USER_SCHEMA_VERSION` derive from the array
   length. Cards key on raw word IDs (never URL-encoded) and must render from their `snapshot`
   JSON, never by joining `content.db` — words may legitimately vanish between packs.

## Repo map

| Path | What |
|---|---|
| `docs/PLAN.md` | Master plan: architecture + versioned roadmap 0.1→2.0 (the "what's next" oracle) |
| `docs/RESEARCH-SOURCES.md` | Verified free-source & license ledger (2026-07-29 deep research) |
| `apps/ingest` | CLI: `pnpm ingest seed:…` / `pack build` / `pack verify` / `pack publish` |
| `apps/web` | React 19 + Vite PWA; sqlite-wasm worker in `src/db/sqlite.worker.ts` (owns content.db **and** user.db); `src/db/user-queries.ts` = all SRS SQL; `src/routes/review.tsx`; `src/srs/clock.ts` = debug clock |
| `apps/web/src/components/stroke-writer.tsx` | (v0.3) hanzi-writer wrapper — data comes from the pack, never the network; works for any glyph with `{strokes,medians}` |
| `apps/ingest/src/sources/fr/word-audio.ts` | (v0.4) Lingua Libre FR audio via Commons — mp3 transcodes found in the cached kaikki file; **license verified per file, never assumed**; `LEVELS` is the pack-size lever |
| `tools/e2e/` | (v0.4) the acceptance scripts every "Verified: …" line below refers to, plus a README of what each proves. No machine-specific paths — repo root is derived, Chrome comes from `$CHROME` |
| `apps/web/src/audio/tts.ts`, `components/speak-button.tsx` | (v0.4) speech-synthesis fallback + the one button both routes use: recording → synthesis → nothing. Synthetic playback is always labelled |
| `apps/web/src/routes/write.tsx`, `glyph.tsx` | (v0.3) `/write` browse-by-level/strokes, `/write/:glyph` animate · trace · decomposition · add writing card |
| `apps/web/public/licenses/ARPHICPL.TXT` | (v0.3) **must stay committed** — the Arphic PL requires redistributing its text; `pack verify` fails if it goes missing |
| `packages/shared` | ID derivation (contract!), Zod types, `src/srs/` = user.db schema + ts-fsrs wrapper (`@mls/shared/srs`) |
| `packages/content-pack` | schema.sql (contract!), pack builder/verifier |
| `sources.lock.json` | sha256 + license of every raw download (auto-maintained) |
| `.claude/skills/` | (v0.6) `/daily-pull` (the six-step daily contract) and `/curate-pack` (the weekly licence + liveness audit) |
| `apps/ingest/src/daily.ts` | (v0.6) the `daily:*` / `tips:add` CLI the skill drives; `daily:all` degrades per source instead of aborting |
| `packages/shared/src/wire.ts` | (v0.6) the wire-agency screen — a LICENCE rule, applied by ingest and re-applied by `pack verify`. 35% of VOA Learning English fails it |
| `apps/ingest/src/lib/level.ts` | (v0.6) measured difficulty: the band at which 90% of recognised words sit at or below. Not a CEFR grading; declines below 20 recognised tokens |
| `apps/web/src/routes/today.tsx` | (v0.6) `/today` — news, graded reading, word of the day → SRS, tip. Every section degrades rather than disappearing |

## Testing recipe (browser verification)

No test framework yet (deliberate — 0.1/0.2). End-to-end checks are ad-hoc Playwright scripts
driving an installed Chrome, and they live in **[tools/e2e/](tools/e2e/)** — see its
[README](tools/e2e/README.md) for what each one proves.

```sh
cd tools/e2e && npm install     # playwright-core only; it drives your own Chrome
pnpm dev                        # in another terminal, from the repo root
node verify-v04-p3-p4.mjs       # CHROME=/path/to/chrome if it is not in a standard location
```

They were kept in a scratch directory until v0.4, which meant every "Script: …" line in this file
was a dangling reference on any other machine. Nothing in there may be machine-specific now: the
repo root is derived from the script's own location and Chrome is discovered or taken from
`$CHROME`. New scripts should navigate to the dev server and wait for `input.searchbox` (pack
install can take ~1 min on the first run). See PLAN's per-version "Verify" bullets for what each
release must demonstrate.

Gotchas learned the hard way (they cost real debugging time):

- **Don't assert on `ul.words li` alone after typing a query** — the previous query's rows linger
  through the 150 ms debounce in [home.tsx](apps/web/src/routes/home.tsx), so you read stale rows.
  Wait for the expected headword (`waitForFunction`) instead.
- Same class of trap on `/review`: the done screen flips phase before its stats refresh lands, so
  poll for the final numbers rather than reading once.
- The backup file input is `display:none` — Playwright needs `{ state: 'attached' }`, and
  `setInputFiles` works fine on it (no need to click the visible button).
- A fresh `browser.newContext()` gets an empty OPFS, so every run re-downloads and re-installs the
  pack (~2 s from localhost) and starts with an empty `user.db` — that is what makes SRS runs
  repeatable.
- **To test a pack UPGRADE, serve the built app statically, not through `pnpm dev`** — Vite's
  watcher dies when `content.pack` is swapped. `tools/e2e/static-server.mjs` serves
  `apps/web/dist` with no watcher, which is what makes the upgrade test possible.
- `page.reload()` re-requests the *current* URL. After in-app navigation you are no longer on
  `/`, so don't wait for `input.searchbox` after a reload — wait for `footer.pack`.
- **Stop `pnpm dev` before `pnpm ingest pack publish`.** On Windows, overwriting
  `apps/web/public/packs/content.pack` while Vite watches it kills the dev server with `EBUSY`.
- To fast-forward the scheduler:
  `page.evaluate(ms => localStorage.setItem('mls_debug_clock_offset_ms', String(ms)), 4*864e5)`
  then reload. v0.2's acceptance run saw the "Good" interval grow 2 d → 16 d this way, and v0.3's
  grapheme card reproduced exactly the same 2 d → 16 d.
- **Navigate in-app (`page.click` on a nav `<a>`), not with `page.goto`, once the app is loaded.**
  A fresh document load can lose the exclusive OPFS handles to a page Chrome froze in the
  back/forward cache; you then get the (now friendly) "reload to continue" screen mid-test. This
  cost real debugging time — see the storage-lock note above. `tools/e2e/probe-locked.mjs`
  reproduces it deliberately.
- **To test the stroke quiz for real, replay the character's own medians as pointer events.**
  Read `graphemes.stroke_json` straight from the built pack, then invert hanzi-writer's Positioner:
  bounds are `(0,-124)..(1024,900)`, so with `width=height=260, padding=12`,
  `scale = 236/1024`, `xOffset = 12`, `yOffset = 124*scale + 12`, and
  `local = (cx*scale + xOffset, 260 - yOffset - cy*scale)`; add the SVG's `getBoundingClientRect()`
  origin. That is what proves the packed stroke data is *usable*, not merely present.
- `/review`'s done screen keeps `phase='done'` when you click the nav link to `/review` (same
  route ⇒ no remount). Click the done screen's own back button instead.
- **A stub kinder than the real API is a test that passes for the wrong reason.** Headless Chrome
  ships no speech-synthesis voices, so `window.speechSynthesis` has to be stubbed — and the first
  stub returned a full voice list from the very first `getVoices()` and never fired
  `voiceschanged`. Every assertion passed while the entire async-arrival path went unexercised.
  Model the API's *awkward* behaviour (empty first, event later), not its convenient one; the
  corrected stub failed until the code was actually right.
- **Assertions can encode the bug.** The same script asserted French credits matched
  `/CC BY-SA 4.0/` — the exact false assumption that the seed was hardcoding. It "passed" until
  real per-clip licenses arrived, then failed on correct data. When a test hardcodes a constant
  the code also hardcodes, it proves only that the two agree.
