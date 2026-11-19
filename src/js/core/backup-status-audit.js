// نسیم رهایی — وضعیت پشتیبان، پشتیبان خودکار و ثبت تغییرات پرونده (Audit)
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// ================= همگام‌سازی خودکار با فایل روی دیسک (File System Access API) =================
// ایده: بعد از هر تغییر، به‌جای این‌که کاربر مجبور باشد دکمه‌ی «پشتیبان‌گیری» را بزند و هر بار
// در پنجره‌ی «ذخیره» مرورگر تأیید کند، یک نسخه‌ی کامل از دیتابیس را بی‌صدا (بدون هیچ دیالوگی) در
// یک فایل با نام ثابت، داخل همان پوشه‌ی پیش‌فرض بکاپ، بازنویسی می‌کنیم.
// محدودیت مرورگر: اجازه‌ی نوشتن در پوشه معمولاً بین نشست‌های مرورگر (بستن و باز کردن کامل
// مرورگر) از بین می‌رود و دوباره باید تأیید شود؛ چون این تأییدیه باید از دل یک کلیک واقعی
// کاربر بیاید، در آن حالت به‌جای نوشتن خاموش، فقط وضعیت را به کاربر نشان می‌دهیم تا با یک
// کلیک دوباره فعالش کند — این محدودیت خودِ مرورگر است، نه چیزی که بشود دور زد.
const AUTO_SYNC_FILENAME = 'nasim_rahayi_autosync.json';
let autoSyncDirty = false;          // آیا از آخرین همگام‌سازی موفق، تغییری رخ داده؟
let autoSyncTimer = null;           // تایمر Debounce بعد از هر تغییر
let autoSyncPermissionLost = false; // آیا اجازه‌ی پوشه در این نشست از دست رفته و نیاز به کلیک مجدد دارد؟
let autoSyncIntervalStarted = false;

function scheduleAutoSync() {
    clearTimeout(autoSyncTimer);
    // چند ثانیه صبر می‌کنیم تا اگر کاربر چند فیلد را پشت‌سرهم ویرایش می‌کند، به‌جای چند
    // نوشتن پشت‌سرهم روی دیسک، فقط یک‌بار (با آخرین وضعیت) نوشته شود.
    autoSyncTimer = setTimeout(performAutoSync, 4000);
}

// بک‌استاپ ایمنی: حتی اگر به هر دلیلی Debounce تحریک نشود (مثلاً تب پس‌زمینه)، هر ۵ دقیقه
// یک‌بار در صورت وجود تغییر ثبت‌نشده، همگام‌سازی را امتحان می‌کند.
function startAutoSyncSafetyInterval() {
    if (autoSyncIntervalStarted) return;
    autoSyncIntervalStarted = true;
    setInterval(() => {
        if (window.settings && window.settings.autoSyncEnabled && autoSyncDirty) {
            performAutoSync();
        }
    }, 5 * 60 * 1000);
}

async function performAutoSync() {
    if (!window.settings || !window.settings.autoSyncEnabled) return;
    if (!('showDirectoryPicker' in window)) return; // مرورگر پشتیبانی نمی‌کند

    const dirHandle = await getSavedBackupFolderHandle();
    if (!dirHandle) {
        // هنوز هیچ پوشه‌ای انتخاب نشده — چیزی برای نوشتن نیست؛ وضعیت را نشان بده و خارج شو
        setAutoSyncStatus('no-folder');
        return;
    }

    let hasAccess = false;
    try {
        // فقط queryPermission (بدون prompt) — این تابع به ژست کاربر نیاز ندارد، برخلاف
        // requestPermission که ممکن است بدون کلیک واقعی کاربر رد شود.
        hasAccess = (await dirHandle.queryPermission({ mode: 'readwrite' })) === 'granted';
    } catch (e) {
        hasAccess = false;
    }

    if (!hasAccess) {
        autoSyncPermissionLost = true;
        setAutoSyncStatus('permission-needed');
        // بازگشت به هشدار دستی تا کاربر بی‌خبر از ذخیره نشدن تغییرات نماند
        highlightBackupButton();
        setSidebarBackupStatus(true);
        return;
    }

    try {
        const dataStr = JSON.stringify(buildBackupPayload(), null, 4);
        const fileHandle = await dirHandle.getFileHandle(AUTO_SYNC_FILENAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(dataStr);
        await writable.close();

        autoSyncDirty = false;
        autoSyncPermissionLost = false;
        setAutoSyncStatus('synced');

        // از آن‌جا که نسخه‌ی خودکار همین الان با موفقیت روی دیسک نوشته شد، دیگر نیازی به
        // هشدار دستیِ «بکاپ بگیرید» نیست.
        needsBackup = false;
        clearTimeout(backupReminderTimeout);
        const btn = document.getElementById('btn-export-backup');
        if (btn) {
            btn.classList.remove('text-amber-400', 'bg-amber-900/50', 'animate-pulse', 'ring-1', 'ring-amber-500');
            btn.classList.add('text-teal-400', 'hover:bg-slate-700');
            btn.title = "پشتیبان‌گیری دیتابیس (دانلود فایل)";
        }
        setSidebarBackupStatus(false);
    } catch (e) {
        console.error('Auto-sync write failed:', e);
        setAutoSyncStatus('error');
        highlightBackupButton();
        setSidebarBackupStatus(true);
    }
}

// وضعیت همگام‌سازی خودکار را در کارت تنظیمات (در صورت باز بودن آن تب) به‌روز می‌کند
function setAutoSyncStatus(state) {
    const el = document.getElementById('autosync-status-text');
    const btn = document.getElementById('btn-autosync-reactivate');
    if (!el) return;

    const now = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    if (btn) btn.classList.add('hidden');

    switch (state) {
        case 'synced':
            el.textContent = `همگام‌سازی خودکار فعال — آخرین ذخیره: ${toPersianDigits(now)}`;
            el.className = 'text-[11px] font-bold text-emerald-600';
            break;
        case 'no-folder':
            el.textContent = 'برای شروع، یک پوشه روی سیستم خود انتخاب کنید.';
            el.className = 'text-[11px] font-bold text-slate-500';
            break;
        case 'permission-needed':
            el.textContent = 'دسترسی به پوشه‌ی بکاپ در این نشست منقضی شده — برای ادامه کلیک کنید.';
            el.className = 'text-[11px] font-bold text-amber-600';
            if (btn) btn.classList.remove('hidden');
            break;
        case 'error':
            el.textContent = 'همگام‌سازی خودکار با خطا مواجه شد. لطفاً دوباره تلاش کنید.';
            el.className = 'text-[11px] font-bold text-rose-600';
            break;
        default:
            el.textContent = 'همگام‌سازی خودکار غیرفعال است.';
            el.className = 'text-[11px] font-bold text-slate-400';
    }
}

// دکمه‌ی روشن/خاموش کردن همگام‌سازی خودکار در تنظیمات
async function toggleAutoSync(checkboxEl) {
    if (checkboxEl.checked) {
        if (!('showDirectoryPicker' in window)) {
            showCustomAlert("عدم پشتیبانی مرورگر", "همگام‌سازی خودکار فقط در مرورگرهای Google Chrome یا Microsoft Edge کار می‌کند.");
            checkboxEl.checked = false;
            return;
        }

        let dirHandle = await getSavedBackupFolderHandle();
        if (dirHandle) {
            const hasAccess = await verifyDirectoryPermission(dirHandle);
            if (!hasAccess) dirHandle = null;
        }
        if (!dirHandle) {
            dirHandle = await pickAndSaveNewBackupFolder(true);
        }
        if (!dirHandle) {
            // کاربر پوشه‌ای انتخاب نکرد (انصراف داد)
            checkboxEl.checked = false;
            return;
        }

        window.settings.autoSyncEnabled = true;
        await dbPutRecord('settings', { id: 'main', data: window.settings });
        startAutoSyncSafetyInterval();
        showToast('همگام‌سازی خودکار فعال شد.');
        autoSyncDirty = true;
        await performAutoSync();
    } else {
        window.settings.autoSyncEnabled = false;
        await dbPutRecord('settings', { id: 'main', data: window.settings });
        clearTimeout(autoSyncTimer);
        setAutoSyncStatus('disabled');
        showToast('همگام‌سازی خودکار غیرفعال شد.');
    }
}

// دکمه‌ی «کلیک برای ادامه» وقتی اجازه‌ی پوشه در یک نشست جدید منقضی شده — این تابع مستقیماً
// از دل کلیک کاربر اجرا می‌شود، پس برخلاف performAutoSync عادی، اجازه دارد خودِ
// requestPermission (نسخه‌ی دارای دیالوگ) را صدا بزند.
async function reactivateAutoSync() {
    const dirHandle = await getSavedBackupFolderHandle();
    if (!dirHandle) {
        setAutoSyncStatus('no-folder');
        return;
    }
    const hasAccess = await verifyDirectoryPermission(dirHandle);
    if (!hasAccess) {
        showToast('اجازه‌ی دسترسی به پوشه داده نشد.', 'error');
        return;
    }
    autoSyncPermissionLost = false;
    autoSyncDirty = true;
    await performAutoSync();
}

// در زمان بارگذاری اولیه‌ی برنامه: اگر قبلاً فعال شده بود، وضعیت را نشان بده و تایمر
// ایمنی را روشن کن (خودِ نوشتن فقط بعد از اولین تغییر یا توسط این تایمر انجام می‌شود).
function initAutoSyncOnStartup() {
    if (!window.settings || !window.settings.autoSyncEnabled) {
        setAutoSyncStatus('disabled');
        return;
    }
    startAutoSyncSafetyInterval();
    // بررسی بی‌صدا (بدون دیالوگ) این‌که آیا اجازه هنوز برقرار است یا نه
    getSavedBackupFolderHandle().then(async dirHandle => {
        if (!dirHandle) { setAutoSyncStatus('no-folder'); return; }
        let hasAccess = false;
        try { hasAccess = (await dirHandle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) {}
        if (hasAccess) {
            setAutoSyncStatus('synced');
        } else {
            autoSyncPermissionLost = true;
            setAutoSyncStatus('permission-needed');
        }
    });
}

// --- متن وضعیت بکاپ در پایین سایدبار ---
// هرگاه تغییری در اطلاعات ثبت شود، متن زرد رنگ هشدار نمایش داده می‌شود و هر ۱۰ دقیقه
// یک‌بار برای چند لحظه قرمز چشمک می‌زند. بعد از گرفتن بکاپ موفق، متن سبز رنگ ثابت
// جایگزین آن می‌شود. این ویژگی مکمل چشمک‌زدن آیکون بالای صفحه است (highlightBackupButton).
let backupStatusBlinkInterval = null;

function setSidebarBackupStatus(needsBackupFlag) {
    const el = document.getElementById('sidebar-backup-status');
    if (!el) return;

    if (needsBackupFlag) {
        stopBackupStatusBlink(); // ری‌ست تایمر چشمک‌زن قبلی برای شروع تازه شمارش ۱۰ دقیقه
        el.innerText = 'با توجه به تغییرات اطلاعات فایل پیشتیبان تهیه کنید';
        el.classList.remove('text-emerald-400');
        el.classList.add('text-amber-400');
        startBackupStatusBlink();
    } else {
        stopBackupStatusBlink();
        el.innerText = 'فعلا تغییری در اطلاعات رخ نداده';
        el.classList.remove('text-amber-400', 'text-rose-500');
        el.classList.add('text-emerald-400');
    }
}

// هر ۱۰ دقیقه یک‌بار، در صورت نیاز به بکاپ، متن هشدار برای مدت کوتاهی قرمز چشمک می‌زند
function startBackupStatusBlink() {
    if (backupStatusBlinkInterval) return; // تایمر از قبل فعال است
    backupStatusBlinkInterval = setInterval(() => {
        if (!needsBackup) { stopBackupStatusBlink(); return; }
        const el = document.getElementById('sidebar-backup-status');
        if (!el) return;
        el.classList.remove('text-amber-400');
        el.classList.add('text-rose-500');
        setTimeout(() => {
            if (!needsBackup) return; // اگر در همین حین بکاپ گرفته شد، دیگر رنگ را برنگردان
            const elAfter = document.getElementById('sidebar-backup-status');
            if (!elAfter) return;
            elAfter.classList.remove('text-rose-500');
            elAfter.classList.add('text-amber-400');
        }, 1200); // مدت چشمک قرمز: ۱.۲ ثانیه
    }, 10 * 60 * 1000); // هر ۱۰ دقیقه
}

function stopBackupStatusBlink() {
    if (backupStatusBlinkInterval) {
        clearInterval(backupStatusBlinkInterval);
        backupStatusBlinkInterval = null;
    }
}

// --- ROOT-CAUSE FIX: central audit-trail logger ---
// This function was called from ~15 call sites (inline quick-actions, the deactivation
// modal, and the full patient edit form) but was never defined anywhere in the file.
// Calling an undefined function throws a ReferenceError, which silently aborted every
// caller mid-execution — e.g. in handleDeactivateSubmit() this happened *after* the
// in-memory status was flipped to "غیرفعال" but *before* dbPutRecord(), closeDeactivateModal()
// and showToast() ran. That is exactly why the deactivation popup appeared to "hang":
// the save was never persisted and the modal never closed.
function logChange(patientId, fieldName, oldValue, newValue) {
    if (oldValue === newValue) return; // no actual change, nothing to log
    const recordedBy = (window.settings && window.settings.chiefDoctorName)
        || (window.staff && window.staff.doctors && window.staff.doctors[0])
        || "دکتر حسن‌پور";
    const auditPayload = {
        id: crypto.randomUUID(),
        // Real chronological sort key. `id` above is a random UUID, not time-ordered,
        // so sorting by it (as the audit-trail view used to) produced an effectively
        // random order rather than "newest first". This timestamp is what the
        // history tab now sorts on.
        timestamp: Date.now(),
        patientId: patientId,
        fieldName: fieldName,
        oldValue: (oldValue === undefined || oldValue === null || oldValue === '') ? '-' : oldValue,
        newValue: (newValue === undefined || newValue === null || newValue === '') ? '-' : newValue,
        date: getShamsiToday(),
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        recordedBy: recordedBy
    };
    window.auditLogs = window.auditLogs || [];
    window.auditLogs.unshift(auditPayload);
    dbPutRecord('auditLogs', auditPayload);
}

