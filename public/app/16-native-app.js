// نسیم رهایی — رفتارهای مخصوص اپ نصبی (ویندوز / اندروید)
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)
//
// In the installed app every change is written to the SQLite database immediately, so:
//   * the "you have unsaved changes — take a backup" nag of the browser version is replaced by automatic
//     JSON restore points kept next to the database (newest 40, written a few seconds after each change);
//   * a restore point is also taken right before any restore, merge or full wipe, so those are undoable;
//   * manual backups / Excel exports go through the native "Save as" dialog;
//   * the browser-only "backup folder" auto-sync (File System Access API) is hidden.
// In the browser build (npm run dev / demo) this file only sets the version label.

(function nativeAppLayer() {
    const versionEl = document.getElementById('header-version');
    if (versionEl && window.NR_APP_VERSION) versionEl.textContent = 'نسخه ' + toPersianDigits(window.NR_APP_VERSION);

    if (!window.NR_NATIVE) return;

    const P = window.NRPlatform;
    let snapshotTimer = null;
    let lastSnapshotAt = null;
    let snapshotFailed = false;
    let snapshotInFlight = null;

    // ---------- automatic restore points ----------
    function takeNativeSnapshot() {
        if (snapshotInFlight) return snapshotInFlight;
        snapshotInFlight = P.backupSnapshot(JSON.stringify(buildBackupPayload()))
            .then(res => {
                lastSnapshotAt = new Date();
                snapshotFailed = false;
                return res;
            })
            .catch(err => {
                snapshotFailed = true;
                console.error('Automatic backup failed', err);
                return null;
            })
            .finally(() => {
                snapshotInFlight = null;
                updateNativeStatus();
                if (isDataTabVisible()) renderNativeStorageCard();
            });
        return snapshotInFlight;
    }

    function scheduleNativeSnapshot() {
        clearTimeout(snapshotTimer);
        snapshotTimer = setTimeout(takeNativeSnapshot, 4000);
    }

    function formatTime(d) {
        return toPersianDigits(d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    }
    function formatDateTime(ms) {
        try {
            return toPersianDigits(new Date(ms).toLocaleString('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            return toPersianDigits(new Date(ms).toLocaleString('fa-IR'));
        }
    }
    function formatSize(bytes) {
        if (!bytes) return '۰';
        if (bytes < 1024) return toPersianDigits(bytes) + ' بایت';
        if (bytes < 1024 * 1024) return toPersianDigits((bytes / 1024).toFixed(1)) + ' کیلوبایت';
        return toPersianDigits((bytes / 1024 / 1024).toFixed(2)) + ' مگابایت';
    }

    function updateNativeStatus() {
        const el = document.getElementById('sidebar-backup-status');
        if (!el) return;
        el.classList.remove('text-amber-400', 'text-rose-500', 'text-emerald-400');
        if (snapshotFailed) {
            el.innerText = 'پشتیبان خودکار ناموفق بود؛ از «پشتیبان‌گیری» استفاده کنید';
            el.classList.add('text-rose-500');
        } else {
            el.innerText = lastSnapshotAt
                ? `ذخیره در دیتابیس ✓ — پشتیبان خودکار ${formatTime(lastSnapshotAt)}`
                : 'همه تغییرات در دیتابیس ذخیره می‌شود ✓';
            el.classList.add('text-emerald-400');
        }
    }

    // ---------- replace browser-version behaviours ----------
    window.triggerBackupReminder = function () {
        needsBackup = false;
        scheduleNativeSnapshot();
    };
    window.setSidebarBackupStatus = function () { updateNativeStatus(); };
    window.highlightBackupButton = function () {};
    window.initAutoSyncOnStartup = function () {};
    window.scheduleAutoSync = function () {};

    window.exportDatabase = async function () {
        const dataStr = JSON.stringify(buildBackupPayload(), null, 4);
        const fileName = `nasim_rahayi_backup_${getBackupTimestampString()}.json`;
        try {
            const saved = await P.saveTextFile({ defaultName: fileName, content: dataStr, mime: 'application/json' });
            if (!saved) {
                showToast('ذخیره‌سازی فایل پشتیبان لغو شد.', 'error');
                return;
            }
            logBackupEvent('export', fileName);
            finalizeBackupUI(fileName);
        } catch (err) {
            console.error(err);
            showCustomAlert('خطا در ذخیره فایل پشتیبان', String(err && err.message ? err.message : err));
        }
    };

    // a restore point right before anything that replaces data
    const originalFullRestore = window.performFullRestore;
    window.performFullRestore = async function (data, fileName) {
        await takeNativeSnapshot();
        return originalFullRestore(data, fileName);
    };
    const originalApplyMerge = window.applyMergeSession;
    window.applyMergeSession = async function (session) {
        await takeNativeSnapshot();
        return originalApplyMerge(session);
    };
    const originalClearAll = window.clearAllData;
    window.clearAllData = function () {
        takeNativeSnapshot();
        return originalClearAll();
    };

    // ---------- Settings → «ورود و خروج اطلاعات»: database + restore points card ----------
    function isDataTabVisible() {
        const tab = document.getElementById('settings-sub-tab-data');
        return !!tab && !tab.classList.contains('hidden') && !document.getElementById('tab-settings').classList.contains('hidden');
    }

    async function renderNativeStorageCard() {
        const card = document.getElementById('native-storage-card');
        if (!card) return;
        card.classList.remove('hidden');
        let info = null, snapshots = [], counts = {};
        try {
            [info, snapshots, counts] = await Promise.all([P.dbInfo(), P.backupList(), window.NRStore.counts()]);
        } catch (err) {
            card.innerHTML = `<div class="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700">خواندن اطلاعات دیتابیس ناموفق بود: ${escapeHTML(String(err && err.message ? err.message : err))}</div>`;
            return;
        }
        const folder = info.path.replace(/[\\/][^\\/]+$/, '');
        const snapRows = snapshots.slice(0, 12).map((s, i) => `
            <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${i === 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-white border border-slate-100'}">
                <div class="min-w-0">
                    <p class="text-[11px] font-bold text-slate-700 font-yekan">${formatDateTime(s.takenAtMs)} ${i === 0 ? '<span class="text-[10px] text-emerald-600 mr-1">(جدیدترین)</span>' : ''}</p>
                    <p class="text-[10px] text-slate-400 font-yekan">${formatSize(s.sizeBytes)}</p>
                </div>
                <button type="button" onclick="nrRestoreSnapshot('${escapeHTML(s.name)}')" class="shrink-0 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold transition">
                    <i class="fa-solid fa-clock-rotate-left ml-1"></i>بازیابی
                </button>
            </div>`).join('');

        card.innerHTML = `
            <div class="mt-6 p-5 bg-teal-50/60 border-2 border-dashed border-teal-200 rounded-2xl space-y-4">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 shrink-0 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xl"><i class="fa-solid fa-database"></i></div>
                        <div>
                            <h4 class="font-bold text-teal-900 text-sm">دیتابیس برنامه (SQLite) و پشتیبان خودکار</h4>
                            <p class="text-[11px] text-teal-800 mt-0.5 leading-relaxed max-w-xl">هر تغییر همان لحظه در دیتابیس ذخیره می‌شود. چند ثانیه بعد از هر تغییر، و همچنین پیش از هر بازیابی، ادغام یا پاکسازی، یک «نقطه بازگشت» خودکار ساخته می‌شود (۴۰ نسخه آخر نگه داشته می‌شود).</p>
                        </div>
                    </div>
                    <button type="button" onclick="nrSnapshotNow()" class="px-4 py-2 bg-teal-brand hover-bg-teal text-white text-xs font-bold rounded-xl shadow transition whitespace-nowrap"><i class="fa-solid fa-camera ml-1"></i>ساخت نقطه بازگشت الان</button>
                </div>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-bold">
                    <div class="bg-white rounded-xl border border-teal-100 p-2.5"><p class="text-slate-400">حجم دیتابیس</p><p class="text-slate-800 font-yekan mt-0.5">${formatSize(info.sizeBytes)}</p></div>
                    <div class="bg-white rounded-xl border border-teal-100 p-2.5"><p class="text-slate-400">پرونده‌ها</p><p class="text-slate-800 font-yekan mt-0.5">${toPersianDigits(counts.patients || 0)}</p></div>
                    <div class="bg-white rounded-xl border border-teal-100 p-2.5"><p class="text-slate-400">ویزیت‌ها</p><p class="text-slate-800 font-yekan mt-0.5">${toPersianDigits(counts.visits || 0)}</p></div>
                    <div class="bg-white rounded-xl border border-teal-100 p-2.5"><p class="text-slate-400">تحویل‌های اپیوم</p><p class="text-slate-800 font-yekan mt-0.5">${toPersianDigits(counts.opiumDeliveries || 0)}</p></div>
                </div>
                <div class="text-[10px] text-slate-500 font-bold leading-relaxed">
                    محل فایل دیتابیس: <span dir="ltr" class="inline-block break-all text-slate-700">${escapeHTML(info.path)}</span><br>
                    محل نقاط بازگشت: <span dir="ltr" class="inline-block break-all text-slate-700">${escapeHTML(folder + (folder.includes('\\') ? '\\backups' : '/backups'))}</span>
                    — SQLite ${escapeHTML(info.sqliteVersion)} · ساختار نسخه ${toPersianDigits(info.schemaVersion)}
                </div>
                <div>
                    <p class="text-[11px] font-extrabold text-slate-600 mb-2">نقاط بازگشت خودکار (${toPersianDigits(snapshots.length)})</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar">
                        ${snapRows || '<p class="text-[11px] text-slate-400 font-bold">هنوز نقطه بازگشتی ساخته نشده است.</p>'}
                    </div>
                </div>
            </div>`;
    }

    window.nrSnapshotNow = async function () {
        const res = await takeNativeSnapshot();
        if (res) showToast('نقطه بازگشت ساخته شد.');
        else showToast('ساخت نقطه بازگشت ناموفق بود.', 'error');
    };

    window.nrRestoreSnapshot = async function (name) {
        try {
            const data = JSON.parse(await P.backupRead(name));
            validateBackupData(data);
            window.__pendingBackupImport = { data, fileName: name };
            openMergeModeModal(data, name);
        } catch (err) {
            console.error(err);
            showCustomAlert('خطا در خواندن نقطه بازگشت', String(err && err.message ? err.message : err));
        }
    };

    const originalSwitchSettingsSubTab = window.switchSettingsSubTab;
    window.switchSettingsSubTab = function (subTabId) {
        originalSwitchSettingsSubTab(subTabId);
        if (subTabId === 'data') renderNativeStorageCard();
    };

    // browser-only controls
    ['btn-change-backup-folder', 'autosync-card'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    // ---------- start-up ----------
    const originalBoot = window.__nrBoot;
    window.__nrBoot = async function () {
        await originalBoot();
        updateNativeStatus();
        if (window.__nrFirstRun) {
            showCustomAlert(
                'به نسخه نصبی «نسیم رهایی» خوش آمدید',
                'دیتابیس برنامه ساخته شد و فعلاً خالی است. برای انتقال اطلاعات از نسخه قبلی (فایل HTML): در همان نسخه قبلی دکمه «پشتیبان‌گیری» را بزنید تا فایل JSON دریافت شود، سپس اینجا از «تنظیمات ← ورود و خروج اطلاعات ← بازیابی / ادغام دیتابیس» همان فایل را انتخاب کنید.'
            );
        }
        // a daily restore point even on days nothing is edited
        try {
            const list = await P.backupList();
            const newest = list[0] ? list[0].takenAtMs : 0;
            if ((window.patients || []).length && Date.now() - newest > 24 * 60 * 60 * 1000) takeNativeSnapshot();
        } catch (e) { /* listing failure is reported when the user opens the data tab */ }
    };
})();
