# گزارش بررسی حرفه‌ای — ۶ سناریوی کلیدی سایت

تاریخ: ۹ اکتبر ۲۰۲۶
روش: بررسی کد + تست End-to-End زنده (ثبت‌نام، آپلود، ثبت‌نام رویداد، خرید، دانلود، ذخیره ادمین)

---

## ۱. ثبت‌نام کاربر به‌عنوان خریدار و هنرمند + پروفایل واقعی

**✅ بله — کاملاً واقعی و تست‌شده.**

- صفحهٔ `/signup` برای **خریدار** (role=user) و `/creators/join` برای **هنرمند** (role=artist).
- ثبت‌نام از طریق `POST /api/auth/signup`:
  - خریدار → رکورد کاربر با `role: "user"` در `data/users.json` + کوکی session.
  - هنرمند → además یک **رکورد Artist واقعی** در `data/content.json` ساخته می‌شود (با `status: "approved"`, `slug` یکتا، `userId` linked، پلن عضویت، سرویس‌های پیش‌فرض).
- تست زنده: artiste با ایمیل `artist-test@audit.ir` ثبت‌نام کرد → رکورد `artist-4314c34c39243726` ساخته شد و صفحهٔ عمومی `/fa/artists/هنرمند-تست` **200** داد و در listeٔ `/fa/artists` هم نمایش داده شد.

**نکته:** پروفایل artista خودکار `approved` می‌شود (بلافاصله public). اگر می‌خواهیدArtists جدید ابتدا «pending review» باشند، باید `status: "approved"` در `src/lib/data/users.ts` (خط ~۲۸۴) را به `"pending"` تغییر دهید.

---

## ۲. آپلود طرح و پترن توسط هنرمندان

**✅ بله — با جزئیات:**

دو مسیر آپلود وجود دارد:

| مسیر | فایل | فرمت‌ها | محدودیت |
|------|------|---------|---------|
| `/api/artist/upload` | ảnh (کاور/گالری) | JPEG, PNG, WebP, AVIF | ۸ مگابایت |
| `/api/marketplace/upload/*` (Multipart) | فایل مادر فروش | PNG, JPG, AI, PSD, SVG, EPS + preview | ۲۰۰ مگابایت (częściowe >۲۰۰MB) |

- پنل artiste (`/fa/artist`) → تب «پترن‌ها» → فرم «پترن جدید» با انتخاب دسته‌بندی، prix، کاوروِی، 卡 stärken.
-route `POST /api/artist/patterns` پترن را در `content.patterns` ذخیره می‌کند.
-route `POST /api/artist/upload` ảnh را در object store (محلی یا S3) ذخیره می‌کند.
- ** ventes dijital** در `/fa/artist/marketplace` → تب «ارسال فایل مادر» — آپلود چندبخشی (multipart)، اسکن ویروس (ClamAV)، واترمارک، ماکاپ، و صف بازبینی.

---

## ۳. نمایش پترن آپلودی در فروشگاه و دستهٔ انتخابی

**✅ بله — آنی و واقعی (تست‌شده).**

- artiste پترن «پترن تست propia» را با `categoryId: cat-minimal` و prix ۲۵۰٬۰۰۰ تومان ساخت.
- **بلافاصله** در `/fa/patterns?category=minimal` نمایش داده شد (بدون نیاز به ریビルド یا ریفرش دستی — صفحات داینامیک هستند).
- صفحهٔ détail `/fa/patterns/پترن-تست-propia` → **200** با prix صحيح.
- فیلتر دسته‌بندی (`filterPatterns` در `src/lib/data/filters.ts`) بر اساس `categoryId` کار می‌کند.

**⚠️ نکات مهم:**
- **هیچ سیستم moderation/审核 برای پترن‌ها وجود ندارد** — `Pattern` type فیلد `draftStatus` ندارد (فقط `Portfolio` و `EducationItem` دارند). پترن artiste **فوراً public** می‌شود.
- اگر می‌خواهید پترن‌های artiste ابتدا «در انتظار تأیید» باشند، باید `draftStatus` به `Pattern` اضافه شود و `filterPatterns` فیلتر کند.

---

## ۴. ثبت‌نام در وبینار/ورکشاپ (رایگان و پولی)

**✅ بله — کاملاً واقعی و تست‌شده.**

- صفحهٔ `/fa/academy` همهٔ دوره‌ها/ورکشاپ‌ها/وبینارها را نمایش می‌دهد.
- `POST /api/academy/enroll`:
  - **رایگان** → `accessGranted: true` فوری، `paymentDue: false`.
  - **پولی** → `accessGranted: false`, `paymentRequired: true` — دسترسی تا تأیید پرداخت توسط ادمین در پنل «رزرو رویدادها» (`ReservationsManager`) مسدود می‌ماند.
- Резервация در `data/reservations.json` ذخیره می‌شود و در پنل ادمین «رزرو رویدادها» قابل مشاهده و مدیریت است (تأیید پرداخت، لغو دسترسی، …).
- صفحهٔ `/fa/academy/[slug]/live` فقط برای техی که `accessGranted` دارند باز است (`hasGrantedReservation`).
- Rate-limiting روی enroll فعال است (429 بعد از تلاش‌های مکرر).

**🐛 باگ مهمی که در این بررسی پیدا و رفع شد:**
- Функция `normalizeEventHosts` در `src/lib/data/store.ts` فرض می‌کرد همهٔ education items فیلدهای `title`/`excerpt`/`body` را دارند. اگر یک وبینار/ورکشاپ **بدون** این فیلدها ذخیره می‌شد (مثلاً توسط API یا artiste)، کل `getContent()` با `TypeError` fail می‌کرد و **کل سایت از دسترس خارج می‌شد** (catch block → seedContent → محتوای ادمین «گم» می‌شد).
- **رفع شد:** `replacePreviousHost` حالا `undefined` را هندل می‌کند و `title` خالی → `{fa:"",en:""}`.

**⚠️ محدودیت:** پرداخت خودکار برای وبینار/ورکشاپ پولی وجود ندارد — flujo «ثبت‌نام → انتظار تأیید پرداخت توسط ادمین» است. اگر می‌خواهید پرداخت آنلاین مستقیم داشته باشید، باید `/api/academy/enroll` به `/api/marketplace/checkout` لینک شود.

---

## ۵. خرید و دانلود پترن توسط خریداران

**⚠️ نیمه‌کاره — دو سیستم checkout جداگانه وجود دارد:**

### سیستم A: `/checkout` (Legacy — энергосбережение ساده)
- PatternCard → «افزودن به سبد» → `/checkout` → `POST /api/orders`.
- فقط یک **رکورد سفارش** در `data/orders.json` ایجاد می‌کند.
- **❌ هیچ پرداخت، هیچ لایسنس، هیچ دانلودی ندارد.** خرید «ثبت سفارش» است و باید دستی پردازش شود.

### سیستم B: `/marketplace` ( کامل — paiement + license + téléchargement)
- `/fa/marketplace` → انتخاب فایل دیجیتال → `/fa/marketplace/cart` → `POST /api/marketplace/checkout`.
- پرداخت واقعی: **Zarinpal** (IRR) یا **Stripe** (USD) — در حالت تست **sandbox gateway**.
- بعد از پرداخت موفق:
  - لایسنس صادر می‌شود (PDF certificate + QR).
  - Рекورد%n royalties برای artiste.
  - لینک دانلود با توکن HMAC (short-lived) در `/api/marketplace/licenses`.
  - دانلود از `/api/marketplace/download?token=…` با quota (مثلاً ۵ دانلود).
- **تست زنده کامل:** خرید «داماسک مسی — لایسنس شخصی» (۴۵۰٬۰۰۰ تومان) → sandbox payment → `settled: true` → لایسنس `RA-LIC-2026-000007` → `downloadUrl` موجود.

**🔗 شکاف اصلی:** پترنی که artiste در `/fa/artist` آپلود می‌کند (سیستم A) **خودکار** به marketplace asset (سیستم B) تبدیل نمی‌شود. artiste باید جداگانه در `/fa/artist/marketplace` → «ارسال فایل مادر» آپلود کند تا قابل فروش با لایسنس شود.

**توصیه:** یا:
1. اتصال دو سیستم: بعد از آپلود پترن، artiste بتواند «این پترن را برای فروش بگذارم» → خودکار marketplace asset بسازد.
2. یا سیستم A (`/checkout` + `/api/orders`) یا حذف شود یا به سیستم B متصل شود.

---

## ۶.印 cargas ادمین — آیا همهٔ تب‌ها واقعاً روی سایت اعمال می‌شوند؟

**✅ بله — تست‌شده.**

- پنل ادمین (`/admin/fa`) → `AdminApp.tsx` → `update(patch)` → `save()` → `PUT /api/admin/content`.
- `PUT /api/admin/content` → `sanitizeDeep(body)` → `saveContent()` → `data/content.json` (با ETag/optimistic locking).
- صفحات عمومی (`getSite()` → `getContent()`) **بلافاصله** محتوای جدید را می‌خوانند (همهٔ صفحات `dynamic = "force-dynamic"`).
- تست زنده: یک banner تست از طریق API ادمین اضافه شد → **بلافاصله** در `/fa` (homepage) نمایش داده شد.

** Innovación mécanismes adicionales:**
- sauvegarde «financial» → aussi POST vers `/api/marketplace/admin` (تنظیمات VAT، سهم artiste، …).
- `router.refresh()` بعد از save — RSC re-render.
- ETag conflict → 409 (جلوگیری از lost-update).

**⚠️ apuesta:** системa `draftStatus` برای `EducationItem` و `Portfolio` وجود دارد، ولی **صفحات عمومی فیلتر نمی‌کنند** — یعنی محتوای «draft» یا «pending_review» هم public نمایش داده می‌شود. اگر می‌خواهید workflow审核 واقعی باشد، صفحات عمومی باید `draftStatus === "published"` فیلتر کنند.

---

## 🎯 نتیجه‌گیری کلی

| # | سناریو | وضعیت | ghi chú |
|---|--------|-------|---------|
| 1 | ثبت‌نام خریدار + artiste + پروفایل | ✅ کامل | تست‌شده end-to-end |
| 2 | آپلود پترن توسط artiste | ✅ کامل | ۲ مسیر: ảnh + فایل mother |
| 3 | نمایش در فروشگاه + دسته | ✅ کامل | آنی، تست‌شده |
| 4 | ثبت‌نام وبینار/ورکشاپ (رایگان/پولی) | ✅ کامل | باگ مهم پیدا و رفع شد |
| 5 | خرید + دانلود پترن | ⚠️ نیمه‌کاره | ۲ سیستم checkout جداگانه |
| 6 |印 cargas ادمین → سایت | ✅ کامل | تست‌شده، بلادرنگ |

### 🐛 باگ رفع‌شده در این بررسی
1. **Crash kritisk** در `normalizeEventHosts` (`src/lib/data/store.ts`) — اگر education item فیلد `title`/`excerpt`/`body` نداشته باشد، کل `getContent()` fail می‌کرد و سایت به seed fallback می‌رفت (محتوای ادمین «گم» می‌شد). **رفع شد.**

### ⚠️建议‌های amélioration
1. **متصل کردن ۲ سیستم checkout** — یا `/checkout` legacy را حذف کنید یا به marketplace متصل کنید.
2. **审核 (moderation) برای پترن‌های artiste** — اضافه کردن `draftStatus` به `Pattern`.
3. **فیلتر `draftStatus === "published"`** در صفحات عمومی برای Education و Portfolio.
4. **پرداخت آنلاین مستقیم** برای وبینار/ورکشاپ پولی (اتصال enroll به marketplace checkout).
5. ** Masculino automática artiste → marketplace asset** — بعد از آپلود پترن، امکان «فروش این پترن».
