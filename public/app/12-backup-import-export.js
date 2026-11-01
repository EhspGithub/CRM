// نسیم رهایی — پشتیبان‌گیری، بازیابی، خروجی و ورود اکسل
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

    // DATABASE BACKUP SYSTEM (Advanced storage tools with Directory Picker)
    // --- PERSISTENT BACKUP FOLDER (File System Access API + IndexedDB handle storage) ---
    // FileSystemDirectoryHandle objects are structured-clone-compatible, so we can store the
    // handle itself directly in IndexedDB and reuse it across sessions/reloads — this is what
    // lets the app "remember" the backup folder without asking the user to pick it every time.

    async function getSavedBackupFolderHandle() {
        try {
            const records = await dbGetAll('appHandles');
            const rec = (records || []).find(r => r.id === 'backupFolder');
            return rec ? rec.handle : null;
        } catch (e) {
            console.error('Failed to read saved backup folder handle:', e);
            return null;
        }
    }

    // Confirms we can actually read/write to a previously-saved folder handle. Permission state
    // resets to "prompt" between browser sessions, so this re-requests it when needed (must be
    // called from within a user-gesture call chain, which exportDatabase()/changeBackupFolder()
    // both satisfy since they run directly off a button click).
    async function verifyDirectoryPermission(handle) {
        try {
            const opts = { mode: 'readwrite' };
            let perm = await handle.queryPermission(opts);
            if (perm === 'granted') return true;
            if (perm === 'prompt') {
                perm = await handle.requestPermission(opts);
                return perm === 'granted';
            }
            return false; // 'denied'
        } catch (e) {
            // Handle can throw here if the underlying folder no longer exists
            console.error('Directory permission check failed:', e);
            return false;
        }
    }

    async function pickAndSaveNewBackupFolder(silent = false) {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await dbPutRecord('appHandles', { id: 'backupFolder', handle: dirHandle });
            if (!silent) showToast(`پوشه‌ی پیش‌فرض ذخیره‌ی بکاپ تنظیم شد: «${dirHandle.name}»`);
            return dirHandle;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Directory pick failed:', err);
                showToast('انتخاب پوشه با خطا مواجه شد.', 'error');
            }
            return null;
        }
    }

    // Button in the top toolbar — lets the user change the saved backup folder at any time.
    async function changeBackupFolder() {
        if (!('showDirectoryPicker' in window)) {
            showCustomAlert("عدم پشتیبانی مرورگر", "مرورگر فعلی از انتخاب پوشه پیش‌فرض پشتیبان‌گیری پشتیبانی نمی‌کند. لطفاً از مرورگر Google Chrome یا Microsoft Edge استفاده کنید.");
            return;
        }
        await pickAndSaveNewBackupFolder();
    }

    // Actually performs the save via the browser's native Save dialog, pointed at the saved
    // folder via `startIn`. This makes the dialog open directly inside that folder, showing its
    // existing files, with the suggested filename pre-filled — the user can rename, browse
    // elsewhere, or cancel, exactly like the native "Save As" experience.
    async function saveWithNativeDialog(dataStr, fileName, startInHandle) {
        const pickerOptions = {
            suggestedName: fileName,
            types: [{ description: 'فایل پشتیبان کلینیک (JSON)', accept: { 'application/json': ['.json'] } }]
        };
        if (startInHandle) pickerOptions.startIn = startInHandle;

        try {
            const fileHandle = await window.showSaveFilePicker(pickerOptions);
            const writable = await fileHandle.createWritable();
            await writable.write(dataStr);
            await writable.close();
            logBackupEvent('export', fileHandle.name || fileName);
            finalizeBackupUI(fileHandle.name || fileName);
        } catch (err) {
            if (err.name === 'AbortError') {
                showToast("ذخیره‌سازی فایل پشتیبان توسط کاربر لغو شد.", "error");
                return;
            }
            if (startInHandle) {
                // پوشه‌ی ذخیره‌شده احتمالاً دیگر معتبر نیست — یک‌بار بدون آن (در مکان پیش‌فرض مرورگر) امتحان می‌کنیم
                console.error('Save dialog failed with startIn hint, retrying without it:', err);
                await saveWithNativeDialog(dataStr, fileName, null);
            } else {
                fallbackDownload(dataStr, fileName);
            }
        }
    }

    async function exportDatabaseToFolder(dataStr, fileName) {
        let dirHandle = await getSavedBackupFolderHandle();

        if (dirHandle) {
            const hasAccess = await verifyDirectoryPermission(dirHandle);
            if (!hasAccess) {
                showToast("پوشه‌ی پشتیبان قبلی در دسترس نیست یا اجازه‌ی دسترسی داده نشد. لطفاً دوباره پوشه را انتخاب کنید.", "error");
                await dbDeleteRecord('appHandles', 'backupFolder');
                dirHandle = null;
            }
        }

        if (!dirHandle) {
            // اولین بار (یا نیاز به انتخاب مجدد): ابتدا پوشه‌ی پیش‌فرض تعیین می‌شود
            dirHandle = await pickAndSaveNewBackupFolder(true);
            if (!dirHandle) return; // کاربر انصراف داد
        }

        // در همه‌ی موارد — چه دفعه‌ی اول و چه دفعات بعد — پنجره‌ی استاندارد «ذخیره» مرورگر باز می‌شود،
        // دقیقاً داخل همان پوشه (سایر فایل‌های موجود هم قابل مشاهده‌اند)، و کاربر تأیید یا انصراف می‌دهد.
        await saveWithNativeDialog(dataStr, fileName, dirHandle);
    }

    // Shared by the manual "پشتیبان‌گیری" export and the silent auto-sync writer, so the two
    // can never drift apart in what they include.
    function buildBackupPayload() {
        return {
            patients: window.patients,
            visits: window.visits,
            contactLogs: window.contactLogs,
            insuranceHistory: window.insuranceHistory,
            auditLogs: window.auditLogs,
            backupHistory: window.backupHistory, // Make sure backup history is exported too
            patientReviews: window.patientReviews,
            mergeConflictLog: window.mergeConflictLog || [],
            opiumMembers: window.opiumMembers || [],
            opiumPlans: window.opiumPlans || [],
            opiumDeliveries: window.opiumDeliveries || [],
            opiumPeriods: window.opiumPeriods || [],
            settings: window.settings,
            staff: window.staff,
            exportedAt: new Date().toLocaleDateString('fa-IR')
        };
    }

    async function exportDatabase() {
        const payload = buildBackupPayload();

        const dataStr = JSON.stringify(payload, null, 4);
        const fileName = `nasim_rahayi_backup_${getBackupTimestampString()}.json`;

        if ('showSaveFilePicker' in window && 'showDirectoryPicker' in window) {
            // ترجیحی: پنجره‌ی ذخیره‌سازی همیشه داخل همان پوشه‌ی پیش‌فرض باز می‌شود
            await exportDatabaseToFolder(dataStr, fileName);
        } else if ('showSaveFilePicker' in window) {
            // مرورگرهایی که فقط از انتخاب فایل پشتیبانی می‌کنند نه پوشه (نادر)
            await saveWithNativeDialog(dataStr, fileName, null);
        } else {
            // هدایت خودکار به دانلود معمولی در مرورگرهای فاقد پشتیبانی (مانند فایرفاکس)
            fallbackDownload(dataStr, fileName);
        }
    }

    // پشتیبان دانلود معمولی در صورت عدم پشتیبانی مرورگر از دیالوگ انتخابی
    function fallbackDownload(dataStr, fileName) {
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // ثبت لاگ وقایع
        logBackupEvent('export', fileName);
        finalizeBackupUI(fileName);
    }

    // بروزرسانی نهایی رابط کاربری و خاموش کردن دکمه چشمک‌زن پس از ذخیره موفق
    function finalizeBackupUI(fileName) {
        clearTimeout(backupReminderTimeout);
        const btn = document.getElementById('btn-export-backup');
        if (btn) {
            btn.classList.remove('text-amber-400', 'bg-amber-900/50', 'animate-pulse', 'ring-1', 'ring-amber-500');
            btn.classList.add('text-teal-400', 'hover:bg-slate-700');
            btn.title = "پشتیبان‌گیری دیتابیس (دانلود فایل)";
        }

        needsBackup = false; // خاموش کردن پرچم نیاز به بکاپ جهت خروج امن
        setSidebarBackupStatus(false);
        showToast(`فایل پشتیبان با موفقیت در سیستم ذخیره شد.`);
    }

    // --- Shared backup-file validation (used by both Full Restore and Smart Merge) ---
    function validateBackupData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error("فایل پشتیبان باید یک ساختار معتبر داشته باشد.");
        }

        // Ensure core arrays exist and are actually arrays
        const requiredArrays = ['patients', 'visits', 'contactLogs', 'insuranceHistory', 'auditLogs', 'patientReviews', 'opiumMembers', 'opiumPlans', 'opiumDeliveries', 'opiumPeriods'];
        for (const key of requiredArrays) {
            if (data[key] && !Array.isArray(data[key])) {
                throw new Error(`ساختار داده‌های بخش «${key}» مخدوش است و آرایه نیست.`);
            }
        }

        // Deep check for patients (the most critical data)
        if (data.patients && data.patients.length > 0) {
            const isValidPatients = data.patients.every(p => p.id && (p.fullName || p.name) && p.nationalId !== undefined);
            if (!isValidPatients) {
                throw new Error("رکوردهای بیماران در فایل پشتیبان فاقد شناسه‌های ضروری (ID، نام، کدملی) است.");
            }
        }
    }

    // NEW: Entry point for BOTH file inputs. Parses/validates the file, then asks the user to
    // choose between a full replace ("بازیابی کامل") and the new Smart Backup Merge ("ادغام هوشمند")
    // BEFORE touching any local data, so nothing is overwritten by accident.
    function handleBackupFileSelected(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                validateBackupData(data);

                // Stash the parsed backup so the mode-selection modal buttons can act on it
                window.__pendingBackupImport = { data, fileName: file.name };
                openMergeModeModal(data, file.name);
            } catch (err) {
                console.error("Backup Validation Error:", err);
                showCustomAlert("خطای امنیتی فایل پشتیبان", err.message || "ساختار فایل پشتیبان نامعتبر است یا دستکاری شده است!");
            }

            // Clear input to allow re-importing the same file if needed
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    // Kept for backward-compatibility (in case anything else still calls importDatabase directly)
    function importDatabase(event) {
        handleBackupFileSelected(event);
    }

    // Full Restore: EXACT same behaviour/logic as before - a clean, total replace of local data
    // with the contents of the backup file. Reached only after the user explicitly picks it in
    // the mode-selection modal (see confirmFullRestore -> performFullRestore).
    function performFullRestore(data, fileName) {
        try {
            validateBackupData(data);

            // Safe assignment with fallbacks
            window.patients = data.patients || [];
            // Normalize nationalId/phone on restored records the same way as on regular load
            // (Persian digits → English, strip invisible/whitespace characters) — safe, non-destructive.
            window.patients.forEach(p => {
                if (p.nationalId !== undefined && p.nationalId !== null) p.nationalId = normalizeIdentifierValue(p.nationalId);
                if (p.phone !== undefined && p.phone !== null) p.phone = normalizeIdentifierValue(p.phone);
            });
            window.visits = data.visits || [];
            window.contactLogs = data.contactLogs || [];
            window.insuranceHistory = data.insuranceHistory || [];
            window.auditLogs = data.auditLogs || [];
            window.backupHistory = data.backupHistory || [];
            window.patientReviews = data.patientReviews || [];
            window.mergeConflictLog = data.mergeConflictLog || [];
            window.opiumMembers = data.opiumMembers || [];
            window.opiumPlans = data.opiumPlans || [];
            window.opiumDeliveries = data.opiumDeliveries || [];
            window.opiumPeriods = data.opiumPeriods || [];   // بکاپ‌های قدیمی بدون این کلید → بدون دوره (رفتار قبلی)

            // Validate Objects
            window.settings = (data.settings && typeof data.settings === 'object') ? data.settings : defaultSettings;

            // Deep check for staff object and inner arrays
            window.staff = JSON.parse(JSON.stringify(defaultStaff)); // Reset to clone of default
            if (data.staff && typeof data.staff === 'object') {
                if (Array.isArray(data.staff.doctors)) window.staff.doctors = data.staff.doctors;
                if (Array.isArray(data.staff.psychologists)) window.staff.psychologists = data.staff.psychologists;
                if (Array.isArray(data.staff.archivedDoctors)) window.staff.archivedDoctors = data.staff.archivedDoctors;
                if (Array.isArray(data.staff.archivedPsychologists)) window.staff.archivedPsychologists = data.staff.archivedPsychologists;
            }

            syncDatabase().then(() => {
                applySettings();
                renderDashboard();

                // Log Import History AFTER DB sync
                logBackupEvent('import', fileName);

                if (!document.getElementById('tab-patients-list').classList.contains('hidden')) {
                    renderPatientsList();
                }
                if (!document.getElementById('settings-sub-tab-data').classList.contains('hidden')) {
                    renderBackupHistoryList();
                }

                showToast("پایگاه داده IndexedDB با موفقیت بازیابی، اعتبارسنجی و بارگذاری شد.");
            });
        } catch (err) {
            console.error("Backup Validation Error:", err);
            showCustomAlert("خطای امنیتی فایل پشتیبان", err.message || "ساختار فایل پشتیبان نامعتبر است یا دستکاری شده است!");
        } finally {
            window.__pendingBackupImport = null;
        }
    }

    // NEW: Export to CSV functionality
    // Single source of truth for every column the Excel/CSV export can produce. The modal's
    // checkbox list is generated from this array, so adding a future column here is enough —
    // no need to touch the modal HTML separately.
    const EXCEL_EXPORT_COLUMNS = [
        { key: 'code', label: 'کد پرونده', getValue: p => p.code, defaultChecked: true },
        { key: 'fullName', label: 'نام و نام خانوادگی', getValue: p => p.fullName || (p.name + ' ' + p.lastname), defaultChecked: true },
        { key: 'nationalId', label: 'کد ملی', getValue: p => p.nationalId, defaultChecked: true },
        { key: 'birthdate', label: 'تاریخ تولد', getValue: p => p.birthdate, defaultChecked: true },
        { key: 'phone', label: 'شماره تماس', getValue: p => p.phone, defaultChecked: true },
        { key: 'admissionDate', label: 'تاریخ پذیرش', getValue: p => p.admissionDate, defaultChecked: true },
        { key: 'age', label: 'سن', getValue: p => p.age, defaultChecked: true },
        { key: 'gender', label: 'جنسیت', getValue: p => p.gender, defaultChecked: true },
        { key: 'marital', label: 'وضعیت تاهل', getValue: p => p.marital, defaultChecked: true },
        { key: 'employment', label: 'وضعیت اشتغال', getValue: p => p.employment, defaultChecked: true },
        { key: 'job', label: 'شغل', getValue: p => p.job, defaultChecked: true },
        { key: 'insurance', label: 'وضعیت بیمه', getValue: p => p.insurance, defaultChecked: true },
        { key: 'systemRegistered', label: 'ثبت در سامانه', getValue: p => p.systemRegistered || 'خیر', defaultChecked: false },
        { key: 'substance', label: 'ماده مصرفی', getValue: p => p.substance + (p.substanceOther ? ` (${p.substanceOther})` : ''), defaultChecked: true },
        { key: 'attempts', label: 'سابقه ترک قبلی', getValue: p => p.attempts, defaultChecked: true },
        { key: 'counselor', label: 'مشاور معالج', getValue: p => p.counselor, defaultChecked: true },
        { key: 'initialDrug', label: 'درمان بدو ورود', getValue: p => p.initialDrug, defaultChecked: true },
        { key: 'initialDosage', label: 'دوز بدو ورود', getValue: p => formatDosagePlain(p.initialDrug, p.initialDosage), defaultChecked: true },
        { key: 'currentDrug', label: 'درمان فعلی', getValue: p => p.currentDrug, defaultChecked: true },
        { key: 'currentDosage', label: 'دوز فعلی', getValue: p => formatDosagePlain(p.currentDrug, p.currentDosage), defaultChecked: true },
        { key: 'status', label: 'وضعیت پرونده', getValue: p => p.status, defaultChecked: true },
        { key: 'attendance', label: 'نظم حضور', getValue: p => p.attendance, defaultChecked: true },
        { key: 'medHistory', label: 'بیماری‌های زمینه‌ای', getValue: p => (p.medHistory && p.medHistory.length ? p.medHistory.join(' - ') : ''), defaultChecked: true },
        { key: 'medicalNotes', label: 'توضیحات بالینی', getValue: p => p.medicalNotes, defaultChecked: true },
        { key: 'deactiveReason', label: 'علت غیرفعال‌سازی', getValue: p => p.deactiveReason || '', defaultChecked: true }
    ];

    function openExcelExportModal() {
        if (!window.patients || window.patients.length === 0) {
            showCustomAlert("خطای خروجی", "هیچ مراجعی برای خروجی گرفتن در سامانه ثبت نشده است.");
            return;
        }

        const listContainer = document.getElementById('excel-export-columns-list');
        listContainer.innerHTML = EXCEL_EXPORT_COLUMNS.map(col => `
            <label class="flex items-center space-x-1.5 space-x-reverse cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border hover:bg-slate-100">
                <input type="checkbox" data-excel-col="${col.key}" ${col.defaultChecked ? 'checked' : ''} class="rounded text-teal-brand">
                <span>${escapeHTML(col.label)}</span>
            </label>
        `).join('');

        document.getElementById('excel-export-modal').classList.remove('hidden');
        lockBackgroundScroll();
    }

    function closeExcelExportModal() {
        document.getElementById('excel-export-modal').classList.add('hidden');
        unlockBackgroundScroll();
    }

    function toggleAllExcelExportColumns(checked) {
        document.querySelectorAll('#excel-export-columns-list input[type="checkbox"]').forEach(cb => cb.checked = checked);
    }

    function generateExcelExport() {
        const checkedKeys = Array.from(document.querySelectorAll('#excel-export-columns-list input[type="checkbox"]:checked'))
            .map(cb => cb.dataset.excelCol);

        if (checkedKeys.length === 0) {
            showCustomAlert("خطای خروجی", "لطفاً حداقل یک ستون را برای خروجی انتخاب کنید.");
            return;
        }

        const selectedColumns = EXCEL_EXPORT_COLUMNS.filter(col => checkedKeys.includes(col.key));

        const escapeCSV = (str) => {
            if (str === null || str === undefined) return '""';
            let stringified = str.toString();
            // Escape quotes and wrap in quotes if there's a comma, line break or quote
            if (stringified.includes('"') || stringified.includes(',') || stringified.includes('\n')) {
                stringified = '"' + stringified.replace(/"/g, '""') + '"';
            }
            return stringified;
        };

        const headers = selectedColumns.map(col => col.label);
        const rows = window.patients.map(p => selectedColumns.map(col => escapeCSV(col.getValue(p))));

        // \uFEFF forces Excel to read the file as UTF-8 (supports Persian characters seamlessly)
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `nasim_rahayi_export_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        closeExcelExportModal();
        showToast("فایل اکسل مراجعین (CSV) با موفقیت تولید و دانلود شد.");
    }

    // NEW: Import from CSV functionality
    function importCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                let text = e.target.result;

                // Strip a UTF-8 BOM if present (Excel adds this when saving "CSV UTF-8"),
                // otherwise it corrupts the first header cell.
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.slice(1);
                }

                // Split rows robustly: Windows (\r\n), Unix (\n) and old Mac (\r-only) line endings.
                const rows = text.split(/\r\n|\r|\n/).map(row => row.trim()).filter(row => row.length > 0);

                // Auto-detect delimiter: on many non-English Windows regional settings
                // (including Persian/Iran), Excel's "CSV (Comma delimited)" export actually
                // uses a semicolon, based on the OS's configured List Separator — despite the
                // label. Pick whichever separator appears more often in the header row.
                const headerRow = rows[0] || '';
                const commaCount = (headerRow.match(/,/g) || []).length;
                const semicolonCount = (headerRow.match(/;/g) || []).length;
                const delimiter = semicolonCount > commaCount ? ';' : ',';

                // Minimal CSV field parser that understands double-quoted fields, so a
                // delimiter character inside quotes doesn't break column alignment.
                function parseCSVLine(line, delim) {
                    const result = [];
                    let cur = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i];
                        if (inQuotes) {
                            if (ch === '"') {
                                if (line[i + 1] === '"') { cur += '"'; i++; }
                                else { inQuotes = false; }
                            } else {
                                cur += ch;
                            }
                        } else {
                            if (ch === '"') { inQuotes = true; }
                            else if (ch === delim) { result.push(cur.trim()); cur = ''; }
                            else { cur += ch; }
                        }
                    }
                    result.push(cur.trim());
                    return result;
                }

                let importedCount = 0;
                let skippedDuplicateCodes = [];

                // کدهای پرونده‌ی از قبل موجود در دیتابیس + کدهایی که در همین Import تازه اضافه
                // شده‌اند، هر دو باید در نظر گرفته شوند تا هیچ دو پرونده‌ای (چه در دیتابیس فعلی،
                // چه داخل همین فایل اکسل) کد یکسان نگیرند.
                const usedCodesSoFar = new Set(
                    window.patients.map(p => parseInt(p.code, 10)).filter(c => !isNaN(c))
                );

                // Assuming Row 1 is the header row, we start from i = 1
                for (let i = 1; i < rows.length; i++) {
                    const cols = parseCSVLine(rows[i], delimiter);

                    // Fallback logic for empty columns
                    let pCode = cols[0] || (Math.floor(Math.random() * 90000) + 10000).toString();
                    let pName = cols[1] || ("بیمار ناشناس " + Math.floor(Math.random() * 1000));

                    // جلوگیری از کد پرونده تکراری هنگام Import: اگر این کد قبلاً در دیتابیس
                    // بوده یا در همین فایل تکرار شده باشد، این ردیف وارد نمی‌شود تا هرگز دو
                    // پرونده با یک کد ساخته نشود. ردیف‌های رد‌شده در پیام نهایی گزارش می‌شوند.
                    const parsedCodeCheck = parseInt(pCode, 10);
                    if (!isNaN(parsedCodeCheck) && usedCodesSoFar.has(parsedCodeCheck)) {
                        skippedDuplicateCodes.push(parsedCodeCheck);
                        continue;
                    }
                    // National ID is OPTIONAL: leave it empty when the Excel cell is blank instead
                    // of fabricating a random 10-digit number. A fake number would virtually always
                    // fail the checksum validation later, blocking the user from ever editing/saving
                    // that record again — exactly the bug this fix resolves.
                    let pNationalId = normalizeIdentifierValue(cols[2]) || '';
                    let pBirthdate = cols[3] || `13${Math.floor(Math.random() * 40) + 40}/0${Math.floor(Math.random() * 9) + 1}/1${Math.floor(Math.random() * 9)}`;
                    let pPhone = normalizeIdentifierValue(cols[4]) || `0912${Math.floor(1000000 + Math.random() * 9000000)}`;
                    let pAdmissionDate = cols[5] || getShamsiToday();
                    let pInitialDrug = cols[6] || "روان درمانی";
                    let pCurrentDrug = cols[7] || pInitialDrug;
                    let pCurrentDosage = parseFloat(cols[8]) || 0;

                    // NEW: Gender (column 10, optional) — accepts فارسی (مرد/زن) or English (M/F, Male/Female)
                    const genderRaw = (cols[9] || '').trim();
                    let pGender = 'مرد'; // default when column is empty or unrecognized
                    if (genderRaw === 'زن' || /^f(emale)?$/i.test(genderRaw)) {
                        pGender = 'زن';
                    } else if (genderRaw === 'مرد' || /^m(ale)?$/i.test(genderRaw)) {
                        pGender = 'مرد';
                    }

                    const newPatient = {
                        id: crypto.randomUUID(),
                        code: parseInt(pCode) || (Math.floor(Math.random() * 90000) + 10000),
                        fullName: pName,
                        nationalId: pNationalId,
                        birthdate: pBirthdate,
                        age: calculateShamsiAge(pBirthdate) || 30, // Default to 30 if formatting fails
                        gender: pGender,
                        marital: "مجرد",
                        employment: "آزاد",
                        job: "",
                        phone: pPhone,
                        admissionDate: pAdmissionDate,
                        insurance: "ندارد",
                        attempts: "هیچ‌وقت ترک نکرده",
                        counselor: window.staff?.psychologists?.[0] || "",
                        substance: "تریاک",
                        substanceOther: "",
                        startAge: 20,
                        duration: 5,
                        medHistory: [],
                        medicalNotes: "وارد شده از طریق فایل اکسل/CSV",
                        initialDrug: pInitialDrug,
                        initialDosage: pCurrentDosage,
                        currentDrug: pCurrentDrug,
                        currentDosage: pCurrentDosage,
                        status: "فعال",
                        attendance: "منظم",
                        deactiveReason: "",
                        deactiveNotes: ""
                    };

                    window.patients.unshift(newPatient);
                    dbPutRecord('patients', newPatient);
                    usedCodesSoFar.add(newPatient.code);
                    importedCount++;
                }

                if (skippedDuplicateCodes.length > 0) {
                    showCustomAlert(
                        "کدهای پرونده تکراری رد شدند",
                        `${toPersianDigits(skippedDuplicateCodes.length)} ردیف به دلیل تکراری بودن کد پرونده وارد نشد (کدهای تکراری: ${skippedDuplicateCodes.map(toPersianDigits).join('، ')}). لطفاً برای این ردیف‌ها کد پرونده‌ی دیگری در فایل اکسل تعیین و دوباره Import کنید.`
                    );
                }

                if (importedCount > 0) {
                    triggerBackupReminder();
                    renderDashboard();
                    if (!document.getElementById('tab-patients-list').classList.contains('hidden')) {
                        renderPatientsList();
                    }
                    showToast(`${toPersianDigits(importedCount)} پرونده با موفقیت از اکسل وارد شد.`);
                } else {
                    showCustomAlert("خطای اکسل", "فایل CSV خالی است یا داده‌های معتبری ندارد.");
                }

                // Reset input
                event.target.value = '';

            } catch (err) {
                console.error(err);
                showCustomAlert("خطای پردازش", "مشکلی در خواندن ساختار فایل اکسل به وجود آمد.");
            }
        };
        reader.readAsText(file);
    }

    // NEW: Clear all database and local storage
    function clearAllData() {
        showCustomConfirm(
            "هشدار امنیتی: پاکسازی کل دیتابیس", 
            "آیا از حذف تمامی مراجعین، سوابق ویزیت‌ها، گزارشات و لاگ‌ها اطمینان دارید؟ این عمل غیرقابل بازگشت است و دیتابیس به حالت خام (صفر) در می‌آید!", 
            async () => {
                // Empty all arrays
                window.patients = [];
                window.visits = [];
                window.contactLogs = [];
                window.insuranceHistory = [];
                window.auditLogs = [];
                window.backupHistory = [];
                window.patientReviews = [];
                window.opiumMembers = [];
                window.opiumPlans = [];
                window.opiumDeliveries = [];
                window.opiumPeriods = [];

                // Reset to defaults
                window.settings = JSON.parse(JSON.stringify(defaultSettings));
                window.staff = JSON.parse(JSON.stringify(defaultStaff));

                // Clear local storage fallbacks if any
                localStorage.removeItem('nr_patients');
                localStorage.removeItem('nr_visits');
                localStorage.removeItem('nr_contact_logs');
                localStorage.removeItem('nr_insurance_history');
                localStorage.removeItem('nr_audit_logs');
                localStorage.removeItem('nr_settings');
                localStorage.removeItem('nr_staff');
                // No need to remove old backupHistory from localStorage as it didn't exist there

                // Save empty states to IndexedDB
                await syncDatabase();

                showToast("تمامی اطلاعات سامانه با موفقیت پاکسازی شد. در حال بارگذاری مجدد...");

                // Reload to refresh charts and views cleanly
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        );
    }

    // Banners - New Tooltip Logic
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-tooltip');
    const msgSpan = document.getElementById('toast-tooltip-message');

    if (toast && msgSpan) {
        msgSpan.innerText = message;

        // Dynamic styling of inner container and icon based on notification type
        const innerContainer = toast.querySelector('div');
        const iconEl = toast.querySelector('i');

        if (innerContainer) {
            // Reset to baseline styles
            innerContainer.className = "bg-slate-800 px-3 py-2 rounded-lg shadow-lg border flex items-center space-x-2 space-x-reverse text-[11px] font-bold";

            if (type === 'error') {
                innerContainer.classList.add('text-rose-400', 'border-rose-950/40');
                if (iconEl) iconEl.className = "fa-solid fa-circle-xmark text-sm text-rose-400";
            } else if (type === 'warning') {
                innerContainer.classList.add('text-amber-400', 'border-amber-950/40');
                if (iconEl) iconEl.className = "fa-solid fa-triangle-exclamation text-sm text-amber-400";
            } else {
                // Default Success
                innerContainer.classList.add('text-teal-400', 'border-slate-700');
                if (iconEl) iconEl.className = "fa-solid fa-circle-check text-sm text-teal-400";
            }
        }

        // Show toast (slide down slightly)
        toast.classList.remove('-translate-y-4', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        // Clear previous timeout to avoid early hiding on multiple clicks
        if (window.toastTimeout) {
            clearTimeout(window.toastTimeout);
        }

        window.toastTimeout = setTimeout(() => {
            // Hide toast
            toast.classList.add('-translate-y-4', 'opacity-0');
            toast.classList.remove('translate-y-0', 'opacity-100');
        }, 3000);
    }
}

// --- NEW: Safe Exit / Before Unload Warning ---
    // هشدار خروج امن: جلوگیری از بسته شدن ناخواسته تب مرورگر در هر شرایطی
    window.addEventListener('beforeunload', function (e) {
        // در اپ نصبی، هر تغییر همان لحظه در دیتابیس SQLite ذخیره شده؛ هشدار خروج فقط برای نسخه مرورگری است
        if (window.NR_NATIVE) return;
        // لغو رویداد استاندارد برای نمایش دیالوگ امنیتی مرورگر
        e.preventDefault();
        // مرورگرهای مدرن متن سفارشی را نادیده می‌گیرند، اما وجود این خط برای فعال شدن پاپ‌آپ الزامی است
        e.returnValue = 'آیا از بستن سامانه اطمینان دارید؟ ممکن است اطلاعات ذخیره نشده از دست برود.';
    });

    // --- NEW: Backup History Logging & Rendering ---
    function logBackupEvent(type, fileName) {
        if (!window.backupHistory) window.backupHistory = [];

        const currentDate = getShamsiToday();
        const currentTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

        const newLog = {
            id: crypto.randomUUID(),
            type: type, // 'export' or 'import'
            date: currentDate,
            time: currentTime,
            fileName: fileName || 'ناشناس',
            recordedBy: window.staff?.doctors?.[0] || 'سیستم'
        };

        window.backupHistory.unshift(newLog);
        dbPutRecord('backupHistory', newLog);

        // If the settings data tab is currently visible, refresh the list
        if (!document.getElementById('settings-sub-tab-data').classList.contains('hidden')) {
            renderBackupHistoryList();
        }
    }

    function renderBackupHistoryList() {
        const container = document.getElementById('backup-history-list');
        if (!container) return;

        if (!window.backupHistory || window.backupHistory.length === 0) {
            container.innerHTML = `
                <div class="text-center text-xs text-slate-500 py-6 italic font-bold border border-dashed border-slate-700/50 bg-slate-800/30 rounded-xl">
                    تاکنون تاریخچه‌ای از پشتیبان‌گیری یا بازیابی ثبت نشده است.
                </div>`;
            return;
        }

        // Sort descending by implicit id/time
        const sortedHistory = [...window.backupHistory].sort((a, b) => b.id.localeCompare(a.id));

        let html = '';
        sortedHistory.forEach(log => {
            let colorClass, iconName, titleText;
            if (log.type === 'export') {
                colorClass = 'text-teal-400 bg-teal-400/10'; iconName = 'fa-download'; titleText = 'ایجاد فایل پشتیبان';
            } else if (log.type === 'merge') {
                colorClass = 'text-amber-400 bg-amber-400/10'; iconName = 'fa-code-merge'; titleText = 'ادغام هوشمند بکاپ';
            } else {
                colorClass = 'text-indigo-400 bg-indigo-400/10'; iconName = 'fa-upload'; titleText = 'بازیابی کامل از فایل';
            }

            html += `
                <div class="flex items-center gap-3 p-2.5 bg-slate-700/20 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}">
                        <i class="fa-solid ${iconName} text-[11px]"></i>
                    </div>
                    <div class="flex-1 flex flex-wrap sm:flex-nowrap items-center justify-between min-w-0 gap-2">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="text-[11px] font-bold text-slate-200 whitespace-nowrap">${titleText}</span>
                            <span class="text-[9px] text-slate-400 font-medium truncate flex items-center" dir="ltr"><i class="fa-regular fa-file-code ml-1 text-slate-500"></i>${escapeHTML(log.fileName)}</span>
                        </div>
                        <div class="flex items-center gap-3 whitespace-nowrap">
                            <span class="text-[9px] text-slate-300 font-medium flex items-center"><i class="fa-regular fa-user ml-1 text-slate-500"></i>${escapeHTML(log.recordedBy)}</span>
                            <span class="text-[9px] font-yekan text-slate-400 font-medium flex items-center"><i class="fa-regular fa-clock ml-1 text-slate-500"></i>${toPersianDigits(log.date)} - ${toPersianDigits(log.time)}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function clearBackupHistory() {
        if (!window.backupHistory || window.backupHistory.length === 0) {
            showToast("تاریخچه خالی است.");
            return;
        }

        showCustomConfirm(
            "پاکسازی تاریخچه پشتیبان‌گیری",
            "آیا از حذف تاریخچه وقایع پشتیبان‌گیری و بازیابی مطمئن هستید؟ این کار فایل‌های شما را پاک نمی‌کند، فقط این لیست نمایشی را خالی می‌کند.",
            async () => {
                window.backupHistory = [];
                await dbPutAll('backupHistory', []);

                renderBackupHistoryList();
                showToast("تاریخچه پشتیبان‌گیری و بازیابی با موفقیت پاک شد.");
            }
        );
    }
