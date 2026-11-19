// نسیم رهایی — لایه دسترسی به داده: خواندن/نوشتن رکوردها در پایگاه داده محلی (IndexedDB)
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// --- Local database access ---
// Every record lives in the browser/WebView IndexedDB database "nasim-rahayi-crm" (see js/data/indexeddb-store.js;
// Windows: WebView2 profile under %LOCALAPPDATA%\com.nasimrahayi.clinic, Android: the app's private storage).
// `window.NRStore` is opened by js/main.js before the app starts; the four helpers below keep their
// original names and contracts so the rest of the UI is unchanged.

// Every write helper below is frequently called "fire-and-forget" (no await, no .catch) throughout
// the app. That is fine for the happy path, but a failed write must never be silent — the UI would
// show a success toast while the record was never actually persisted. notifyDbFailure() gives
// every write a visible failure signal without requiring every call site to be rewritten as awaited.
function notifyDbFailure(operation, storeName, err) {
    console.error(`[DB] ${operation} failed for store "${storeName}"`, err);
    if (typeof showToast === 'function') {
        showToast('خطا در ذخیره‌سازی اطلاعات در دیتابیس! لطفاً دوباره تلاش کنید و در صورت تکرار، از اطلاعات بکاپ بگیرید.', 'error');
    }
}

// Replaces the whole store atomically (used by restore / bulk sync).
function dbPutAll(storeName, items) {
    const promise = window.NRStore.putAll(storeName, items || []);
    promise.catch(err => notifyDbFailure('dbPutAll', storeName, err));
    return promise;
}

// NOTE: dbPutRecord auto-stamps every record with "_updatedAt" (epoch ms) on every real,
// individual write. This timestamp is the backbone of the Smart Backup Merge feature: when
// combining two independent backups, whichever side has the newer "_updatedAt" for a given
// record id is considered the more recent version. dbPutAll (used for bulk restore / seeding)
// intentionally does NOT touch this field so that a full restore faithfully reproduces the
// exact timestamps that existed in the backup file.
function dbPutRecord(storeName, item) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
        item._updatedAt = Date.now();
    }
    const promise = window.NRStore.put(storeName, item);
    promise.catch(err => notifyDbFailure('dbPutRecord', storeName, err));
    return promise;
}

function dbDeleteRecord(storeName, id) {
    const promise = window.NRStore.delete(storeName, id);
    promise.catch(err => notifyDbFailure('dbDeleteRecord', storeName, err));
    return promise;
}

function dbGetAll(storeName) {
    return window.NRStore.getAll(storeName);
}


async function initIndexedDB() {
    const settingsArr = await dbGetAll('settings');
    const isFirstRun = settingsArr.length === 0;

    if (isFirstRun) {
        await dbPutAll('settings', [{ id: 'main', data: defaultSettings }]);
        await dbPutAll('staff', [{ id: 'main', data: defaultStaff }]);
        // Demo patients only in the browser demo build. The installed app starts empty: a clinic's real
        // data is brought in with «بازیابی بکاپ» (the JSON backup of the old version) or entered directly.
        if (!window.NR_NATIVE) {
            await dbPutAll('patients', initialDummyPatients);
            await dbPutAll('visits', initialDummyVisits);
            await dbPutAll('contactLogs', initialDummyContactLogs);
            await dbPutAll('insuranceHistory', initialDummyInsuranceHistory);
            await dbPutAll('auditLogs', initialDummyAuditLogs);
            await dbPutAll('backupHistory', initialDummyBackupHistory);
        }
        window.__nrFirstRun = true;
    }

    await loadDataFromIndexedDB();
}

async function loadDataFromIndexedDB() {
    window.patients = await dbGetAll('patients') || [];

    // Migrate old data to fullName if exists
    let needsSync = false;
    window.patients.forEach(p => {
        if (!p.fullName && p.name) {
            p.fullName = `${p.name} ${p.lastname || ''}`.trim();
            needsSync = true;
        }

        // Migrate old staff to new staff automatically
        if (['خانم دکتر علوی', 'خانم محمدی'].includes(p.counselor)) { p.counselor = 'خانم ابراهیمی'; needsSync = true; }
        if (['آقای کریمی', 'آقای دکتر حسینی'].includes(p.counselor)) { p.counselor = 'آقای فتحی'; needsSync = true; }

        // Migrate old drug names to new format automatically
        if (p.initialDrug === 'بدون دارو (فقط روان‌درمانی)') { p.initialDrug = 'روان درمانی'; needsSync = true; }
        if (p.currentDrug === 'بدون دارو (فقط روان‌درمانی)') { p.currentDrug = 'روان درمانی'; needsSync = true; }
        if (p.initialDrug === 'قرص ب۲ (بوپرنورفین)') { p.initialDrug = 'بوپرنورفین'; needsSync = true; }
        if (p.currentDrug === 'قرص ب۲ (بوپرنورفین)') { p.currentDrug = 'بوپرنورفین'; needsSync = true; }

        if (p.initialDrug === 'شربت متادون') { p.initialDrug = 'ش متادون'; needsSync = true; }
        if (p.currentDrug === 'شربت متادون') { p.currentDrug = 'ش متادون'; needsSync = true; }
        if (p.initialDrug === 'قرص متادون') { p.initialDrug = 'ق متادون'; needsSync = true; }
        if (p.currentDrug === 'قرص متادون') { p.currentDrug = 'ق متادون'; needsSync = true; }
        if (p.initialDrug === 'شربت اوپیوم' || p.initialDrug === 'شربت اپیوم') { p.initialDrug = 'اپیوم'; needsSync = true; }
        if (p.currentDrug === 'شربت اوپیوم' || p.currentDrug === 'شربت اپیوم') { p.currentDrug = 'اپیوم'; needsSync = true; }

        // رفع نمایش خالی «درمان بدو ورود»: برای پرونده‌های قدیمی که پیش از افزوده شدن
        // فیلد initialDrug ساخته شده‌اند (یا از طریق بکاپ/CSV بدون این ستون وارد شده‌اند)،
        // این مقدار ممکن است اصلاً ذخیره نشده باشد و در پرونده پزشکی خالی دیده شود، هرچند
        // «درمان فعلی» درست نمایش داده می‌شود. در چنین حالتی، به‌عنوان بهترین تخمین ممکن،
        // درمان بدو ورود را برابر با درمان فعلی ثبت‌شده قرار می‌دهیم (فقط وقتی واقعاً خالی
        // باشد؛ در غیر این صورت هیچ مقدار موجودی دست‌نخورده باقی می‌ماند).
        if (!p.initialDrug && p.currentDrug) {
            p.initialDrug = p.currentDrug;
            if (p.initialDosage === undefined || p.initialDosage === null || p.initialDosage === '') {
                p.initialDosage = p.currentDosage || 0;
            }
            if (!p.initialPriority && p.currentPriority) { p.initialPriority = p.currentPriority; }
            needsSync = true;
        }

        // Normalize legacy nationalId/phone values: Persian/Arabic digits → English,
        // and strip any stray whitespace or invisible Unicode characters. This is a
        // safe, non-destructive cleanup (same numeric value, standard format) that fixes
        // copy/paste rejections in external systems for records saved before this fix.
        if (p.nationalId !== undefined && p.nationalId !== null) {
            const cleanNationalId = normalizeIdentifierValue(p.nationalId);
            if (cleanNationalId !== String(p.nationalId)) { p.nationalId = cleanNationalId; needsSync = true; }
        }
        if (p.phone !== undefined && p.phone !== null) {
            const cleanPhone = normalizeIdentifierValue(p.phone);
            if (cleanPhone !== String(p.phone)) { p.phone = cleanPhone; needsSync = true; }
        }
    });

    window.visits = await dbGetAll('visits') || [];
    window.visits.forEach(v => {
        // Ensure only allowed doctor is recorded
        if (v.physician && v.physician !== 'دکتر حسن‌پور') { v.physician = 'دکتر حسن‌پور'; needsSync = true; }
        if (v.recordedBy && v.recordedBy !== 'دکتر حسن‌پور' && v.recordedBy !== 'منشی کلینیک') { v.recordedBy = 'دکتر حسن‌پور'; needsSync = true; }

        if (v.prevDrug === 'بدون دارو (فقط روان‌درمانی)') { v.prevDrug = 'روان درمانی'; needsSync = true; }
        if (v.newDrug === 'بدون دارو (فقط روان‌درمانی)') { v.newDrug = 'روان درمانی'; needsSync = true; }
        if (v.prevDrug === 'قرص ب۲ (بوپرنورفین)') { v.prevDrug = 'بوپرنورفین'; needsSync = true; }
        if (v.newDrug === 'قرص ب۲ (بوپرنورفین)') { v.newDrug = 'بوپرنورفین'; needsSync = true; }

        if (v.prevDrug === 'شربت متادون') { v.prevDrug = 'ش متادون'; needsSync = true; }
        if (v.newDrug === 'شربت متادون') { v.newDrug = 'ش متادون'; needsSync = true; }
        if (v.prevDrug === 'قرص متادون') { v.prevDrug = 'ق متادون'; needsSync = true; }
        if (v.newDrug === 'قرص متادون') { v.newDrug = 'ق متادون'; needsSync = true; }
        if (v.prevDrug === 'شربت اوپیوم' || v.prevDrug === 'شربت اپیوم') { v.prevDrug = 'اپیوم'; needsSync = true; }
        if (v.newDrug === 'شربت اوپیوم' || v.newDrug === 'شربت اپیوم') { v.newDrug = 'اپیوم'; needsSync = true; }
    });

    window.contactLogs = await dbGetAll('contactLogs') || [];
    window.insuranceHistory = await dbGetAll('insuranceHistory') || [];
    window.auditLogs = await dbGetAll('auditLogs') || [];
    window.backupHistory = await dbGetAll('backupHistory') || [];
    window.patientReviews = await dbGetAll('patientReviews') || [];
    window.mergeConflictLog = await dbGetAll('mergeConflictLog') || [];
    window.opiumMembers = await dbGetAll('opiumMembers') || [];
    window.opiumPlans = await dbGetAll('opiumPlans') || [];
    window.opiumDeliveries = await dbGetAll('opiumDeliveries') || [];
    window.opiumPeriods = await dbGetAll('opiumPeriods') || [];

    const settingsArr = await dbGetAll('settings');
    window.settings = settingsArr.length > 0 ? settingsArr[0].data : defaultSettings;

    // Settings objects saved before the auto-sync feature existed won't have this key.
    if (window.settings.autoSyncEnabled === undefined) {
        window.settings.autoSyncEnabled = false;
        needsSync = true;
    }

    const staffArr = await dbGetAll('staff');
    window.staff = staffArr.length > 0 ? staffArr[0].data : defaultStaff;

    // NOTE: نسخه‌ی قبلی این بخش، در صورت نبود پرچم updated_v2_ebrahimi، کل لیست
    // پزشکان/مشاوران را با یک لیست ثابت ۲ نفره جایگزین می‌کرد و هر بایگانی یا
    // نام اضافه‌شده توسط کاربر را برای همیشه پاک می‌نمود (مثلاً هنگام بازیابی یک
    // بکاپ قدیمی). این رفتار حذف شد؛ اکنون فقط در صورتی که لیست‌ها واقعاً خالی
    // باشند (اولین اجرای برنامه) مقادیر پیش‌فرض قرار می‌گیرند و در غیر این صورت
    // داده‌ی موجود کاربر دست‌نخورده باقی می‌ماند. مهاجرت نام‌ها همین الان هم به‌صورت
    // امن در بخش per-patient انجام می‌شود.
    if (!Array.isArray(window.staff.doctors)) { window.staff.doctors = []; needsSync = true; }
    if (!Array.isArray(window.staff.psychologists)) { window.staff.psychologists = []; needsSync = true; }
    if (window.staff.doctors.length === 0 && window.staff.psychologists.length === 0 &&
        (!Array.isArray(window.staff.archivedDoctors) || window.staff.archivedDoctors.length === 0) &&
        (!Array.isArray(window.staff.archivedPsychologists) || window.staff.archivedPsychologists.length === 0)) {
        window.staff.doctors = ["دکتر حسن‌پور"];
        window.staff.psychologists = ["خانم ابراهیمی", "آقای فتحی"];
        needsSync = true;
    }
    if (!window.staff.updated_v2_ebrahimi) {
        window.staff.updated_v2_ebrahimi = true;
        needsSync = true;
    }

    // اطمینان از وجود آرایه‌های بایگانی کادر درمان (سازگاری با نسخه‌های قبلی)
    if (!Array.isArray(window.staff.archivedDoctors)) { window.staff.archivedDoctors = []; needsSync = true; }
    if (!Array.isArray(window.staff.archivedPsychologists)) { window.staff.archivedPsychologists = []; needsSync = true; }

    // این خط عمداً به انتهای تابع منتقل شده تا همه‌ی اصلاحات/migration های بالا
    // (شامل موارد مربوط به staff.doctors/psychologists و آرایه‌های بایگانی) قبل از
    // ذخیره‌سازی نهایی در IndexedDB لحاظ شده باشند و هیچ‌کدام بی‌صدا از قلم نیفتند.
    if (needsSync) await syncDatabase();
}

// NOTE: syncDatabase is only used for mass imports or full resets. It rewrites every table inside ONE
// IndexedDB transaction (NRStore.replaceAll): a restore either lands completely or not at all (never half-restored data).
async function syncDatabase() {
    try {
        await window.NRStore.replaceAll({
            patients: window.patients,
            visits: window.visits,
            contactLogs: window.contactLogs,
            insuranceHistory: window.insuranceHistory,
            auditLogs: window.auditLogs,
            backupHistory: window.backupHistory,
            patientReviews: window.patientReviews,
            mergeConflictLog: window.mergeConflictLog || [],
            opiumMembers: window.opiumMembers || [],
            opiumPlans: window.opiumPlans || [],
            opiumDeliveries: window.opiumDeliveries || [],
            opiumPeriods: window.opiumPeriods || [],
            settings: [{ id: 'main', data: window.settings }],
            staff: [{ id: 'main', data: window.staff }]
        });
    } catch (error) {
        console.error("Error syncing to IndexedDB", error);
        notifyDbFailure('syncDatabase', 'all', error);
        throw error;
    }
}

// Backup Reminder Visual Effect
let backupReminderTimeout;
let needsBackup = false; // پرچم وضعیت نیاز به بکاپ

function highlightBackupButton() {
    const btn = document.getElementById('btn-export-backup');
    if (!btn) return;

    clearTimeout(backupReminderTimeout);

    // Add strong visual warning classes for new header button
    btn.classList.remove('text-teal-400', 'hover:bg-slate-700');
    btn.classList.add('text-amber-400', 'bg-amber-900/50', 'animate-pulse', 'ring-1', 'ring-amber-500');
    btn.title = "تغییرات جدید! بکاپ بگیرید";

    // Revert back after 8 seconds
    backupReminderTimeout = setTimeout(() => {
        btn.classList.remove('text-amber-400', 'bg-amber-900/50', 'animate-pulse', 'ring-1', 'ring-amber-500');
        btn.classList.add('text-teal-400', 'hover:bg-slate-700');
        btn.title = "پشتیبان‌گیری دیتابیس (دانلود فایل)";
    }, 8000);
}

// Replaced old generic sync with just the visual reminder
function triggerBackupReminder() {
    needsBackup = true; // با هر تغییری، پرچم نیاز به بکاپ روشن می‌شود
    autoSyncDirty = true; // برای همگام‌سازی خودکار نیز این تغییر را علامت بزن

    if (window.settings && window.settings.autoSyncEnabled) {
        // وقتی همگام‌سازی خودکار فعال و سالم است، نیازی به نگ دستی نیست؛ خودِ
        // performAutoSync در صورت شکست (مثلاً از دست رفتن اجازه‌ی پوشه) دوباره
        // این هشدار دستی را روشن می‌کند تا کاربر بی‌خبر نماند.
        scheduleAutoSync();
    } else {
        highlightBackupButton();
        setSidebarBackupStatus(true);
    }
}

