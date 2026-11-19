// نسیم رهایی — ادغام هوشمند بکاپ
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// =====================================================================================
// NEW: SMART BACKUP MERGE ("ادغام هوشمند بکاپ")
// ---------------------------------------------------------------------------------------
// Lets two devices (e.g. doctor's device & nurse's device) that started from the same base
// data but evolved independently, combine a backup file into the CURRENT local data instead
// of replacing it. Core rules:
//   1) Records that exist only on one side are always kept (no data is ever silently deleted).
//   2) Records that exist on both sides and are identical are left untouched.
//   3) Records that exist on both sides and differ are resolved automatically ONLY when we can
//      reliably tell which one is newer (both have an "_updatedAt" timestamp and they differ).
//   4) Everything else (genuine conflicts, or missing timestamps) is shown to the user for a
//      manual decision - keep local / keep backup / keep both as separate records. Nothing is
//      ever auto-discarded without either a reliable timestamp or an explicit user choice.
//   5) Patients that look like the same person (same national ID) but have different record ids
//      on each device are flagged separately so duplicate patient files are not created blindly.
// =====================================================================================

// Which local arrays + IndexedDB stores participate in per-record merge, and how to describe
// a record to the person reviewing conflicts.
const MERGE_STORE_CONFIG = {
    patients:         { label: 'پرونده مراجعین',      titleFn: r => `${r.fullName || r.name || '-'} (کد پرونده ${r.code ?? '-'})` },
    visits:           { label: 'ویزیت‌ها',             titleFn: r => `ویزیت ${r.date || ''} — ${mergePatientNameById(r.patientId)}` },
    contactLogs:      { label: 'تماس‌ها و پیگیری‌ها',   titleFn: r => `تماس ${r.date || ''} — ${mergePatientNameById(r.patientId)}` },
    insuranceHistory: { label: 'تاریخچه بیمه',          titleFn: r => `بیمه ${r.date || ''} — ${mergePatientNameById(r.patientId)}` },
    patientReviews:   { label: 'بررسی پرونده‌ها',       titleFn: r => `بررسی ${r.date || ''} — ${r.patientName || mergePatientNameById(r.patientId)}` },
    auditLogs:        { label: 'رویدادهای سیستم',       titleFn: r => `${r.fieldName || 'رویداد'} — ${mergePatientNameById(r.patientId)}` },
    opiumMembers:     { label: 'فهرست مدیریت اپیوم',    titleFn: r => `عضو فهرست اپیوم — ${mergePatientNameById(r.patientId)}` },
    opiumPlans:       { label: 'برنامه‌های تحویل اپیوم', titleFn: r => `برنامه ${r.startDate || ''} — ${mergePatientNameById(r.patientId)}` },
    opiumDeliveries:  { label: 'تحویل‌های واقعی اپیوم',  titleFn: r => `تحویل ${r.date || ''} — ${mergePatientNameById(r.patientId)}` },
    opiumPeriods:     { label: 'دوره‌های توزیع اپیوم',    titleFn: r => `دوره ${r.no ?? ''} — شروع ${r.startDate || ''}` }
};

// Persian labels for the most common fields, purely cosmetic for the diff table
const MERGE_FIELD_LABELS = {
    fullName: 'نام و نام خانوادگی', code: 'کد پرونده', nationalId: 'کد ملی', phone: 'تلفن',
    status: 'نوع حضور', fileStatus: 'محل پرونده', visitShift: 'شیفت مراجعه', attendance: 'نظم حضور', insurance: 'وضعیت بیمه', counselor: 'مشاور (روانشناس)',
    currentDrug: 'داروی فعلی', currentDosage: 'دوز فعلی', initialDrug: 'داروی شروع', initialDosage: 'دوز شروع',
    medicalNotes: 'یادداشت پزشکی', deactiveReason: 'علت غیرفعالی', deactiveNotes: 'توضیحات غیرفعالی',
    date: 'تاریخ', time: 'ساعت', notes: 'یادداشت', recordedBy: 'ثبت‌کننده', physician: 'پزشک',
    drug: 'دارو', quantity: 'مقدار', dosage: 'دوز', prevDrug: 'داروی قبلی', newDrug: 'داروی جدید',
    medHistory: 'سوابق پزشکی', dispenseHistory: 'تاریخچه ارائه دارو', birthdate: 'تاریخ تولد',
    job: 'شغل', employment: 'اشتغال', marital: 'وضعیت تأهل', admissionDate: 'تاریخ پذیرش',
    substance: 'ماده مصرفی', attempts: 'دفعات ترک', campHistory: 'سابقه اقامت در کمپ', campStays: 'دوره‌های اقامت در کمپ'
};
function mergeFieldLabel(f) { return MERGE_FIELD_LABELS[f] || f; }

function mergePatientNameById(id) {
    const p = (window.patients || []).find(x => x.id === id);
    return p ? (p.fullName || p.name || 'نامشخص') : 'نامشخص';
}

// Returns the list of fields where two records differ (ignores internal bookkeeping fields)
function getRecordDiffFields(a, b) {
    const ignoreFields = ['_updatedAt'];
    const fields = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    ignoreFields.forEach(f => fields.delete(f));
    const diffs = [];
    fields.forEach(f => {
        const av = a ? a[f] : undefined;
        const bv = b ? b[f] : undefined;
        if (JSON.stringify(av) !== JSON.stringify(bv)) {
            diffs.push({ field: f, localValue: av, backupValue: bv });
        }
    });
    return diffs;
}

function formatMergeValue(v) {
    if (v === undefined || v === null || v === '') return '<span class="text-slate-300 italic">خالی</span>';
    if (Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object' && 'start' in x)) {
        // دوره‌های اقامت در کمپ
        return escapeHTML(v.map(x => `${toPersianDigits(x.start || '?')} تا ${x.end ? toPersianDigits(x.end) : 'نامشخص'}`).join('، '));
    }
    if (Array.isArray(v)) return v.length ? escapeHTML(v.join('، ')) : '<span class="text-slate-300 italic">خالی</span>';
    if (typeof v === 'object') return escapeHTML(JSON.stringify(v));
    return escapeHTML(String(v));
}

// Compares local vs. backup arrays for ONE store and buckets every backup record into:
//   toAdd               -> exists only in the backup -> just add it
//   toAutoApplyBackup    -> exists in both, differs, backup is reliably newer -> auto-apply
//   conflicts            -> exists in both, differs, cannot reliably tell which is newer -> ask user
// (Records where local is reliably newer need no action - local is already correct.)
function analyzeStoreMerge(storeKey, localArr, backupArr) {
    localArr = Array.isArray(localArr) ? localArr : [];
    backupArr = Array.isArray(backupArr) ? backupArr : [];
    const localMap = new Map(localArr.filter(r => r && r.id).map(r => [r.id, r]));
    const result = { toAdd: [], toAutoApplyBackup: [], conflicts: [], unchangedCount: 0 };

    backupArr.forEach(bRec => {
        if (!bRec || !bRec.id) return;
        const lRec = localMap.get(bRec.id);
        if (!lRec) { result.toAdd.push(bRec); return; }

        const diffs = getRecordDiffFields(lRec, bRec);
        if (diffs.length === 0) { result.unchangedCount++; return; }

        const lt = typeof lRec._updatedAt === 'number' ? lRec._updatedAt : null;
        const bt = typeof bRec._updatedAt === 'number' ? bRec._updatedAt : null;

        if (lt !== null && bt !== null && lt !== bt) {
            if (bt > lt) result.toAutoApplyBackup.push({ id: bRec.id, record: bRec, diffs });
            // else local is newer -> nothing to do, local stays as-is
        } else {
            result.conflicts.push({ storeKey, id: bRec.id, local: lRec, backup: bRec, diffs });
        }
    });

    return result;
}

// Finds brand-new backup patients (not present locally by id) that share a national ID with an
// existing local patient under a DIFFERENT id - almost certainly the same person registered
// independently on both devices. These are pulled out of "toAdd" and handled as a special
// conflict type so we never silently create a duplicate patient file.
function detectDuplicatePersons(localPatients, newBackupPatients) {
    const dups = [];
    (newBackupPatients || []).forEach(bp => {
        if (!bp || !bp.nationalId) return;
        const match = (localPatients || []).find(lp => lp.nationalId && lp.nationalId === bp.nationalId && lp.id !== bp.id);
        if (match) dups.push({ backup: bp, local: match });
    });
    return dups;
}

// Simple, non-destructive union merge for the staff roster (doctors / psychologists lists).
// New names found in the backup are appended; nothing already present locally is ever removed.
function mergeStaffUnion(localStaff, backupStaff) {
    const result = {
        doctors: [...(localStaff?.doctors || [])],
        psychologists: [...(localStaff?.psychologists || [])],
        archivedDoctors: [...(localStaff?.archivedDoctors || [])],
        archivedPsychologists: [...(localStaff?.archivedPsychologists || [])],
        updated_v2_ebrahimi: true
    };
    if (backupStaff && typeof backupStaff === 'object') {
        (backupStaff.doctors || []).forEach(d => { if (d && !result.doctors.includes(d)) result.doctors.push(d); });
        (backupStaff.psychologists || []).forEach(p => { if (p && !result.psychologists.includes(p)) result.psychologists.push(p); });
        (backupStaff.archivedDoctors || []).forEach(d => { if (d && !result.archivedDoctors.includes(d)) result.archivedDoctors.push(d); });
        (backupStaff.archivedPsychologists || []).forEach(p => { if (p && !result.archivedPsychologists.includes(p)) result.archivedPsychologists.push(p); });
    }
    return result;
}

// --- Mode-selection modal (shown right after a backup file is chosen) ---
function openMergeModeModal(data, fileName) {
    const infoBox = document.getElementById('merge-mode-file-info');
    if (infoBox) {
        const pCount = Array.isArray(data.patients) ? data.patients.length : 0;
        infoBox.innerHTML = `<i class="fa-regular fa-file-code ml-1"></i> فایل انتخاب‌شده: <b dir="ltr">${escapeHTML(fileName)}</b><br><i class="fa-solid fa-users ml-1 mt-1 inline-block"></i> تعداد مراجعین موجود در این فایل: <b>${toPersianDigits(pCount)}</b>`;
    }
    document.getElementById('merge-mode-modal').classList.remove('hidden');
    lockBackgroundScroll();
}
function closeMergeModeModal() {
    document.getElementById('merge-mode-modal').classList.add('hidden');
    unlockBackgroundScroll();
    window.__pendingBackupImport = null;
}

function confirmFullRestore() {
    const pending = window.__pendingBackupImport;
    if (!pending) return;
    closeMergeModeModal();
    // Re-stash since closeMergeModeModal() clears it - we need it for the confirm callback below
    window.__pendingBackupImport = pending;
    showCustomConfirm(
        "بازیابی کامل بکاپ",
        "با این کار تمامی اطلاعات فعلی این دستگاه با اطلاعات فایل پشتیبان جایگزین می‌شود و هرگونه تغییر محلی که در این فایل نیست از بین می‌رود. در صورت تمایل به حفظ اطلاعات هر دو دستگاه، از گزینه «ادغام هوشمند» استفاده کنید. آیا مطمئن هستید؟",
        () => performFullRestore(pending.data, pending.fileName)
    );
}

// --- Conflict-review modal ---
function openMergeReviewModal() {
    document.getElementById('merge-review-modal').classList.remove('hidden');
    lockBackgroundScroll();
    updateMergeApplyState();
}
function closeMergeReviewModal() {
    document.getElementById('merge-review-modal').classList.add('hidden');
    unlockBackgroundScroll();
    window.__mergeSession = null;
    window.__pendingBackupImport = null;
}

function buildConflictCardHTML(c) {
    const cfg = MERGE_STORE_CONFIG[c.storeKey] || { label: c.storeKey, titleFn: r => r.id };
    let title = '-';
    try { title = cfg.titleFn(c.local); } catch (e) { title = c.id; }
    const key = `${c.storeKey}::${c.id}`;
    const rows = c.diffs.map(d => `
        <tr class="border-t border-slate-100">
            <td class="py-1.5 px-2 text-[10px] font-bold text-slate-500 whitespace-nowrap align-top">${escapeHTML(mergeFieldLabel(d.field))}</td>
            <td class="py-1.5 px-2 text-[10px] text-slate-700 align-top">${formatMergeValue(d.localValue)}</td>
            <td class="py-1.5 px-2 text-[10px] text-slate-700 align-top">${formatMergeValue(d.backupValue)}</td>
        </tr>`).join('');

    return `
    <div class="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white" data-conflict-key="${key}">
        <div class="flex items-center justify-between gap-2 flex-wrap">
            <h5 class="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> ${escapeHTML(title)}
            </h5>
            <span class="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-lg">${escapeHTML(cfg.label)}</span>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-right">
                <thead>
                    <tr class="text-[10px] text-slate-400">
                        <th class="px-2 pb-1 text-right font-bold">فیلد</th>
                        <th class="px-2 pb-1 text-right font-bold">نسخه محلی (این دستگاه)</th>
                        <th class="px-2 pb-1 text-right font-bold">نسخه فایل بکاپ</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
            <button type="button" onclick="setMergeResolution('${c.storeKey}','${c.id}','local',this)" class="merge-choice-btn px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-300 hover:bg-slate-50 transition">نگه‌داشتن نسخه محلی</button>
            <button type="button" onclick="setMergeResolution('${c.storeKey}','${c.id}','backup',this)" class="merge-choice-btn px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-300 hover:bg-slate-50 transition">استفاده از نسخه بکاپ</button>
            <button type="button" onclick="setMergeResolution('${c.storeKey}','${c.id}','both',this)" class="merge-choice-btn px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-300 hover:bg-slate-50 transition">نگه‌داشتن هر دو (به‌صورت جداگانه)</button>
        </div>
    </div>`;
}

function buildDupPersonCardHTML(d) {
    const key = `dup::${d.backup.id}`;
    return `
    <div class="border border-amber-200 rounded-2xl p-4 space-y-3 bg-amber-50/40" data-conflict-key="${key}">
        <h5 class="text-xs font-extrabold text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-user-group text-amber-500"></i> تشابه احتمالی مراجع: ${escapeHTML(d.local.fullName || d.local.name || '-')}
        </h5>
        <p class="text-[10px] text-slate-500 leading-relaxed">
            یک پرونده جدید در فایل بکاپ با کد ملی «${escapeHTML(String(d.backup.nationalId))}» یافت شد که با کد ملی مراجع «${escapeHTML(d.local.fullName || d.local.name || '-')}» (کد پرونده ${escapeHTML(String(d.local.code ?? '-'))}) موجود در این دستگاه یکسان است، اما با شناسه و مشخصات جداگانه‌ای ثبت شده است (نام در بکاپ: «${escapeHTML(d.backup.fullName || d.backup.name || '-')}»، کد پرونده در بکاپ: ${escapeHTML(String(d.backup.code ?? '-'))}).
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
            <button type="button" onclick="setDupResolution('${d.backup.id}','ignore',this)" class="merge-choice-btn px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-300 hover:bg-slate-50 transition">همان فرد است؛ رکورد بکاپ نادیده گرفته شود</button>
            <button type="button" onclick="setDupResolution('${d.backup.id}','add',this)" class="merge-choice-btn px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-300 hover:bg-slate-50 transition">دو نفر متفاوت هستند؛ به‌عنوان پرونده جدید اضافه شود</button>
        </div>
    </div>`;
}

function renderMergeReviewModal(session) {
    const body = document.getElementById('merge-review-body');
    if (!body) return;
    let html = '';

    if (session.dupPersons.length > 0) {
        html += `<div><h4 class="text-[11px] font-extrabold text-amber-600 mb-2 flex items-center gap-1"><i class="fa-solid fa-user-group"></i> احتمال تکراری بودن مراجع (${toPersianDigits(session.dupPersons.length)} مورد)</h4><div class="space-y-3">`;
        session.dupPersons.forEach(d => { html += buildDupPersonCardHTML(d); });
        html += `</div></div>`;
    }

    Object.keys(session.analysis).forEach(storeKey => {
        const a = session.analysis[storeKey];
        if (!a.conflicts.length) return;
        const cfg = MERGE_STORE_CONFIG[storeKey];
        html += `<div><h4 class="text-[11px] font-extrabold text-slate-600 mb-2 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-amber-500"></i> ${escapeHTML(cfg ? cfg.label : storeKey)} (${toPersianDigits(a.conflicts.length)} مورد)</h4><div class="space-y-3">`;
        a.conflicts.forEach(c => { html += buildConflictCardHTML(c); });
        html += `</div></div>`;
    });

    body.innerHTML = html || `<p class="text-xs text-slate-400 text-center py-6">موردی برای بررسی وجود ندارد.</p>`;
}

function highlightMergeChoice(btnEl) {
    if (!btnEl || !btnEl.parentElement) return;
    const group = btnEl.parentElement.querySelectorAll('.merge-choice-btn');
    group.forEach(b => {
        b.classList.remove('bg-teal-brand', 'text-white', 'border-teal-brand');
        b.classList.add('border-slate-300');
    });
    btnEl.classList.add('bg-teal-brand', 'text-white', 'border-teal-brand');
    btnEl.classList.remove('border-slate-300');
}

function countTotalConflicts(session) {
    let total = session.dupPersons.length;
    Object.values(session.analysis).forEach(a => { total += a.conflicts.length; });
    return total;
}

function updateMergeApplyState() {
    const session = window.__mergeSession;
    if (!session) return;
    const totalNeeded = countTotalConflicts(session);
    const resolvedCount = Object.keys(session.resolutions).length + Object.keys(session.dupResolutions).length;
    const counter = document.getElementById('merge-resolve-counter');
    const btn = document.getElementById('btn-apply-merge');
    if (counter) counter.innerText = `${toPersianDigits(resolvedCount)} از ${toPersianDigits(totalNeeded)} مورد بررسی شد`;
    if (btn) {
        btn.disabled = resolvedCount < totalNeeded;
        btn.classList.toggle('opacity-40', resolvedCount < totalNeeded);
        btn.classList.toggle('cursor-not-allowed', resolvedCount < totalNeeded);
    }
}

function setMergeResolution(storeKey, id, choice, btnEl) {
    const session = window.__mergeSession;
    if (!session) return;
    session.resolutions[`${storeKey}::${id}`] = choice;
    highlightMergeChoice(btnEl);
    updateMergeApplyState();
}
function setDupResolution(backupId, choice, btnEl) {
    const session = window.__mergeSession;
    if (!session) return;
    session.dupResolutions[backupId] = choice;
    highlightMergeChoice(btnEl);
    updateMergeApplyState();
}

// Convenience action: resolves every remaining conflict as "keep both" (patients: add as new
// file) - the safest possible default since it can never destroy data, only ever duplicate it
// for the staff to manually tidy up afterwards if needed.
function bulkResolveKeepBoth() {
    const session = window.__mergeSession;
    if (!session) return;
    document.querySelectorAll('#merge-review-body [data-conflict-key]').forEach(card => {
        const key = card.getAttribute('data-conflict-key');
        const buttons = card.querySelectorAll('.merge-choice-btn');
        if (key.indexOf('dup::') === 0) {
            const backupId = key.split('::')[1];
            setDupResolution(backupId, 'add', buttons[1]);
        } else {
            const parts = key.split('::');
            setMergeResolution(parts[0], parts[1], 'both', buttons[2]);
        }
    });
}

// Entry point once the user picks "ادغام هوشمند" in the mode-selection modal.
function startSmartMerge() {
    const pending = window.__pendingBackupImport;
    if (!pending) return;
    const data = pending.data;
    closeMergeModeModal();
    window.__pendingBackupImport = pending; // keep it alive, closeMergeModeModal cleared it

    const storesToMerge = Object.keys(MERGE_STORE_CONFIG);
    const analysis = {};
    storesToMerge.forEach(key => {
        analysis[key] = analyzeStoreMerge(key, window[key] || [], data[key] || []);
    });

    // Normalize nationalId (Persian/Arabic digits → English, strip invisible/whitespace
    // characters) on BOTH the local patients and the backup-only candidate patients BEFORE
    // duplicate-person detection runs. Without this, a nationalId that differs only in digit
    // script (or a stray invisible character picked up on another device) would fail the
    // strict string-equality check inside detectDuplicatePersons and create a fully duplicate
    // patient record during smart merge — exactly what this check is meant to prevent. This is
    // a safe, non-destructive normalization (same numeric value, standard format), identical to
    // the one already applied elsewhere (loadDataFromIndexedDB, end of applyMergeSession).
    (window.patients || []).forEach(p => {
        if (p && p.nationalId !== undefined && p.nationalId !== null) {
            p.nationalId = normalizeIdentifierValue(p.nationalId);
        }
    });
    (analysis.patients.toAdd || []).forEach(p => {
        if (p && p.nationalId !== undefined && p.nationalId !== null) {
            p.nationalId = normalizeIdentifierValue(p.nationalId);
        }
    });

    // Pull out likely-duplicate persons from the plain "toAdd" list for patients
    const dupPersons = detectDuplicatePersons(window.patients || [], analysis.patients.toAdd);
    const dupBackupIds = new Set(dupPersons.map(d => d.backup.id));
    analysis.patients.toAdd = analysis.patients.toAdd.filter(p => !dupBackupIds.has(p.id));

    const session = {
        fileName: pending.fileName,
        analysis,
        dupPersons,
        staffUnion: mergeStaffUnion(window.staff, data.staff),
        settingsDiffer: !!(data.settings && JSON.stringify(data.settings) !== JSON.stringify(window.settings)),
        resolutions: {},
        dupResolutions: {}
    };
    window.__mergeSession = session;

    if (countTotalConflicts(session) === 0) {
        applyMergeSession(session);
    } else {
        renderMergeReviewModal(session);
        openMergeReviewModal();
    }
}

// Applies a (fully resolved) merge session: writes additions/updates/resolved conflicts into
// the in-memory arrays, persists everything, logs the event, and refreshes the visible UI.
async function applyMergeSession(session) {
    if (!session) return;
    const totalNeeded = countTotalConflicts(session);
    const resolvedCount = Object.keys(session.resolutions).length + Object.keys(session.dupResolutions).length;
    if (resolvedCount < totalNeeded) {
        showToast("لطفاً پیش از اعمال ادغام، تکلیف تمامی موارد تعارض را مشخص کنید.", "warning");
        return;
    }

    const pending = window.__pendingBackupImport;
    const summary = { added: 0, updated: 0, keptLocal: 0, duplicatesAdded: 0 };
    const conflictLogEntries = [];
    const nowDate = (typeof getShamsiToday === 'function') ? getShamsiToday() : '';
    const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const resolvedByName = window.staff?.doctors?.[0] || 'سیستم';

    Object.keys(session.analysis).forEach(storeKey => {
        const a = session.analysis[storeKey];
        window[storeKey] = window[storeKey] || [];
        const localArr = window[storeKey];

        // 1) Plain additions (backup-only records, minus duplicate-person patients handled below)
        a.toAdd.forEach(rec => { localArr.unshift(rec); summary.added++; });

        // 2) Reliable auto-updates (backup is clearly newer)
        a.toAutoApplyBackup.forEach(({ id, record }) => {
            const idx = localArr.findIndex(r => r.id === id);
            if (idx > -1) { localArr[idx] = record; summary.updated++; }
            else { localArr.unshift(record); summary.added++; }
        });

        // 3) Manually resolved conflicts
        a.conflicts.forEach(c => {
            const choice = session.resolutions[`${storeKey}::${c.id}`] || 'local';
            const idx = localArr.findIndex(r => r.id === c.id);
            if (choice === 'backup') {
                if (idx > -1) localArr[idx] = { ...c.backup, _updatedAt: Date.now() };
                summary.updated++;
            } else if (choice === 'both') {
                const clone = { ...c.backup, id: crypto.randomUUID(), _updatedAt: Date.now(), _mergeDuplicateOf: c.id };
                localArr.unshift(clone);
                summary.duplicatesAdded++;
            } else {
                summary.keptLocal++;
            }
            conflictLogEntries.push({
                id: crypto.randomUUID(), storeKey, recordId: c.id, resolution: choice,
                date: nowDate, time: nowTime, localSnapshot: c.local, backupSnapshot: c.backup,
                resolvedBy: resolvedByName
            });
        });
    });

    // Duplicate-person patients
    session.dupPersons.forEach(d => {
        const choice = session.dupResolutions[d.backup.id] || 'ignore';
        if (choice === 'add') {
            window.patients.unshift({ ...d.backup, _updatedAt: Date.now() });
            summary.duplicatesAdded++;
        } else {
            summary.keptLocal++;
        }
        conflictLogEntries.push({
            id: crypto.randomUUID(), storeKey: 'patients', recordId: d.backup.id, resolution: 'duplicate-person:' + choice,
            date: nowDate, time: nowTime, localSnapshot: d.local, backupSnapshot: d.backup,
            resolvedBy: resolvedByName
        });
    });

    // Staff roster: safe union, never removes existing names
    window.staff = session.staffUnion;

    window.mergeConflictLog = (window.mergeConflictLog || []).concat(conflictLogEntries);

    // Normalize nationalId/phone on any patient records touched by the merge
    // (Persian digits → English, strip invisible/whitespace characters) — safe, non-destructive.
    (window.patients || []).forEach(p => {
        if (p.nationalId !== undefined && p.nationalId !== null) p.nationalId = normalizeIdentifierValue(p.nationalId);
        if (p.phone !== undefined && p.phone !== null) p.phone = normalizeIdentifierValue(p.phone);
    });

    await syncDatabase();

    // Log this merge event in the existing backup/restore history log
    if (typeof logBackupEvent === 'function') {
        logBackupEvent('merge', (pending && pending.fileName) || session.fileName || 'بکاپ');
    }

    closeMergeReviewModal();
    window.__pendingBackupImport = null;
    window.__mergeSession = null;

    if (typeof applySettings === 'function') applySettings();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (document.getElementById('tab-patients-list') && !document.getElementById('tab-patients-list').classList.contains('hidden') && typeof renderPatientsList === 'function') {
        renderPatientsList();
    }
    if (document.getElementById('settings-sub-tab-data') && !document.getElementById('settings-sub-tab-data').classList.contains('hidden')) {
        renderBackupHistoryList();
    }

    showMergeSummary(summary, session.settingsDiffer);
}

function showMergeSummary(summary, settingsDiffer) {
    const parts = [];
    if (summary.added) parts.push(`${toPersianDigits(summary.added)} رکورد جدید اضافه شد`);
    if (summary.updated) parts.push(`${toPersianDigits(summary.updated)} رکورد به نسخه جدیدتر به‌روزرسانی شد`);
    if (summary.keptLocal) parts.push(`${toPersianDigits(summary.keptLocal)} مورد با انتخاب شما، نسخه محلی حفظ شد`);
    if (summary.duplicatesAdded) parts.push(`${toPersianDigits(summary.duplicatesAdded)} رکورد به‌صورت نسخه جداگانه نگه‌داشته شد`);
    let msg = parts.length ? ('ادغام هوشمند با موفقیت انجام شد: ' + parts.join('، ') + '.') : 'ادغام هوشمند انجام شد؛ تفاوتی بین دو مجموعه داده یافت نشد.';
    if (settingsDiffer) msg += ' توجه: تنظیمات نمایشی سامانه در فایل بکاپ متفاوت بود و برای احتیاط تغییر داده نشد؛ در صورت نیاز آن را از بخش تنظیمات به‌روزرسانی کنید.';
    showCustomAlert("نتیجه ادغام هوشمند بکاپ", msg);
}

