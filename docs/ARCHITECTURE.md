# معماری

## از فایل تک‌فایلی تا پروژه

فایل اصلی (`CRM-online100-cl.html`، ورژن ۹۳، حدود ۱۳٬۲۰۰ خط) خودش از چند ماژول به هم چسبیده تشکیل شده بود. هر بلوک `<script>` با نشانه‌ای مثل `/* ===== 06-patients.js ===== */` شروع می‌شد. تفکیک دقیقاً روی همین مرزها انجام شده و محتوای هر بخش بدون تغییر منتقل شده است:

| بخش در فایل اصلی | فایل جدید |
|---|---|
| `<head>`، چیدمان کلی body | `src/index.html` |
| splash، هدر، منوی کناری، ناوبری گوشی | `src/partials/layout/*.html` |
| ۸ بخش `<section id="tab-…">` | `src/partials/pages/*.html` |
| ۱۶ پنجرهٔ بازشو (`…-modal`) | `src/partials/modals/*.html` |
| پیام/تأیید سفارشی، toast | `src/partials/components/*.html` |
| نواحی پنهان چاپ | `src/partials/print/print-areas.html` |
| بلوک `<style>` | `src/styles/app.css`، `src/styles/opium-report.css` |
| لایهٔ IndexedDB (`window.NRIDB`) | `src/js/data/indexeddb-store.js` |
| `00-seed-data.js` | `src/js/data/seed-data.js` |
| `01-utils.js` | `src/js/core/utils.js` |
| `02-database.js` | `src/js/data/database.js` |
| `03-backup-status-audit.js` | `src/js/core/backup-status-audit.js` |
| `04-core-navigation.js` | `src/js/core/navigation.js` |
| `05-dashboard.js` … `11-print.js` | `src/js/features/*.js` |
| `12-backup-import-export.js`، `13-backup-merge.js` | `src/js/features/backup/*.js` |
| `14-opium.js` | `src/js/features/opium.js` |
| `15-mobile.js` | `src/js/ui/mobile.js` |
| بلوک راه‌اندازی آخر فایل | `src/js/main.js` |
| آیکون base64 | `src/assets/favicon.png` |
| کتابخانه‌های CDN | `src/vendor/` (همان نسخه‌ها) |

**بررسی یکسان بودن:** اگر خروجی `dist/` دوباره به یک فایل تبدیل شود (CSS و JS درون‌خطی شوند)، نتیجه بایت‌به‌بایت با فایل اصلی برابر است. تنها تفاوت‌ها آدرس کتابخانه‌ها، آیکون و حذف خطوط نشانهٔ `/* ===== NN-….js ===== */` است. بعد از تفکیک فقط چند توضیح (comment) کهنه اصلاح شده که به SQLite و مسیرهای پروژهٔ قبلی اشاره داشتند.

## چرا ماژول ES یا فریم‌ورک نه؟

همهٔ کدها «اسکریپت کلاسیک» هستند و در یک دامنهٔ سراسری مشترک اجرا می‌شوند. ده‌ها `onclick="…"` در HTML و ارجاع بین فایل‌ها به این توابع سراسری وابسته‌اند. تبدیل به ES module یا React/Vue یعنی بازنویسی گسترده و خطر از دست رفتن رفتار. برای همین:

- فایل‌های JS با `<script src>` معمولی و به همان ترتیب فایل اصلی بارگذاری می‌شوند. ترتیب اجرا و زمان `DOMContentLoaded` مثل قبل است.
- CSS با `<link>` در **همان جای قبلی** (انتهای body) بارگذاری می‌شود تا ترتیب اولویت نسبت به استایل‌هایی که Tailwind در `<head>` می‌سازد تغییر نکند.
- partials در زمان ساخت (`scripts/build.mjs`) جایگذاری می‌شوند، نه در زمان اجرا. پس DOM هنگام اجرای اسکریپت‌ها کامل است.
- هیچ bundler یا وابستگی زمان اجرا اضافه نشده. تنها وابستگی‌های توسعه `@tauri-apps/cli` و `@playwright/test` هستند.

## جریان راه‌اندازی

1. `vendor/*` (Tailwind، Chart.js، تقویم جلالی) در `<head>` بارگذاری می‌شوند.
2. HTML کامل صفحه (splash روی همه‌چیز) نمایش داده می‌شود.
3. اسکریپت‌های `src/js` به ترتیب `index.html` اجرا می‌شوند و فقط توابع و ثابت‌ها را تعریف می‌کنند.
4. `js/main.js` پایگاه داده را باز می‌کند (`window.NRStore = await NRIDB.open()`)، `window.__nrBoot()` (در `core/navigation.js`) را صدا می‌زند و splash را برمی‌دارد.

## لایهٔ داده

- `js/data/indexeddb-store.js`: پایگاه داده `nasim-rahayi-crm` نسخهٔ ۱ با storeهای `patients`، `visits`، `contactLogs`، `insuranceHistory`، `auditLogs`، `backupHistory`، `patientReviews`، `mergeConflictLog`، `opiumMembers`، `opiumPlans`، `opiumDeliveries`، `opiumPeriods`، `settings`، `staff`، `appHandles`.
- `js/data/database.js`: توابع `dbPutAll`، `dbPutRecord` (با مهر زمانی `_updatedAt` برای ادغام هوشمند پشتیبان)، `dbDeleteRecord`، `dbGetAll` و `syncDatabase` (بازیابی کامل در یک تراکنش).
- اولین اجرا: داده‌های نمونه از `js/data/seed-data.js` در پایگاه داده نوشته می‌شوند (رفتار فایل اصلی).

## قابلیت‌ها (همه حفظ شده‌اند)

| بخش | partial | منطق |
|---|---|---|
| داشبورد: آمار، نمودارها، هشدارها، چاپ گزارش آماری | `pages/dashboard.html` | `features/dashboard.js` |
| پذیرش/ویرایش مراجع: مشخصات، مصرف، سابقهٔ کمپ، دارو و دوز، وضعیت | `pages/add-patient.html` | `features/patients.js` |
| مدیریت مراجعین: جستجو، فیلتر، جزئیات، غیرفعال‌سازی، بدون کد ملی | `pages/patients-list.html` + modals | `features/patients.js` |
| ویزیت‌ها و پیگیری تماس | `pages/follow-ups.html`، `modals/visit.html` | `features/calls-visits.js` |
| ارائه دارو و پرونده مراجع، چاپ پرونده | `pages/dispense.html`، `modals/dispense.html`، `modals/print-sections.html` | `features/dispense-patient-file.js` |
| مدیریت اپیوم: اعضا، برنامه، تحویل/ابطال، دوره‌ها، گزارش تفصیلی و CSV | `pages/opium.html` + `modals/opium-*.html` | `features/opium.js` |
| گزارش‌ها و تحلیل، نمونهٔ تصادفی بررسی پرونده | `pages/reports.html`، `modals/random-sample.html` | `features/reports.js` |
| چاپ و پیش‌نمایش چاپ | `modals/print-preview.html`، `print/print-areas.html` | `features/print.js` |
| تنظیمات کلینیک، پزشکان/روانشناسان، داده‌ها، درباره | `pages/settings.html` | `features/settings.js` |
| پشتیبان JSON، بازیابی، ورود CSV، خروجی اکسل (CSV) | `pages/settings.html`، `modals/excel-export.html` | `features/backup/import-export.js` |
| ادغام هوشمند دو پشتیبان و بررسی تعارض‌ها | `modals/merge-*.html` | `features/backup/merge.js` |
| وضعیت آخرین پشتیبان و لاگ رویدادها | هدر | `core/backup-status-audit.js` |
| نسخهٔ گوشی: ناوبری پایین، منوی «بیشتر»، جدول‌های کارتی | `layout/mobile-nav.html` | `ui/mobile.js` |

## پوسته‌های ویندوز و اندروید

- **ویندوز (`src-tauri/`)**: Tauri 2 و WebView2. پوشهٔ `dist/` را نمایش می‌دهد و هیچ فرمان بومی‌ای در اختیار صفحه نمی‌گذارد. چاپ، دانلود فایل و انتخاب فایل همان رفتار Chromium را دارند.
- **اندروید (`android/`)**: یک Activity جاوا با WebView. صفحه از آدرس `https://appassets.androidplatform.net/assets/index.html` (WebViewAssetLoader) بارگذاری می‌شود تا IndexedDB کار کند. `res/raw/android_bridge.js` قبل از اسکریپت‌های صفحه تزریق می‌شود و این قابلیت‌های مرورگر را به اندروید وصل می‌کند:
  - `<a download>` (پشتیبان JSON و خروجی CSV): پنجرهٔ «ذخیره در…» اندروید.
  - `window.print()`: سرویس چاپ اندروید (چاپگر یا ذخیره به PDF).
  - `<input type="file">` (بازیابی پشتیبان، ورود CSV): انتخابگر فایل اندروید.
  - دکمهٔ Back: بستن منو/پنجرهٔ باز (کلید Escape)، و فشار دوم در ۲ ثانیه برای خروج.

## محدودیت‌ها و تفاوت‌های ناشی از تغییر معماری

- **داده‌های نسخه‌های قبلی منتقل نمی‌شوند.** نسخهٔ ۱.۲.۰ ویندوز (SQLite) و اپ Kotlin اندروید (Room) پایگاه دادهٔ جدا داشتند. نسخهٔ مرورگری هم داده‌ها را در IndexedDB همان مرورگر نگه می‌دارد. برای انتقال، از نسخهٔ قبلی فایل پشتیبان JSON بگیرید و در نسخهٔ جدید بازیابی کنید. سازگاری فرمت پشتیبان اپ Kotlin بررسی نشده است.
- **انتخاب «پوشهٔ پیش‌فرض پشتیبان»** (`showDirectoryPicker`) در WebView اندروید وجود ندارد. در اندروید برنامه خودش به مسیر دانلود معمولی می‌رود که با پنجرهٔ «ذخیره در…» اندروید انجام می‌شود. در ویندوز (WebView2) مثل Chrome کار می‌کند.
- **Tailwind** مثل فایل اصلی با اسکریپت Play CDN (نسخهٔ ۳.۴.۱۷، کپی محلی) در زمان اجرا CSS می‌سازد. خروجی ظاهری دقیقاً همان است، ولی بارگذاری اولیه کمی کندتر از CSS از پیش ساخته است. تبدیل به CSS ثابت یک بهینه‌سازی جداست که ظاهر را در معرض تغییر قرار می‌دهد و انجام نشده.
- **امضای APK**: بدون secrets امضا (README)، هر بیلد CI کلید موقت دارد و نصب روی نسخهٔ قبلی ممکن نیست.
- **داده‌ها به WebView وابسته‌اند**: پاک کردن داده‌های برنامه در اندروید یا حذف پروفایل WebView2 در ویندوز داده‌ها را پاک می‌کند. پشتیبان‌گیری منظم ضروری است.
