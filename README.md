# سامانه مدیریت کلینیک ترک اعتیاد «نسیم رهایی» — ورژن ۹۳

برنامهٔ مدیریت کلینیک (پرونده مراجعین، ویزیت، ارائه دارو، مدیریت اپیوم، گزارش‌ها، چاپ و پشتیبان‌گیری) برای **ویندوز** و **اندروید**.
هر دو نسخه از یک کد واحد در `src/` ساخته می‌شوند. داده‌ها فقط روی همان دستگاه (IndexedDB) ذخیره می‌شوند و برنامه به اینترنت نیازی ندارد.

این پروژه از فایل تک‌فایلی `CRM-online100-cl.html` (ورژن ۹۳) ساخته شده است. خروجی `npm run build` همان صفحه را دوباره می‌سازد: نشانه‌گذاری HTML، CSS و JavaScript آن بایت‌به‌بایت با فایل اصلی یکسان است. فقط آدرس کتابخانه‌ها از CDN به نسخهٔ محلی (`src/vendor/`) و آیکون base64 به یک فایل جدا (`src/assets/favicon.png`) تغییر کرده است. جزئیات معماری در [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) است.

## ساختار پروژه

```
.
├── src/                      کد برنامه (تنها منبع هر دو نسخه)
│   ├── index.html            اسکلت صفحه: <head>، چیدمان کلی، include بخش‌ها، ترتیب بارگذاری CSS/JS
│   ├── partials/             بخش‌های HTML
│   │   ├── layout/           splash، هدر، منوی کناری، ناوبری پایین گوشی
│   │   ├── pages/            ۸ صفحهٔ اصلی (داشبورد، پذیرش، مراجعین، ویزیت‌ها، ارائه دارو، اپیوم، گزارش‌ها، تنظیمات)
│   │   ├── modals/           پنجره‌های بازشو (ویزیت، ارائه دارو، تحویل اپیوم، ادغام پشتیبان و ...)
│   │   ├── components/       اجزای مشترک: پیام/تأیید سفارشی، toast
│   │   └── print/            نواحی پنهان چاپ
│   ├── styles/               CSS اختصاصی (app.css، opium-report.css)
│   ├── js/
│   │   ├── data/             لایهٔ داده: IndexedDB، توابع خواندن/نوشتن، دادهٔ اولیه و ثابت‌ها
│   │   ├── core/             ابزارهای عمومی، ناوبری/راه‌اندازی، وضعیت پشتیبان و لاگ رویدادها
│   │   ├── features/         منطق هر بخش (داشبورد، مراجعین، ارائه دارو، ویزیت، گزارش، تنظیمات، چاپ، اپیوم، backup/)
│   │   ├── ui/mobile.js      رفتارهای مخصوص گوشی
│   │   └── main.js           شروع برنامه: باز کردن پایگاه داده و اجرای __nrBoot
│   ├── vendor/               کتابخانه‌ها به‌صورت محلی (Tailwind، Chart.js، Font Awesome، وزیرمتن، تقویم جلالی)
│   └── assets/               آیکون
├── scripts/
│   ├── build.mjs             ساخت dist/ از src/ (جایگذاری partials، کپی js/styles/vendor/assets)
│   ├── dev.mjs               سرور توسعه با ساخت خودکار
│   └── vendor.sh             دانلود دوبارهٔ کتابخانه‌ها در src/vendor/
├── src-tauri/                پوستهٔ ویندوز (Tauri 2، WebView2): نصب‌کنندهٔ .exe و .msi
├── android/                  پوستهٔ اندروید (Java، WebView): فایل .apk
├── tests/
│   ├── unit/                 تست ساختار (include ها، فایل‌های گم‌شده، منابع اینترنتی، سینتکس JS)
│   └── e2e/                  تست مرورگر با Playwright (دسکتاپ و گوشی)
├── docs/ARCHITECTURE.md      معماری، فهرست قابلیت‌ها و محدودیت‌ها
├── .github/workflows/build.yml   CI: تست، ساخت ویندوز و اندروید، انتشار Release با تگ v*
├── package.json · playwright.config.js · .gitignore
```

## اجرا در محیط توسعه

پیش‌نیاز: Node.js 20 یا جدیدتر.

```bash
npm install
npm run dev          # http://localhost:5173 — با هر تغییر در src/ دوباره ساخته می‌شود (صفحه را refresh کنید)
npm run build        # خروجی در dist/ ؛ dist/index.html را مستقیم هم می‌شود در مرورگر باز کرد
npm test             # تست‌های ساختار
npx playwright install chromium && npm run test:e2e   # تست‌های مرورگر
```

## ساخت نسخهٔ ویندوز (.exe / .msi)

روی ویندوز با [Rust](https://rustup.rs) و Node.js:

```bash
npm install
npx tauri build      # خروجی: src-tauri/target/release/bundle/nsis/*.exe و msi/*.msi
npx tauri dev        # اجرای برنامه در پنجرهٔ ویندوز همراه با سرور توسعه
```

## ساخت نسخهٔ اندروید (.apk)

با JDK 21، Android SDK (platform 35) و Gradle 9 یا Android Studio (پوشهٔ `android/` را باز کنید):

```bash
gradle -p android assembleRelease   # خروجی: android/app/build/outputs/apk/release/app-release.apk
```

بیلد اندروید خودش اول `node scripts/build.mjs` را اجرا می‌کند، پس Node.js باید در PATH باشد.

**امضای APK:** برای اینکه نسخه‌های بعدی روی نسخهٔ نصب‌شده به‌روزرسانی شوند (و داده‌ها حفظ شوند)، باید همیشه با یک کلید ثابت امضا شوند. در GitHub این secrets را تعریف کنید: `ANDROID_KEYSTORE_BASE64` (فایل .jks به base64)، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS` و در صورت تفاوت `ANDROID_KEY_PASSWORD`. بدون آن‌ها APK با کلید موقت امضا می‌شود.

## ساخت خودکار در GitHub

هر push به `main` تست‌ها را اجرا می‌کند و نصب‌کنندهٔ ویندوز و APK اندروید را در بخش Artifacts همان اجرای Actions قرار می‌دهد. با push یک تگ مثل `v2.0.0` فایل‌ها در Releases منتشر می‌شوند.

## داده‌ها و پشتیبان‌گیری

- داده‌ها در IndexedDB با نام `nasim-rahayi-crm` ذخیره می‌شوند. ویندوز: پروفایل WebView2 در `%LOCALAPPDATA%\com.nasimrahayi.clinic`. اندروید: حافظهٔ خصوصی برنامه.
- با حذف برنامه (Uninstall) داده‌ها هم ممکن است پاک شوند. همیشه از بخش تنظیمات ← داده‌ها فایل پشتیبان JSON بگیرید.
- برای انتقال داده بین ویندوز، اندروید و مرورگر از همان فایل پشتیبان JSON استفاده کنید.
