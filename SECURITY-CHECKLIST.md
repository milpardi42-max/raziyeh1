# Security / Auth / Data / Hardening Checklist (RoziAtelier)

> این فهرست بر اساس بررسی کامل کدبیس پروژه (Next.js 15 App Router + صفحات داینامیک + ادمین پنل + آکادمی/وبینار) تهیه و اعمال شد. موارد ✅ انجام شده و موارد ⚠ نیاز به تنظیم environment variable در زمان استقرار هستند.

---

## 1. Security (هستهٔ امنیتی) ✅

### هدرهای امنیتی (middleware)
- ✅ **Content-Security-Policy** سخت‌گیرانه در لایهٔ Edge:
  - `default-src 'self'`
  - `script-src 'self' 'nonce-<random per request>' 'strict-dynamic'` — nonce به request و response می‌رسد تا Next.js اسکریپت‌های RSC/hydration را nonce کند؛ بدون `'unsafe-inline'` و `'unsafe-eval'`
  - `style-src` شامل `'unsafe-inline'` برای style props/CSS variables و فونت‌های گوگل
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
  - `frame-ancestors 'none'` در حالت عادی (جلوگیری از clickjacking)
  - `img-src`/`media-src` شامل `blob:` و `data:` و `https:` (برای HLS استریم و عکس‌های آپلودی)
  - `connect-src` شامل `wss:` برای WebRTC سیگنالینگ وبینار
  - روی میزبان‌های پیش‌نمایش (e2b.app / stackblitz / webcontainer) به‌صورت خودکار SameOrigin تر می‌شود تا iframe شدن کار کند.
- ✅ **Strict-Transport-Security** با `max-age=31536000; includeSubDomains; preload` فقط در production.
- ✅ **X-Content-Type-Options: nosniff**
- ✅ **X-Frame-Options: DENY** (SAMEORIGIN در پیش‌نمایش)
- ✅ **Referrer-Policy: strict-origin-when-cross-origin**
- ✅ **Permissions-Policy**: دوربین/میکروفون/موقعیت را برای همه‌جا پیش‌فرض غیرفعال می‌کند (برای Broadcast page درخواست مجوز جداگانه می‌دهد).

### CSRF
- ✅ توکن **Double-Submit Cookie** (`ra-csrf`) در middleware روی اولین GET کاشته می‌شود.
- ✅ همهٔ درخواست‌های تغییردهنده حالت (POST/PUT/PATCH/DELETE) روی `/api/auth/*` و `/api/admin/content` توکن را در هدر `X-CSRF-Token` چک می‌کنند (`src/lib/security/csrf.ts`).
- ✅ کلاینت با `withCsrf()` کمکی به‌صورت خودکار توکن را از کوکی می‌خواند و به هدر اضافه می‌کند.
- ✅ SameSite کوکی‌ها `Lax` است و روی پیش‌نمایش‌های cross-site `None; Secure; Partitioned`.

### XSS / Injection
- ✅ همهٔ محتوای متنی با React escape می‌شود (بدون `dangerouslySetInnerHTML` برای محتوای کاربری).
- ✅ لایهٔ دفاع مضاعف: **Sanitizer** در `src/lib/security/sanitize.ts` که قبل از ذخیره در `/api/admin/content` و `/api/auth/signup` تمام رشته‌ها را recursively پاک می‌کند:
  - حذف تگ‌های فعال `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<math>` و …
  - حذف event-handlerها (`onclick=…`, `onerror=…`, …)
  - خنثی‌سازی `javascript:` / `data:` / `vbscript:` URLها
- ✅ بلوک `<script type="application/ld+json">` در صفحات `[slug]` کاراکتر `<` را به `\u003c` escape می‌کند.

### محدودیت اندازه و نرخ
- ✅ محدودیت اندازه بدنهٔ درخواست `/api/admin/content` = 5 MB.
- ✅ Rate-limit برای:
  - ورود (تلاش ناموفق): 8 بار در 15 دقیقه هر IP+ایمیل
  - ثبت‌نام: 5 بار در 60 دقیقه هر IP
  - آپلودها، پیام‌های چت، ثبت‌نام آکادمی، apply هنرمند و … (همه از قبل بودند)
  - ثبت‌نام هنرمند و checkout مارکت‌پلیس.
- ✅ `Retry-After` هدر روی پاسخ 429.

### Open Redirect / SSRF
- ✅ helper به‌نام `safeRedirect()` در `src/lib/security/redirect.ts` که هر redirect بعد از لاگین را محدود به مسیرهای relative همان‌دامنه می‌کند (اگر فعلاً پارامتر `next` اضافه شد).
- ✅ لینک‌های خارجی در ادمین (meetLink و …) با `safeExternalHttpsUrl` ولیدیشن می‌شوند (از قبل بود).

### متفرقه
- ✅ هدر `cache-control: private, no-store` روی همهٔ پاسخ‌های auth/admin/stateful.
- ✅ کوکی‌های session `HttpOnly`, `Secure` در production / preview، `Path=/`, `Max-Age=14 days`.
- ✅ حداکثر طول فیلدها برای ایمیل (۲۵۴)، رمز (۲۵۶)، نام (۱۲۰)، شماره تماس (۳۲) و … اعمال می‌شود.
- ✅ API routes در صورت عدم اعتبار از `withNoStore` استفاده می‌کنند تا پاسخ 401/403 کش نشود.

---

## 2. Auth (احراز هویت) ✅

- ✅ **Secret قوی اجباری** در production:
  - اگر `AUTH_SECRET` با طول ≥۳۲ کاراکتر تنظیم نشده باشد در production برنامه startup دچار خطا می‌شود.
  - در توسعه یک fallback فقط برای development باقی مانده.
- ✅ **Session fixation protection**: در `/api/auth/login` بعد از verify موفق همیشه یک **توکن جدید** صادر می‌شود و کوکی قبلی بازنویسی می‌شود (چرخش جلسه).
- ✅ **Timing-safe comparison** برای رمز عبور (از قبل با PBKDF2 100k iter + `crypto.timingSafeEqual`) و برای مقایسه امضای توکن.
- ✅ **HMAC-SHA256** امضای توکن‌های session، با انقضای ۱۴ روزه و بررسی `exp`.
- ✅ **ادمین بایپس** امن:
  - قبلاً به‌صورت پیش‌فرض برای همه باز بود (`ADMIN_LOGIN_DISABLED = true`) که یک ریسک جدی بود — الان فقط در **development** و با تنظیم صریح `ROSIE_ADMIN_BYPASS=1` فعال می‌شود و در production خودبه‌خود خاموش است.
  - توکن‌های `preview-admin` بعد از خاموش کردن بایپس فوراً باطل می‌شوند.
- ✅ **CSRF** برای login/logout/signup اعمال شد.
- ✅ **Length-capping** روی password (256) و email (254) برای جلوگیری از DoS به هش.
- ✅ **Error message** در login برای ایمیل/پسورد اشتباه یکسان (`invalid_credentials`) — مانع enumeration.
- ✅ در signup هم ایمیل تکراری را با کد 409 ولی بدون leak قابل‌توجه برمی‌گرداند (می‌توان در آینده به پاسخ عمومی‌تر تغییر داد).

### باید در محیط production تنظیم شود ⚠️
```bash
# حتماً بسازید: openssl rand -hex 32
AUTH_SECRET=<32+ بایت تصادفی>
ADMIN_EMAIL=<ایمیل ادمین>
ADMIN_PASSWORD=<رمز ادمین قوی>
OWNER_EMAIL=<ایمیل راضیه>
# ادمین بایپس در production به‌هیچ‌وجه فعال نماند:
ROSIE_ADMIN_BYPASS=0
NODE_ENV=production
```

---

## 3. Data (داده‌ها) ✅

### ورودی‌های کاربری
- ✅ Sanitization عمیق برای تمام رشته‌های JSON که از `/api/admin/content` و `/api/auth/signup` می‌آیند (`sanitizeDeep`).
- ✅ طول همهٔ فیلدهای signup/academy/event capped شد.
- ✅ فیلد `price` در وبینار/ورکشاپ فقط عدد تومان (fa) می‌گیرد؛ مقدار en=0 ذخیره می‌شود تا از NaN/منفی جلوگیری شود.
- ✅ `slug` همیشه با تابع `makeSlug` از حرف کوچک لاتین عدد-خط تیره ساخته و fallback دارد.

### ذخیره‌سازی
- ✅ ذخیره‌سازی محتوا ETag-based optimistic locking دارد (از قبل بود) و `etag_conflict` با 409 برمی‌گرداند.
- ✅ عکس‌های آپلودی با محدودیت نوع (JPEG/PNG/WebP/AVIF) و حجم (8 MB) از قبل اعمال می‌شود — حفظ شد.
- ✅ فایل‌های ویدیوی دوره‌ای آپلود پرایوت هستند (سایند URL، نه در public) و کنترل دسترسی دارند — از قبل بود.
- ✅ توکن‌های session و csrf در کوکی‌های جداگانه ذخیره می‌شوند.

### در دست انتشار / پیشنهاد برای آینده
- [ ] اضافه‌کردن پشتیبان‌گیری روزانه از فایل `data/content.json` و `data/users.json` (یا اطمینان از پایداری Redis).
- [ ] افزودن `Content-Security-Policy-Report-Only` قبل از enforce در production اگر منابع ناشناخته‌ای اضافه شدند.
- [ ] Rate-limit مبتنی‌بر Redis/LRU برای چندین نمونهٔ سرور (الان درون-حافظه و per-instance است که کفایت می‌کند تا ترافیک بالا برود).

---

## 4. Hack-prevention (مقابله با سوءاستفاده) ✅

- ✅ **Clickjacking** → `X-Frame-Options: DENY` + `frame-ancestors 'none'`.
- ✅ **CSRF** → Double-submit token با SameSite Lax کوکی + هدر در تمام mutations.
- ✅ **XSS** → React escape + write-time sanitizer + CSP بدون unsafe-eval.
- ✅ **SQL/NoSQL injection** → از ORM/فایل‌استور ساختاری بدون تفسیر رشته به‌عنوان query استفاده می‌شود.
- ✅ **Brute-force / Credential stuffing** → rate-limit سراسری + generic error.
- ✅ **Session fixation** → چرخش کوکی بعد از لاگین.
- ✅ **Open redirect** → `safeRedirect()` helper.
- ✅ **Path traversal** → در مسیرهای فایل از `path.join(cwd, …)` استفاده می‌شود و هیچ ورودی کاربری مستقیم به fs پاس داده نمی‌شود.
- ✅ **Admin panel exposure** → بایپس فقط در dev و با env صریح فعال می‌شود؛ middleware تمام `/admin/[locale]/*` را قبل از رسیدن به صفحه چک می‌کند.
- ✅ **Preview-admin leakage** → توکن `preview-admin` در production و در صورت خاموش بودن بایپس صرف نظر می‌شود.
- ✅ **Cookie scope**:
  - خالی گذاشتن `Domain` attribute → کوکی فقط به همان هات محدود می‌شود.
  - `Secure` در production و HTTPS preview.
  - `HttpOnly` برای session token (از access به JS جلوگیری می‌کند).
  - `SameSite=Lax` (روی پیش‌نمایش‌های cross-site `None; Partitioned`).

### توصیه‌های بعد از استقرار
- [ ] فعال‌کردن `NEXT_PRIVATE_DEBUG_CACHE=0` و `NEXT_TELEMETRY_DISABLED=1`.
- [ ] محدودکردن نرخ در CDN لایه (Cloudflare / Vercel / Nginx) برای `/api/auth/login`, `/api/auth/signup`, `/api/admin/*`.
- [ ] اطمینان از این‌که `data/*.json` در Volume پایدار نگهداری می‌شود (در Docker/K8s).
- [ ] اعلان ورود ناموفق ادمین از طریق ایمیل (لاگ در حال حاضر در console.error می‌رود).

---

## 5. Checklist (راه‌اندازی production) ⚠

- [ ] `AUTH_SECRET` تنظیم شود (≥32 کاراکتر رندوم).
- [ ] `ADMIN_EMAIL` و `ADMIN_PASSWORD` با مقدار قوی.
- [ ] `OWNER_EMAIL` با ایمیل راضیه.
- [ ] `NODE_ENV=production`.
- [ ] `ROSIE_ADMIN_BYPASS=0` (و حتماً بررسی شود که ادمین پنل بدون لاگین باز نشود).
- [ ] `ROSIE_STACKBLITZ=0` در production (فعال‌نبودن Sharp bypass).
- [ ] اطمینان از HTTPS اجباری (redirect HTTP→HTTPS در CDN/Reverse-proxy).
- [ ] دامنه در فیلد Preview hosts اضافه نباشد (`.e2b.app/stackblitz` فقط برای dev).
- [ ] تست سناریوها:
  - [ ] ورود با رمز اشتباه ۸ بار در ۱۵ دقیقه باید 429 بدهد.
  - [ ] درخواست PUT به `/api/admin/content` بدون هدر `X-CSRF-Token` باید 403 بدهد.
  - [ ] کوکی‌های `ra-session` باید `HttpOnly; Secure; SameSite=Lax` باشند.
  - [ ] هدرهای امنیتی در DevTools Network ست شده باشند.
  - [ ] صفحهٔ ادمین بدون لاگین باید به `/admin/fa/login` ریدایرکت شود.
  - [ ] بعد از logout امکان دسترسی به API محتوای ادمین نباشد.
  - [ ] تلاش برای باز کردن آدرس در iframe دیگر دامنه باید با `X-Frame-Options: DENY` بلوک شود.
- [ ] محتوای `<script>` در فیلدهای body/excerpt/title بعد از ذخیره حذف شود (sanitization).
- [ ] پخش زنده وبینار/ورکشاپ بعد از دکمه «ذخیره و رفتن به پخش» درست باز شود (در تب broadcast).

---

## فایل‌های تغییر داده شده در این مرحله
- `src/lib/security/headers.ts` — جدید
- `src/lib/security/csrf.ts` — جدید
- `src/lib/security/csrf-client.ts` — جدید
- `src/lib/security/sanitize.ts` — جدید
- `src/lib/security/redirect.ts` — جدید
- `src/middleware.ts` — اعمال هدرهای امنیتی + CSRF cookie
- `src/lib/session.ts` — الزام AUTH_SECRET قوی در production
- `src/lib/admin-access.ts` — خاموش‌کردن پیش‌فرض admin bypass
- `src/lib/auth.ts` — (کم) بهبود ثابت زمان‌سنجی
- `src/app/api/auth/login/route.ts` — CSRF + sanitize + length caps + security headers
- `src/app/api/auth/logout/route.ts` — CSRF + headers
- `src/app/api/auth/signup/route.ts` — CSRF + sanitize + length caps + headers
- `src/app/api/admin/content/route.ts` — CSRF + payload size + sanitizeDeep + headers
- `src/components/providers/AppProviders.tsx` — ارسال خودکار CSRF در login/signup/logout
- `src/components/admin/AdminApp.tsx` — ارسال خودکار CSRF در PUT/DELETE ادمین
- `SECURITY-CHECKLIST.md` — این فایل
