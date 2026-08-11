# warning_bug_and_solutions

Sổ sự cố của project. Mỗi mục: **triệu chứng → nguyên nhân gốc → cách xác minh → cách sửa → ngày**.

Chỉ ghi những thứ đã **đo được**, không ghi phỏng đoán. Chi tiết dài về từng phiên bản nằm ở
[HANDOFF.md](../HANDOFF.md); file này là nơi tra nhanh khi gặp lại triệu chứng.

---

## 1. ID-churn gate không nhìn thấy ID biến mất so với bản ĐANG LIVE

**Triệu chứng.** `pack verify` xanh, nhưng pack vừa publish **thiếu một `tips` row** mà bản đang
chạy trên GitHub Pages có. Không có cảnh báo nào.

**Nguyên nhân gốc.** Cổng ID-churn trong
[packages/content-pack/src/verify.ts](../packages/content-pack/src/verify.ts) so ID với
`findPreviousPack(packsDir, ...)` — tức pack **trước đó trong `build/packs/` của MÁY ĐANG BUILD**.
`build/` bị gitignore, nên trên setup hai máy, "pack trước đó" của máy này không phải bản đang live.
Tip do máy kia viết chưa bao giờ tồn tại trong `build/packs/` của máy này, nên gate không có gì để
so → 0% churn → xanh.

Đây là cùng một gốc với chuyện `daily_items` bị cắt (212 → 166 → 238 → 175), nhưng nguy hiểm hơn vì
`tips` **nằm trong** gate và người ta tin là đã được bảo vệ.

**Cách xác minh.**
```sh
gh release download pack-<version> -p content.pack -D <tmp>
# content.pack là gzip của sqlite; giải nén bằng stream, đừng buffer (db ~163 MB)
node -e "…so sánh SELECT id FROM tips giữa pack live và build/staging.db…"
```
Ngày 2026-08-11: pack live `2026.08.04-2` có 17 tips, `staging.db` máy Windows có 16.
`words`/`grammar_topics`/`tech_terms` giống hệt nhau — chỉ `tips` lệch.

**Cách sửa.** Dựng lại row **từ chính bytes đã publish**, không gõ tay lại từ mô tả.
`tips:add` nhận trường `date` tuỳ chọn (`assertIsoDate`, không phải `assertPullDate`), nên
`tipId(lang, date, 'daily-'+slug)` trả về **đúng ID cũ** → là thêm lại, không phải tạo ID mới.
Đã khôi phục `fr:tip:2026-08-04:daily-tu-viet-giong-doc-khac`.

**Còn tồn.** Gate vẫn chỉ so với pack local. Sửa triệt để cần cho `pack publish` so với
`packs.lock.json` (đã có sẵn `dbSha256`) hoặc với release mới nhất. Xem "Next up" trong HANDOFF.

**Ngày:** 2026-08-11.

---

## 2. `daily_plan` trỏ được vào một từ KHÔNG có nghĩa nào — thẻ hiện đáp án trống

**Triệu chứng.** "Từ của ngày" trong `/today` cho thêm được vào bộ thẻ, nhưng mặt sau thẻ trống.

**Nguyên nhân gốc.** `pack verify` chỉ kiểm `daily_plan.word_id` **có tồn tại trong `words`**:
```sql
SELECT COUNT(*) FROM daily_plan p WHERE NOT EXISTS (SELECT 1 FROM words w WHERE w.id = p.word_id)
```
Nó không kiểm từ đó có `senses` hay không. Một từ có trong `words` nhưng 0 `senses` vẫn qua cổng.

**Cách xác minh.**
```sql
SELECT p.date, p.word_id FROM daily_plan p
WHERE NOT EXISTS (SELECT 1 FROM senses s WHERE s.word_id = p.word_id);
```
Ngày 2026-08-11 cho ra **`en:w:cefrj:media`, đã lên kế hoạch 2 ngày (2026-07-31 và 2026-08-01)** —
tức là đã ship thật.

Quy mô của lớp lỗi này: từ **có level** nhưng **0 nghĩa** — `en` 289/8.648 (3,34%),
`fr` 100/5.000 (2,00%), `zh` 0. Bên `fr` gần hết là dạng biến cách/hạn định (`ma`, `toute`, `ceux`,
`uns`, `chacune`): Lexique liệt kê **dạng từ**, còn nguồn nghĩa (kaikki) chỉ có **từ nguyên mẫu**.

**Cách sửa.** Trước mắt: kiểm mọi từ định plan trước khi chạy `daily:select` (script mẫu ở phần
`/daily-pull` của phiên 2026-08-11). Triệt để: thêm cổng vào `pack verify` —
`daily_plan` không được trỏ vào từ có 0 senses. **Chưa làm** (xem HANDOFF "Next up").

**Ngày:** 2026-08-11.

---

## 3. Gloss tiếng Anh dẫn nghĩa phụ trước — thẻ dạy sai nghĩa

**Triệu chứng.** Thẻ tiếng Anh hiện một nghĩa hiếm/kỹ thuật ở dòng đầu, không phải nghĩa thường gặp.

**Nguyên nhân gốc.** Nghĩa lấy từ Open English WordNet (`oewn`), mà **thứ tự sense của WordNet
không xếp theo tần suất**. Lấy sense đầu tiên làm gloss dẫn đầu là lấy một nghĩa bất kỳ.

**Cách xác minh.** 30 gloss ngẫu nhiên (10 mỗi thứ tiếng), ngày 2026-08-11:
- `zh` 10/10 đúng, `fr` 10/10 đúng.
- `en` **4/10 dẫn nghĩa phụ**: `discovery` (B1) → nghĩa **luật tố tụng**; `smash` (B2) → "a
  conspicuous success"; `elevation` (C1) → nghĩa **thiên văn**; `impulsive` (B2) → nghĩa **vật lý**.
- Nặng nhất, phát hiện khi soạn từ của ngày: **`resilience` KHÔNG hề có nghĩa về con người** —
  cả 2 sense đều là đàn hồi vật liệu, trong khi bài báo dùng nghĩa "khả năng phục hồi".
  `shed` dẫn bằng nghĩa động từ trong khi bài dùng nghĩa "nhà kho".

**Cách sửa.** Chưa sửa dữ liệu. Trước mắt: khi chọn từ của ngày, **đọc hết các sense** rồi mới
plan; ngày 2026-08-11 đã loại `resilience`, `cocoa`, `shed`, `fortement`, `lesquelles` vì lý do này.
Hướng sửa thật: xếp lại sense theo tần suất, hoặc chọn sense khớp ngữ cảnh bài. Cần quyết định.

**Ngày:** 2026-08-11.

---

## 4. `pnpm -r typecheck` chết với exit 134 — là HẾT RAM, không phải lỗi type

**Triệu chứng.**
```
FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed - JavaScript heap out of memory
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @mls/web@0.9.0 typecheck: `tsc --noEmit`
Exit status 134
```
Dễ đọc nhầm thành lỗi biên dịch trong `apps/web`.

**Nguyên nhân gốc.** Máy hết RAM vật lý. Đo lúc lỗi: **còn 0,97 GB trống / 15,8 GB**
(VMware 1,6 GB + VS Code 0,9 GB + Brave ~3,5 GB). V8 abort ngay ở heap ~130 MB.

**Cách xác minh.**
```powershell
Get-CimInstance Win32_OperatingSystem | Select @{n='FreeGB';e={[math]::Round($_.FreePhysicalMemory/1MB,2)}}
```
Chạy `npx tsc --noEmit` trực tiếp trong `apps/web` lúc còn RAM thì **sạch, không lỗi nào**; chạy lại
lúc hết RAM thì abort. Cùng một lệnh, hai kết quả → là môi trường, không phải code.

**Cách sửa.** Đóng bớt ứng dụng rồi chạy lại. `Out-String` của PowerShell cũng ném
`OutOfMemoryException` khi format output dài — dùng Bash/`tail` cho các lệnh output nhiều.

**Ngày:** 2026-08-11.

---

## 5. Nguồn uỷ quyền giấy phép của `audio-cmn` đã chết — phiên bản CC BY-SA là do ta suy ra

**Triệu chứng.** Không có triệu chứng ở runtime. Phát hiện khi audit giấy phép **tại artifact**.

**Nguyên nhân gốc.** 8.918 clip (`audio-cmn` 1.707 âm tiết + `audio-cmn-hsk` 7.211 từ) mang **một
chuỗi giấy phép duy nhất `CC BY-SA 3.0`**. Nhưng README của repo chỉ ghi **`CC-by-sa`, không có số
phiên bản**, và trỏ tới `http://packs.shtooka.net/cmn-caen-tan/readme.txt` để xem bản gốc.
Số `3.0` là do ta điền, không phải do nguồn tuyên bố.

**Cách xác minh** (2026-08-11):
- `raw.githubusercontent.com/hugolpz/audio-cmn/master/README.md` → HTTP 200, chỉ có `CC-by-sa`.
- `api.github.com/repos/hugolpz/audio-cmn/license` → **404** (repo không có file LICENSE).
- `http://packs.shtooka.net/...` → **fetch failed** (đã chết).
- `http://shtooka.net/` → HTTP 200 nhưng là site khác: *"Copyright © 2020 Xoilac TV, All rights
  reserved."* (ledger ghi 2026-07-29 là redirect sang us-stemcell.com — tên miền đã đổi chủ lần nữa).
- Wayback trả 429 cho mọi request từ mạng này, nên **chưa đọc được bản lưu**.

Đối chiếu: `lingualibre-fra` sau bản vá v0.4 có **4 giấy phép khác nhau** (CC0 1.870, CC BY-SA 4.0
902, CC BY 4.0 9, CC BY-SA 3.0 1) — tức là kiểm theo từng file thì ra khác nhau. `audio-cmn` chỉ có
đúng 1 chuỗi cho cả 8.918 clip, nhưng đây là **một bộ thu một người đọc**, nên một giấy phép chung
có thể đúng thật; cái sai là **số phiên bản ta khẳng định mà nguồn không nói**.

**Cách sửa.** Đã sửa mô tả trong [docs/RESEARCH-SOURCES.md](RESEARCH-SOURCES.md).
**Chưa** đổi 8.918 dòng dữ liệu — cần quyết định: giữ `CC BY-SA 3.0` hay đổi sang
`CC BY-SA (phiên bản không được nguồn nêu)`. Ghi credit người đọc + share-alike thì thoả cả hai bản.

**Ngày:** 2026-08-11.
