// نسیم رهایی — مدیریت اپیوم
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// =====================================================================================
// END SMART BACKUP MERGE
// =====================================================================================

// =====================================================================================
// مدیریت اپیوم (Opium Management)
// -------------------------------------------------------------------------------------
// دو مفهوم، هر کدام در یک Store مستقل IndexedDB:
//   opiumMembers    : عضویت بیمار در فهرست مدیریت اپیوم (حذف = غیرفعال‌سازی، نه پاک کردن)
//   opiumDeliveries : رویداد واقعی تحویل — تنها منبع محاسبه‌ی «مصرف واقعی»
//   opiumPeriods    : دوره‌های توزیع؛ هر رکورد فقط {id, no, startDate} دارد. پایان هر دوره «روز قبل از شروع دوره‌ی بعد»
//                     است و ذخیره نمی‌شود، پس هیچ تحویلی هرگز جابه‌جا یا بازنویسی نمی‌شود (تعلق تحویل = تاریخ واقعی تحویل).
//   (Store قدیمی opiumPlans از نسخه‌ی ۷۰ فقط برای سازگاری با بکاپ‌های قبلی نگه داشته شده و دیگر استفاده نمی‌شود.)
// هویت بیمار همیشه از پرونده‌ی اصلی (window.patients) خوانده می‌شود و کپی نمی‌شود.
// =====================================================================================
const OPIUM_SYRUP_CC = 250;
const OPIUM_PRIORITIES = ['A1', 'A2', 'B1', 'B2', 'B3'];
const OPIUM_NO_PRIORITY = 'بدون اولویت';
const OPIUM_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const OPIUM_DELIVERY_VOID = 'ابطال‌شده';

const opiumUI = {
    cardFilter: null,                     // { kind, value } — فیلتر فعال از روی کلیک روی کارت
    reportSort: [],                       // مرتب‌سازی چندستونه‌ی گزارش: [{ key, dir:'asc'|'desc' }, ...] به ترتیب اولویت (خالی = ترتیب پیش‌فرض)
    periodSel: null,                      // null = دوره‌ی جاری | '__all__' = همه سوابق | شناسه‌ی دوره (بازه‌ی بسته‌ی انتخابی)
    delPatientId: null,                   // بیمار باز در پاپ‌آپ تحویل
    editingId: null,                      // شناسه‌ی تحویلی که در حال ویرایش است (null = ثبت تحویل جدید)
    busy: false,                          // جلوگیری از ثبت دوباره با کلیک‌های پشت‌سرهم
    addSelected: new Set(),
    subTab: 'list'                        // 'list' = فهرست بیماران (پیش‌فرض) | 'report' = گزارش تفصیلی مصرف
};

// ---------- Date / number helpers (all on top of the system's existing Jalali utilities) ----------
function opNormDate(s) {
    s = toEnglishDigits(String(s == null ? '' : s)).trim().replace(/[-.]/g, '/');
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return '';
    return `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
}
// A date is valid only if it survives a Jalali → Gregorian → Jalali round trip.
function opIsValidDate(s) {
    const n = opNormDate(s);
    if (!n) return false;
    const [y, m, d] = n.split('/').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const [gy, gm, gd] = jalaliToGregorian(y, m, d);
    const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
    return jy === y && jm === m && jd === d;
}
// Weekday is computed from the real calendar date, never typed or guessed.
function opWeekday(s) {
    const n = opNormDate(s);
    if (!n || !opIsValidDate(n)) return '';
    const [y, m, d] = n.split('/').map(Number);
    const [gy, gm, gd] = jalaliToGregorian(y, m, d);
    const dow = new Date(gy, gm - 1, gd).getDay(); // 0 = Sunday
    return OPIUM_WEEKDAYS[(dow + 1) % 7];          // Saturday(6) → index 0 = شنبه
}
function opToday() { return opNormDate(getShamsiToday()); }
function opRound(n, dec) { const f = Math.pow(10, dec); return Math.round((Number(n) || 0) * f) / f; }
function opSum(arr) { return opRound(arr.reduce((a, b) => a + (Number(b) || 0), 0), 3); }
function opFmt(n, dec = 2) {
    const r = opRound(n, dec);
    if (!isFinite(r)) return '—';
    return toPersianDigits(r.toLocaleString('en-US', { maximumFractionDigits: dec })).replace(/,/g, '٬').replace(/\./g, '٫');
}
function opFmtDate(s) { return s ? toPersianDigits(opNormDate(s) || s) : '—'; }
function opSyrup(vol) { return (Number(vol) || 0) / OPIUM_SYRUP_CC; }   // never rounded in calculations
function opWho() { return (window.staff && window.staff.doctors && window.staff.doctors[0]) || 'سیستم'; }


// ---------- Data access ----------
function opPatient(id) { return (window.patients || []).find(p => p.id === id); }
function opPatientName(p) { return p ? (p.fullName || ((p.name || '') + ' ' + (p.lastname || '')).trim() || '-') : 'پرونده یافت نشد'; }
function opMemberByPatient(pid) { return (window.opiumMembers || []).find(m => m.patientId === pid); }
function opActiveMembers() { return (window.opiumMembers || []).filter(m => m.active); }
function opRealDeliveries() { return (window.opiumDeliveries || []).filter(d => d.status !== OPIUM_DELIVERY_VOID); }
function opDeliveriesOf(pid, includeVoid) {
    return (window.opiumDeliveries || []).filter(d => d.patientId === pid && (includeVoid || d.status !== OPIUM_DELIVERY_VOID));
}
function opSortDeliveriesDesc(list) {
    return list.slice().sort((a, b) => opNormDate(b.date).localeCompare(opNormDate(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
}
// «آخرین تحویل» = جدیدترین تحویل معتبر (ابطال‌شده‌ها حساب نمی‌شوند)
// «شیفت مراجعه»: روز ثابت مراجعه هفتگی بیمار (شنبه تا پنجشنبه) — کاملاً مستقل از «روز هفته مراجعه بعدی» که از تاریخ تحویل محاسبه می‌شود
const OPIUM_SHIFT_DAYS = OPIUM_WEEKDAYS.slice(0, 6);
function opVisitShift(pid) { const m = opMemberByPatient(pid); return (m && OPIUM_SHIFT_DAYS.includes(m.visitShift)) ? m.visitShift : ''; }
function opSetVisitShift(value) {
    const pid = opiumUI.delPatientId;
    const m = pid ? opMemberByPatient(pid) : null;
    if (!m) return;
    if (value && !OPIUM_SHIFT_DAYS.includes(value)) return;
    m.visitShift = value || '';
    opPersist('opiumMembers', m);
    triggerBackupReminder();
    showToast('شیفت مراجعه بیمار ذخیره شد.');
    renderOpiumTable();
    renderOpiumReport();
}
function opLastDelivery(pid) { return opSortDeliveriesDesc(opDeliveriesOf(pid, false))[0] || null; }
function opPersist(store, rec) { dbPutRecord(store, rec); }

// ---------- Two-way priority sync between the main patient record (currentPriority)
// and the Opium Management member list (opiumMembers[].priority) — both must always
// read from a single source of truth, so whichever side changes first writes through
// to the other, and the value survives a reload either way. ----------
// Called whenever the PATIENT RECORD's currentPriority changes (quick-edit, visit modal, ...):
// mirrors it onto this patient's opium-list membership, if any, without creating one.
function opSyncMemberPriorityFromPatient(pid, priority) {
    const m = opMemberByPatient(pid);
    if (!m) return;
    const normalized = (priority && OPIUM_PRIORITIES.includes(priority)) ? priority : '';
    if (m.priority === normalized) return;
    m.priority = normalized;
    opPersist('opiumMembers', m);
}
// Called whenever the OPIUM TABLE's priority <select> changes: mirrors it onto the
// patient's own currentPriority field so the main record and every view derived from
// it (patient detail card, dashboards, exports, ...) stay consistent.
function opSyncPatientPriorityFromMember(pid, priority) {
    const p = opPatient(pid);
    if (!p) return;
    const normalized = priority || '';
    if ((p.currentPriority || '') === normalized) return;
    if ((p.currentPriority || '') !== normalized) logChange(p.id, "اولویت اپیوم", p.currentPriority || "-", normalized || "-");
    p.currentPriority = normalized;
    dbPutRecord('patients', p);
    // Keep other already-rendered views of this patient in sync immediately.
    if (typeof renderPatientsList === 'function') { try { renderPatientsList(); } catch (e) {} }
    if (typeof renderDashboard === 'function') { try { renderDashboard(); } catch (e) {} }
}

// حجم کل = دوز روزانه × تعداد روز ؛ مراجعه بعدی = تاریخ تحویل + تعداد روز
// (روز تحویل اولین روز مصرف است؛ دقیقاً همان قاعده‌ی منوی «ارائه دارو»: addDaysToJalali(date, days)).
function opComputeDelivery(dose, date, days) {
    const next = opNormDate(addDaysToJalali(opNormDate(date), days));
    return { volume: opRound(dose * days, 3), next, weekday: opWeekday(next) };
}

// ---------- Status helpers ----------
function opMemberFlags(m) {
    const last = opLastDelivery(m.patientId);
    return {
        last,
        hasDelivery: !!last,
        followup: !!last && opNormDate(last.nextVisitDate) < opToday(),
        weekday: last ? opWeekday(last.nextVisitDate) : ''
    };
}
function opStatusBadge(f) {
    if (!f.last) return `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">بدون تحویل</span>`;
    return f.followup
        ? `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">مراجعه معوق</span>`
        : `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">تحویل‌شده</span>`;
}

// ---------- Distribution periods (دوره‌های توزیع) ----------
// Buckets = [«پیش از اولین دوره»] + هر دوره. بازه‌ی هر bucket: از startDate تا روز قبل از startDate دوره‌ی بعد
// (آخرین دوره بازه‌ی باز دارد). تحویل‌ها هیچ‌وقت به دوره «اختصاص داده» نمی‌شوند؛ فقط بر اساس تاریخ واقعی خودشان
// در بازه‌ها قرار می‌گیرند، پس تغییر دوره‌ها سوابق را دست‌کاری نمی‌کند.
function opPeriodsSorted() {
    return (window.opiumPeriods || []).filter(p => opNormDate(p.startDate))
        .slice().sort((a, b) => opNormDate(a.startDate).localeCompare(opNormDate(b.startDate)));
}
function opDayBefore(date) { return opNormDate(addDaysToJalali(opNormDate(date), -1)); }
function opBuckets() {
    const ps = opPeriodsSorted();
    if (!ps.length) return [];
    const today = opToday();
    const out = [{ id: '__before__', no: 0, label: 'پیش از اولین دوره', from: '', to: opDayBefore(ps[0].startDate), period: null }];
    ps.forEach((p, i) => {
        const next = ps[i + 1];
        out.push({ id: p.id, no: p.no, label: 'دوره ' + toPersianDigits(p.no), from: opNormDate(p.startDate), to: next ? opDayBefore(next.startDate) : '', period: p });
    });
    out.forEach(b => { b.isCurrent = (!b.from || b.from <= today) && (!b.to || today <= b.to); });
    return out;
}
function opCurrentBucket() { return opBuckets().find(b => b.isCurrent) || null; }
// دوره‌ی مبنای آمار: انتخاب کاربر، و در نبود انتخاب «دوره‌ی جاری». null = بدون محدودیت دوره (همه سوابق).
function opSelectedBucket() {
    const buckets = opBuckets();
    if (!buckets.length) return null;
    const sel = opiumUI.periodSel;
    if (sel === '__all__') return null;
    if (sel) { const b = buckets.find(x => x.id === sel); if (b) return b; }
    return opCurrentBucket();
}
function opBucketTitle(b) {
    const from = b.from ? 'از ' + toPersianDigits(b.from) : 'از ابتدای سوابق';
    const to = b.to ? 'تا ' + toPersianDigits(b.to) : 'تا امروز (ادامه دارد)';
    return `${b.label}${b.isCurrent ? ' (جاری)' : ''} — ${from} ${to}`;
}
function opBucketStats(b) {
    const r = { from: b.from, to: b.to, error: '' };
    const dels = opRealDeliveries().filter(d => opInRange(d.date, r));
    const volume = opSum(dels.map(d => d.volume));
    return { count: dels.length, volume, syrup: opSyrup(volume) };
}

// ---------- Date range (stats + report) ----------
// اولویت مبنای بازه: ۱) فیلتر دستی (اگر هر کدام از تاریخ شروع/پایان پر باشد) ۲) دوره‌ی انتخابی/جاری ۳) همه سوابق
function opRange() {
    const rawFrom = (document.getElementById('opium-range-from') || {}).value || '';
    const rawTo = (document.getElementById('opium-range-to') || {}).value || '';
    const from = opNormDate(rawFrom), to = opNormDate(rawTo);
    let error = '';
    if ((rawFrom.trim() && !opIsValidDate(rawFrom)) || (rawTo.trim() && !opIsValidDate(rawTo))) error = 'تاریخ واردشده معتبر نیست.';
    else if (from && to && from > to) error = 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.';
    if (rawFrom.trim() || rawTo.trim()) return { from, to, error, source: 'manual', bucket: null };
    const b = opSelectedBucket();
    if (b) return { from: b.from, to: b.to, error: '', source: 'period', bucket: b };
    return { from: '', to: '', error: '', source: 'all', bucket: null };
}
function opInRange(date, r) {
    if (r.error) return false;
    const d = opNormDate(date);
    if (!d) return false;
    if (r.from && d < r.from) return false;
    if (r.to && d > r.to) return false;
    return true;
}
function opRangeText(r) {
    if (r.error) return r.error;
    if (r.source === 'period') return 'مبنای دوره — ' + opBucketTitle(r.bucket);
    if (!r.from && !r.to) return 'بازه: همه سوابق';
    return `بازه‌ی دستی: ${r.from ? 'از ' + toPersianDigits(r.from) : ''} ${r.to ? 'تا ' + toPersianDigits(r.to) : ''}`.trim();
}
// توضیح شفاف در رابط کاربری: آمار اکنون بر چه مبنایی محاسبه می‌شود
function opRenderPeriodUI(range) {
    const buckets = opBuckets();
    const wrap = document.getElementById('opium-period-select-wrap');
    const sel = document.getElementById('opium-period-select');
    if (wrap && sel) {
        wrap.classList.toggle('hidden', !buckets.length);
        if (buckets.length) {
            const eff = opSelectedBucket();
            const allSel = opiumUI.periodSel === '__all__';
            sel.innerHTML = buckets.slice().reverse().map(b =>
                `<option value="${b.id}" ${(!allSel && eff && eff.id === b.id) ? 'selected' : ''}>${escapeHTML(opBucketTitle(b))}</option>`
            ).join('') + `<option value="__all__" ${allSel ? 'selected' : ''}>همه سوابق (بدون محدودیت دوره)</option>`;
        }
    }
    const pill = document.getElementById('opium-period-current');
    if (pill) {
        const cur = opCurrentBucket();
        pill.textContent = !buckets.length ? 'دوره‌ای تعریف نشده'
            : 'دوره‌ی جاری: ' + (cur ? cur.label + (cur.from ? ' — از ' + toPersianDigits(cur.from) : '') : '—');
    }
    const note = document.getElementById('opium-basis-note');
    if (note && range) {
        let txt = '', cls = 'text-slate-600';
        if (range.source === 'period') txt = `آمار و گزارش به‌صورت پیش‌فرض بر اساس «${opBucketTitle(range.bucket)}» محاسبه شده‌اند. با وارد کردن تاریخ شروع/پایان دستی، بازه‌ی دستی جایگزین دوره می‌شود.`;
        else if (range.source === 'manual' && buckets.length && !range.error) { txt = 'بازه‌ی دستی فعال است و جایگزین مبنای دوره شده؛ برای بازگشت به دوره، «پاک کردن بازه‌ی دستی» را بزنید.'; cls = 'text-amber-700'; }
        else if (range.source === 'all' && buckets.length) txt = 'محدودیت دوره غیرفعال است؛ آمار از کل سوابق محاسبه شده است.';
        else if (range.source === 'all') txt = 'هنوز دوره‌ی توزیعی تعریف نشده است؛ آمار از کل سوابق محاسبه می‌شود. با «شروع دوره‌ی جدید» می‌توانید آمار را به دوره‌ی واقعی توزیع محدود کنید.';
        note.className = 'text-[11px] font-bold mt-2 ' + cls;
        note.textContent = txt;
    }
}
function opOnPeriodChange() {
    const v = document.getElementById('opium-period-select').value;
    const cur = opCurrentBucket();
    opiumUI.periodSel = (cur && v === cur.id) ? null : v;
    // انتخاب صریح دوره، بازه‌ی دستی قبلی را کنار می‌گذارد تا مبنای آمار گیج‌کننده نباشد
    document.getElementById('opium-range-from').value = '';
    document.getElementById('opium-range-to').value = '';
    opOnRangeChange();
}

// ---------- Period CRUD ----------
function opAddPeriod() {
    const inp = document.getElementById('opium-period-start');
    const date = opNormDate(inp.value);
    if (!date || !opIsValidDate(date)) { showToast('تاریخ شروع دوره معتبر نیست.', 'error'); return; }
    const sorted = opPeriodsSorted();
    const last = sorted.length ? opNormDate(sorted[sorted.length - 1].startDate) : '';
    if (last && date <= last) {
        showToast(`تاریخ شروع دوره‌ی جدید باید بعد از شروع آخرین دوره (${toPersianDigits(last)}) باشد. برای اصلاح اشتباه، ابتدا آخرین دوره را از «دوره‌ها» حذف کنید.`, 'warning');
        return;
    }
    const future = date > opToday();
    showCustomConfirm('شروع دوره‌ی جدید توزیع',
        `دوره‌ی جدید از ${toPersianDigits(date)} (${opWeekday(date)}) شروع شود؟\n` +
        (future ? 'این تاریخ در آینده است؛ تا رسیدن به آن، دوره‌ی قبلی «جاری» می‌ماند.\n' : 'آمار پیش‌فرض از این تاریخ به بعد محاسبه می‌شود.\n') +
        'تحویل‌های قبل از این تاریخ به دوره‌های قبلی تعلق دارند و هیچ سابقه‌ای حذف، تکرار یا جابه‌جا نمی‌شود.',
        () => {
            const periods = (window.opiumPeriods = window.opiumPeriods || []);
            const no = periods.reduce((mx, p) => Math.max(mx, Number(p.no) || 0), 0) + 1;
            const rec = { id: crypto.randomUUID(), no, startDate: date, createdAt: Date.now(), createdBy: opWho() };
            periods.push(rec);
            opPersist('opiumPeriods', rec);
            triggerBackupReminder();
            inp.value = '';
            opiumUI.periodSel = null;
            document.getElementById('opium-range-from').value = '';
            document.getElementById('opium-range-to').value = '';
            showToast(`دوره‌ی ${toPersianDigits(no)} از ${toPersianDigits(date)} شروع شد.`);
            renderOpiumPage();
            if (!document.getElementById('opium-periods-modal').classList.contains('hidden')) renderOpiumPeriodsModal();
        });
}
function opDeletePeriod(id) {
    const sorted = opPeriodsSorted();
    const last = sorted[sorted.length - 1];
    if (!last || last.id !== id) { showToast('فقط آخرین دوره قابل حذف است.', 'warning'); return; }
    showCustomConfirm('حذف آخرین دوره',
        `دوره‌ی ${toPersianDigits(last.no)} (شروع ${toPersianDigits(opNormDate(last.startDate))}) حذف شود؟\nهیچ تحویلی حذف نمی‌شود؛ فقط مرز دوره‌ها تغییر می‌کند و تحویل‌های این دوره به دوره‌ی قبل ملحق می‌شوند.`,
        () => {
            window.opiumPeriods = (window.opiumPeriods || []).filter(p => p.id !== id);
            dbDeleteRecord('opiumPeriods', id);
            triggerBackupReminder();
            if (opiumUI.periodSel === id) opiumUI.periodSel = null;
            showToast('آخرین دوره حذف شد (تحویل‌ها دست‌نخورده ماندند).');
            renderOpiumPage();
            renderOpiumPeriodsModal();
        });
}
function opViewPeriod(id) {
    const cur = opCurrentBucket();
    opiumUI.periodSel = (cur && cur.id === id) ? null : id;
    document.getElementById('opium-range-from').value = '';
    document.getElementById('opium-range-to').value = '';
    closeOpiumPeriodsModal();
    renderOpiumPage();
    switchOpiumSubTab('report');
    document.getElementById('opium-report-card').scrollIntoView({ behavior: 'smooth' });
}
function openOpiumPeriodsModal() {
    renderOpiumPeriodsModal();
    document.getElementById('opium-periods-modal').classList.remove('hidden');
    lockBackgroundScroll();
}
function closeOpiumPeriodsModal() {
    document.getElementById('opium-periods-modal').classList.add('hidden');
    unlockBackgroundScroll();
}
function renderOpiumPeriodsModal() {
    const body = document.getElementById('opium-periods-body');
    if (!body) return;
    const buckets = opBuckets();
    if (!buckets.length) {
        body.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400 font-bold">هنوز دوره‌ی توزیعی ثبت نشده است. تاریخ شروع را در بالای صفحه وارد و «شروع دوره‌ی جدید» را بزنید؛ تا آن زمان آمار از کل سوابق محاسبه می‌شود.</td></tr>';
        return;
    }
    const lastPeriod = opPeriodsSorted().slice(-1)[0];
    body.innerHTML = buckets.slice().reverse().map(b => {
        const st = opBucketStats(b);
        const canDelete = b.period && lastPeriod && lastPeriod.id === b.id;
        return `<tr class="${b.isCurrent ? 'bg-teal-50/60' : ''}">
            <td class="p-2.5 font-bold">${escapeHTML(b.label)}${b.isCurrent ? ' <span class="text-[10px] font-extrabold text-teal-700">(جاری)</span>' : ''}</td>
            <td class="p-2.5 font-yekan">${b.from ? toPersianDigits(b.from) : 'ابتدای سوابق'}</td>
            <td class="p-2.5 font-yekan">${b.to ? toPersianDigits(b.to) : 'ادامه دارد'}</td>
            <td class="p-2.5 text-center font-yekan font-bold">${toPersianDigits(st.count)}</td>
            <td class="p-2.5 text-center font-yekan font-bold">${opFmt(st.volume, 2)}</td>
            <td class="p-2.5 text-center font-yekan font-bold">${opFmt(st.syrup, 3)}</td>
            <td class="p-2.5"><div class="flex items-center justify-center gap-1.5">
                <button onclick="opViewPeriod('${b.id}')" class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[10px] font-bold">مشاهده گزارش</button>
                ${canDelete ? `<button onclick="opDeletePeriod('${b.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold">حذف</button>` : ''}
            </div></td></tr>`;
    }).join('');
}

function opOnRangeChange() { renderOpiumStats(); renderOpiumTable(); renderOpiumReport(); }
function opClearRange() {
    document.getElementById('opium-range-from').value = '';
    document.getElementById('opium-range-to').value = '';
    opOnRangeChange();
}
function opSetRangeThisMonth() {
    const t = opToday(); const [y, m] = t.split('/').map(Number);
    const first = `${y}/${String(m).padStart(2, '0')}/01`;
    const nextMonthFirst = m === 12 ? `${y + 1}/01/01` : `${y}/${String(m + 1).padStart(2, '0')}/01`;
    const last = opNormDate(addDaysToJalali(nextMonthFirst, -1));
    document.getElementById('opium-range-from').value = first;
    document.getElementById('opium-range-to').value = last;
    opOnRangeChange();
}


// ---------- Statistics ----------
function opComputeStats() {
    const r = opRange();
    const members = opActiveMembers();
    const dels = opRealDeliveries().filter(d => opInRange(d.date, r));   // فقط تحویل‌های معتبر و واقعی
    const totalVol = opSum(dels.map(d => d.volume));

    const weekdayCounts = {}; OPIUM_WEEKDAYS.forEach(w => weekdayCounts[w] = 0);
    const prioCounts = {};
    let followup = 0;
    members.forEach(m => {
        const f = opMemberFlags(m);
        const key = m.priority || OPIUM_NO_PRIORITY;
        prioCounts[key] = (prioCounts[key] || 0) + 1;
        if (f.weekday) weekdayCounts[f.weekday]++;
        if (f.followup) followup++;
    });

    return {
        range: r,
        membersCount: members.length,
        deliveredPatients: new Set(dels.map(d => d.patientId)).size,
        deliveriesCount: dels.length,
        totalVol,
        syrup: opSyrup(totalVol),
        fullSyrups: Math.floor(opSyrup(totalVol) + 1e-9),
        weekdayCounts, prioCounts, followup,
        deliveredPatientIds: new Set(dels.map(d => d.patientId))
    };
}

function opStatCard(label, value, sub, icon, color, filter) {
    const active = opiumUI.cardFilter && filter && opiumUI.cardFilter.kind === filter.kind && opiumUI.cardFilter.value === filter.value;
    const click = filter ? `onclick="opSetCardFilter('${filter.kind}', '${filter.value || ''}')"` : '';
    return `<div ${click} class="bg-white p-2.5 rounded-xl shadow-sm border ${active ? 'border-teal-brand ring-2 ring-teal-brand/30' : 'border-gray-100'} ${filter ? 'cursor-pointer hover:border-teal-300 transition' : ''}">
        <div class="flex items-center justify-between gap-2">
            <p class="text-[10px] font-bold text-slate-500 leading-tight">${label}</p>
            <span class="w-5 h-5 shrink-0 rounded-md bg-${color}-100 text-${color}-600 flex items-center justify-center text-[10px]"><i class="fa-solid ${icon}"></i></span>
        </div>
        <div class="flex items-baseline gap-1.5 mt-1">
            <p class="text-base font-black text-slate-800 font-yekan">${value}</p>
            <p class="text-[10px] font-bold text-slate-400 truncate">${sub || ''}</p>
        </div>
    </div>`;
}

function renderOpiumStats() {
    const box = document.getElementById('opium-stats');
    if (!box) return;
    const s = opComputeStats();
    const lbl = document.getElementById('opium-range-label');
    if (lbl) { lbl.textContent = opRangeText(s.range); lbl.className = 'text-[11px] font-bold pb-2 ' + (s.range.error ? 'text-rose-600' : 'text-slate-500'); }
    const rl = document.getElementById('opium-report-range-label');
    if (rl) rl.textContent = '— ' + opRangeText(s.range);
    opRenderPeriodUI(s.range);

    box.innerHTML =
        opStatCard('بیماران فهرست مدیریت اپیوم', toPersianDigits(s.membersCount), 'همه اعضای فعال', 'fa-users', 'teal', { kind: 'all', value: '' }) +
        opStatCard('بیماران دارای تحویل واقعی در بازه', toPersianDigits(s.deliveredPatients), `${toPersianDigits(s.deliveriesCount)} تحویل`, 'fa-hand-holding-medical', 'emerald', { kind: 'delivered', value: '' }) +
        opStatCard('مجموع حجم واقعی تحویل‌شده', opFmt(s.totalVol, 2) + ' <span class="text-[10px] font-bold">سی‌سی</span>', 'فقط تحویل‌های معتبر', 'fa-droplet', 'sky', null) +
        opStatCard('معادل شربت (هر شربت ۲۵۰ سی‌سی)', opFmt(s.syrup, 3), `شربت کامل: ${opFmt(s.fullSyrups, 0)}`, 'fa-bottle-droplet', 'indigo', null) +
        opStatCard('مراجعه معوق', toPersianDigits(s.followup), 'تاریخ مراجعه بعدی گذشته', 'fa-clock', 'orange', { kind: 'followup', value: '' });

    const wk = document.getElementById('opium-weekday-strip');
    if (wk) wk.innerHTML = OPIUM_WEEKDAYS.map(w => {
        const active = opiumUI.cardFilter && opiumUI.cardFilter.kind === 'weekday' && opiumUI.cardFilter.value === w;
        return `<button onclick="opSetCardFilter('weekday', '${w}')" class="rounded-xl border ${active ? 'border-teal-brand bg-teal-50 ring-2 ring-teal-brand/30' : 'border-slate-200 hover:border-teal-300'} px-1 text-center transition flex flex-col items-center justify-center gap-0.5 min-h-[48px]">
            <span class="block text-[10px] font-bold text-slate-500 leading-tight">${w}</span>
            <span class="block text-base font-black text-slate-800 font-yekan">${toPersianDigits(s.weekdayCounts[w])}</span></button>`;
    }).join('');

    const pr = document.getElementById('opium-priority-strip');
    if (pr) {
        const keys = OPIUM_PRIORITIES.concat([OPIUM_NO_PRIORITY]);
        pr.innerHTML = keys.map(k => {
            const active = opiumUI.cardFilter && opiumUI.cardFilter.kind === 'priority' && opiumUI.cardFilter.value === k;
            return `<button onclick="opSetCardFilter('priority', '${k}')" class="rounded-xl border ${active ? 'border-teal-brand bg-teal-50 ring-2 ring-teal-brand/30' : 'border-slate-200 hover:border-teal-300'} px-1 text-center transition flex flex-col items-center justify-center gap-0.5 min-h-[48px]">
                <span class="block text-[10px] font-bold text-slate-500 leading-tight">${k}</span>
                <span class="block text-base font-black text-slate-800 font-yekan">${toPersianDigits(s.prioCounts[k] || 0)}</span></button>`;
        }).join('');
    }
}

function opSetCardFilter(kind, value) {
    const cur = opiumUI.cardFilter;
    if (kind === 'all' || (cur && cur.kind === kind && cur.value === value)) opiumUI.cardFilter = null;
    else opiumUI.cardFilter = { kind, value };
    renderOpiumStats();
    renderOpiumTable();
}

// ---------- Members table ----------
function opFillFilterSelects() {
    const fill = (id, html) => { const el = document.getElementById(id); if (el && !el.options.length) el.innerHTML = html; };
    const prioHtml = '<option value="">همه اولویت‌ها</option>' + OPIUM_PRIORITIES.map(p => `<option value="${p}">${p}</option>`).join('') + `<option value="${OPIUM_NO_PRIORITY}">${OPIUM_NO_PRIORITY}</option>`;
    const wkHtml = '<option value="">همه روزها</option>' + OPIUM_WEEKDAYS.map(w => `<option value="${w}">${w}</option>`).join('');
    fill('opium-filter-priority', prioHtml); fill('opium-report-priority', prioHtml);
    fill('opium-filter-weekday', wkHtml); fill('opium-report-weekday', wkHtml);
}

function opMatchesCardFilter(m, f, deliveredIds) {
    const cf = opiumUI.cardFilter;
    if (!cf) return true;
    if (cf.kind === 'delivered') return deliveredIds.has(m.patientId);
    if (cf.kind === 'weekday') return f.weekday === cf.value;
    if (cf.kind === 'priority') return (m.priority || OPIUM_NO_PRIORITY) === cf.value;
    if (cf.kind === 'followup') return f.followup;
    return true;
}
function opCardFilterText(cf) {
    if (cf.kind === 'weekday') return 'مراجعه بعدی: ' + cf.value;
    if (cf.kind === 'priority') return 'اولویت: ' + cf.value;
    if (cf.kind === 'delivered') return 'دارای تحویل واقعی در بازه';
    if (cf.kind === 'followup') return 'مراجعه معوق';
    return '';
}

function renderOpiumTable() {
    const tbody = document.getElementById('opium-table-body');
    if (!tbody) return;
    opFillFilterSelects();
    const q = toEnglishDigits((document.getElementById('opium-search').value || '')).trim().toLowerCase();
    const fPrio = document.getElementById('opium-filter-priority').value;
    const fWk = document.getElementById('opium-filter-weekday').value;
    const fStatus = document.getElementById('opium-filter-status').value;
    const showRemoved = document.getElementById('opium-show-removed').checked;
    const deliveredIds = opComputeStats().deliveredPatientIds;

    const chip = document.getElementById('opium-card-filter-chip');
    if (chip) {
        if (opiumUI.cardFilter) {
            chip.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-[11px] font-bold text-teal-800';
            chip.innerHTML = `فیلتر کارت: ${escapeHTML(opCardFilterText(opiumUI.cardFilter))} <button onclick="opSetCardFilter('all','')" class="text-teal-600 hover:text-rose-600"><i class="fa-solid fa-xmark"></i></button>`;
        } else { chip.className = 'hidden'; chip.innerHTML = ''; }
    }

    let rows = (window.opiumMembers || []).filter(m => m.active || showRemoved).map(m => ({ m, p: opPatient(m.patientId), f: opMemberFlags(m) }));
    rows = rows.filter(({ m, p, f }) => {
        if (q) {
            const hay = [opPatientName(p), p ? p.code : '', p ? p.nationalId : ''].join(' ').toLowerCase();
            if (!toEnglishDigits(hay).includes(q)) return false;
        }
        if (fPrio && (m.priority || OPIUM_NO_PRIORITY) !== fPrio) return false;
        if (fWk && f.weekday !== fWk) return false;
        if (fStatus === 'none' && f.hasDelivery) return false;
        if (fStatus === 'delivered' && !f.hasDelivery) return false;
        if (fStatus === 'followup' && !f.followup) return false;
        if (m.active && !opMatchesCardFilter(m, f, deliveredIds)) return false;
        if (!m.active && opiumUI.cardFilter) return false;
        return true;
    });
    rows.sort((a, b) => (a.p ? a.p.code : 1e9) - (b.p ? b.p.code : 1e9));

    const countEl = document.getElementById('opium-table-count');
    if (countEl) countEl.textContent = `(${toPersianDigits(rows.length)} نفر)`;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="p-8 text-center text-slate-400 font-bold">${(window.opiumMembers || []).length ? 'موردی با این فیلترها یافت نشد.' : 'هنوز بیماری به فهرست مدیریت اپیوم اضافه نشده است. از دکمه‌ی «افزودن بیمار» شروع کنید.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(({ m, p, f }, i) => {
        const last = f.last;
        const prioSel = `<select onchange="opSetPriority('${m.patientId}', this.value)" ${m.active ? '' : 'disabled'} class="px-2 py-1 border border-gray-300 rounded-lg text-[11px] font-bold bg-white outline-none focus:border-teal-brand">
            <option value="">—</option>${OPIUM_PRIORITIES.map(x => `<option value="${x}" ${m.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
        const actions = m.active
            ? `<div class="flex items-center justify-center gap-1 whitespace-nowrap">
                    <button onclick="openOpiumDeliveryModal('${m.patientId}')" title="مدیریت تحویل" class="px-2 py-0.5 bg-teal-brand hover:bg-teal-700 text-white rounded-md text-[10px] font-bold transition">مدیریت</button>
                    <button onclick="removeOpiumMember('${m.patientId}')" title="حذف از فهرست (سوابق حفظ می‌شود)" class="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition"><i class="fa-solid fa-user-minus text-[10px]"></i></button>
               </div>`
            : `<button onclick="restoreOpiumMember('${m.patientId}')" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold transition whitespace-nowrap">افزودن مجدد</button>`;
        return `<tr class="${m.active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'} transition">
            <td class="p-2 font-yekan">${toPersianDigits(i + 1)}</td>
            <td class="p-2 font-bold ${m.active ? 'text-slate-800' : ''}">${escapeHTML(opPatientName(p))}${m.active ? '' : ' <span class="text-[10px] font-bold text-rose-500">(حذف‌شده)</span>'}</td>
            <td class="p-2 font-yekan">${p && p.nationalId ? toPersianDigits(p.nationalId) : '—'}</td>
            <td class="p-2 font-yekan font-bold">${p ? toPersianDigits(p.code) : '—'}</td>
            <td class="p-2 font-yekan">${p ? opFmtDate(p.admissionDate) : '—'}</td>
            <td class="p-2 text-center">${prioSel}</td>
            <td class="p-2 text-center font-yekan font-bold">${last ? opFmt(last.dailyDose, 2) : '—'}</td>
            <td class="p-2 font-yekan">${last ? opFmtDate(last.date) : '—'}<div class="mt-1">${m.active ? opStatusBadge(f) : ''}</div></td>
            <td class="p-2 text-center font-yekan font-bold">${last ? opFmt(last.volume, 2) : '—'}</td>
            <td class="p-2 font-yekan">${last ? opFmtDate(last.nextVisitDate) : '—'}${m.active && f.followup ? '<div class="mt-1 text-[10px] font-extrabold text-rose-600 font-sans">تأخیر در مراجعه</div>' : ''}</td>
            <td class="p-2 font-bold">${m.visitShift ? escapeHTML(m.visitShift) : '—'}</td>
            <td class="p-2">${actions}</td>
        </tr>`;
    }).join('');
}

function opSetPriority(pid, value) {
    const m = opMemberByPatient(pid);
    if (!m || !m.active) return;
    if (value && !OPIUM_PRIORITIES.includes(value)) return;
    m.priority = value;
    opPersist('opiumMembers', m);
    // یکپارچه‌سازی دوطرفه: همان اولویت در پرونده‌ی اصلی بیمار نیز ذخیره می‌شود تا هر دو بخش
    // از یک منبع داده‌ی مشترک و معتبر بخوانند و پس از بارگذاری مجدد نیز هماهنگ بمانند.
    opSyncPatientPriorityFromMember(pid, value);
    triggerBackupReminder();
    showToast('اولویت بیمار ذخیره شد.');
    renderOpiumStats();
    renderOpiumTable();
}

function removeOpiumMember(pid) {
    const m = opMemberByPatient(pid);
    if (!m) return;
    const p = opPatient(pid);
    showCustomConfirm('حذف از فهرست مدیریت اپیوم',
        `«${opPatientName(p)}» از فهرست مدیریت اپیوم حذف شود؟ پرونده‌ی اصلی بیمار و تمام سوابق برنامه‌ها و تحویل‌های او محفوظ می‌ماند و هر زمان می‌توانید او را دوباره اضافه کنید.`,
        () => {
            const prevPriority = m.priority || '';
            m.active = false;
            m.removedAt = opToday();
            m.priority = '';   // با حذف از فهرست، اولویت به «بدون اولویت» برمی‌گردد
            (m.log = m.log || []).push({ action: 'remove', date: opToday(), ts: Date.now(), prevPriority });
            opPersist('opiumMembers', m);
            opSyncPatientPriorityFromMember(pid, '');   // پرونده‌ی اصلی بیمار هم هماهنگ می‌شود (با ثبت در «تغییرات پرونده»)
            triggerBackupReminder();
            showToast('بیمار از فهرست مدیریت اپیوم حذف شد (سوابق حفظ شد).');
            renderOpiumPage();
        });
}
function restoreOpiumMember(pid) {
    const m = opMemberByPatient(pid);
    if (!m) return;
    m.active = true;
    m.removedAt = '';
    (m.log = m.log || []).push({ action: 'add', date: opToday(), ts: Date.now() });
    opPersist('opiumMembers', m);
    triggerBackupReminder();
    showToast('بیمار دوباره به فهرست اضافه شد؛ سوابق قبلی او حفظ شده است.');
    renderOpiumPage();
}

// ---------- Add patients modal ----------
function openOpiumAddModal() {
    opiumUI.addSelected = new Set();
    document.getElementById('opium-add-search').value = '';
    document.getElementById('opium-add-all').checked = false;
    document.getElementById('opium-add-modal').classList.remove('hidden');
    lockBackgroundScroll();
    renderOpiumAddResults();
    setTimeout(() => { const el = document.getElementById('opium-add-search'); if (el) el.focus(); }, 50);
}
function closeOpiumAddModal() {
    document.getElementById('opium-add-modal').classList.add('hidden');
    unlockBackgroundScroll();
}
function opAddCandidates() {
    const q = toEnglishDigits(document.getElementById('opium-add-search').value || '').trim().toLowerCase();
    let list = window.patients || [];
    let hint;
    if (q) {
        list = list.filter(p => toEnglishDigits([opPatientName(p), p.code, p.nationalId].join(' ')).toLowerCase().includes(q));
        hint = `${toPersianDigits(list.length)} نتیجه`;
    } else {
        // بدون جست‌وجو: مراجعین فعالِ دارای داروی اپیوم که هنوز عضو فعال فهرست نیستند، به‌عنوان پیشنهاد
        list = list.filter(p => p.currentDrug === 'اپیوم' && p.status === 'فعال');
        hint = `پیشنهاد: مراجعین فعال با داروی اپیوم (${toPersianDigits(list.length)} نفر) — برای دیدن بقیه جست‌وجو کنید`;
    }
    list = list.slice().sort((a, b) => (a.code || 0) - (b.code || 0));
    return { list: list.slice(0, 80), total: list.length, hint };
}
function renderOpiumAddResults() {
    const { list, total, hint } = opAddCandidates();
    document.getElementById('opium-add-hint').textContent = hint + (total > list.length ? ` — ${toPersianDigits(list.length)} مورد اول نمایش داده شد` : '');
    const box = document.getElementById('opium-add-results');
    if (!list.length) { box.innerHTML = '<p class="text-center text-slate-400 text-xs font-bold py-8">موردی یافت نشد.</p>'; opUpdateAddCount(); return; }
    box.innerHTML = list.map(p => {
        const m = opMemberByPatient(p.id);
        const isActive = m && m.active;
        const wasRemoved = m && !m.active;
        const checked = opiumUI.addSelected.has(p.id) ? 'checked' : '';
        return `<label class="flex items-center gap-3 p-2.5 rounded-xl border ${isActive ? 'bg-slate-50 border-slate-100 opacity-70' : 'border-slate-200 hover:bg-teal-50/40 cursor-pointer'} transition">
            <input type="checkbox" ${isActive ? 'disabled' : ''} ${checked} onchange="opAddToggle('${p.id}', this.checked)" class="rounded text-teal-brand w-4 h-4 shrink-0">
            <div class="flex-1 min-w-0">
                <p class="text-xs font-extrabold text-slate-800 truncate">${escapeHTML(opPatientName(p))}</p>
                <p class="text-[10px] font-bold text-slate-400 font-yekan">کد پرونده: ${toPersianDigits(p.code)} | کد ملی: ${p.nationalId ? toPersianDigits(p.nationalId) : '—'}</p>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 shrink-0">${escapeHTML(p.currentDrug || 'بدون دارو')}</span>
            ${isActive ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">در فهرست</span>' : ''}
            ${wasRemoved ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">حذف‌شده — بازگردانی</span>' : ''}
        </label>`;
    }).join('');
    opUpdateAddCount();
}
function opAddToggle(pid, on) { if (on) opiumUI.addSelected.add(pid); else opiumUI.addSelected.delete(pid); opUpdateAddCount(); }
function opAddToggleAll(on) {
    opAddCandidates().list.forEach(p => {
        const m = opMemberByPatient(p.id);
        if (m && m.active) return;
        if (on) opiumUI.addSelected.add(p.id); else opiumUI.addSelected.delete(p.id);
    });
    renderOpiumAddResults();
}
function opUpdateAddCount() { document.getElementById('opium-add-count').textContent = toPersianDigits(opiumUI.addSelected.size); }

function confirmOpiumAdd() {
    if (!opiumUI.addSelected.size) { showToast('هیچ بیماری انتخاب نشده است.', 'warning'); return; }
    let added = 0, restored = 0, skipped = 0;
    opiumUI.addSelected.forEach(pid => {
        const p = opPatient(pid);
        if (!p) return;
        let m = opMemberByPatient(pid);
        if (m && m.active) { skipped++; return; }          // جلوگیری از افزودن تکراری
        if (m) {                                           // بازگردانی عضو حذف‌شده، بدون ساخت سابقه‌ی تکراری
            m.active = true; m.removedAt = '';
            (m.log = m.log || []).push({ action: 'add', date: opToday(), ts: Date.now() });
            restored++;
        } else {
            m = {
                id: 'opm_' + pid, patientId: pid, active: true,
                priority: OPIUM_PRIORITIES.includes(p.currentPriority) ? p.currentPriority : '',
                addedAt: opToday(), removedAt: '', createdAt: Date.now(),
                log: [{ action: 'add', date: opToday(), ts: Date.now() }]
            };
            (window.opiumMembers = window.opiumMembers || []).push(m);
            added++;
        }
        opPersist('opiumMembers', m);
    });
    triggerBackupReminder();
    closeOpiumAddModal();
    showToast(`${toPersianDigits(added)} بیمار اضافه شد${restored ? ` و ${toPersianDigits(restored)} بیمار بازگردانی شد` : ''}${skipped ? ` (${toPersianDigits(skipped)} مورد تکراری نادیده گرفته شد)` : ''}.`);
    renderOpiumPage();
}


// ---------- Delivery modal (ثبت / ویرایش / ابطال تحویل) ----------
function openOpiumDeliveryModal(pid) {
    const p = opPatient(pid);
    const m = opMemberByPatient(pid);
    if (!p || !m) return;
    opiumUI.delPatientId = pid;
    opiumUI.editingId = null;
    const last = opLastDelivery(pid);

    document.getElementById('op-m-code').textContent = toPersianDigits(p.code);
    document.getElementById('op-m-name').textContent = opPatientName(p);
    document.getElementById('op-m-drug').textContent = (p.currentDrug || 'بدون دارو') + (p.currentDosage ? ` / ${toPersianDigits(p.currentDosage)} ${getDoseUnitCode(p.currentDrug)}` : '');
    document.getElementById('op-m-priority').textContent = m.priority || '—';
    document.getElementById('op-m-shift').value = OPIUM_SHIFT_DAYS.includes(m.visitShift) ? m.visitShift : '';

    document.getElementById('op-d-dose').value = last ? last.dailyDose : (p.currentDrug === 'اپیوم' && p.currentDosage ? p.currentDosage : '');
    document.getElementById('op-d-date').value = opToday();
    document.getElementById('op-d-days').value = last ? last.days : '';
    opDeliverySetMode(false);

    document.getElementById('opium-delivery-modal').classList.remove('hidden');
    lockBackgroundScroll();
    opDelRecalc();
    renderOpiumDeliveryHistory();
}
function closeOpiumDeliveryModal() {
    document.getElementById('opium-delivery-modal').classList.add('hidden');
    unlockBackgroundScroll();
    opiumUI.delPatientId = null; opiumUI.editingId = null;
}
function opDeliverySetMode(editing) {
    document.getElementById('op-d-editbar').classList.toggle('hidden', !editing);
    document.getElementById('op-d-submit-label').textContent = editing ? 'ثبت ویرایش تحویل' : 'ثبت تحویل';
}

function opReadDeliveryForm() {
    const dose = parseFloat(document.getElementById('op-d-dose').value);
    const days = parseFloat(document.getElementById('op-d-days').value);
    const date = opNormDate(document.getElementById('op-d-date').value);
    const errors = [];
    if (!isFinite(dose) || dose <= 0) errors.push('دوز روزانه باید عددی بزرگ‌تر از صفر باشد.');
    if (!isFinite(days) || days < 1 || Math.floor(days) !== days) errors.push('تعداد روزهای تحویل باید یک عدد صحیح و حداقل ۱ باشد.');
    else if (days > 366) errors.push('تعداد روزهای تحویل بیش از حد مجاز (۳۶۶ روز) است.');
    if (!date || !opIsValidDate(date)) errors.push('تاریخ تحویل معتبر نیست.');
    return { dose, days, date, errors };
}

function opDelRecalc() {
    const f = opReadDeliveryForm();
    const ok = f.errors.length === 0;
    const c = ok ? opComputeDelivery(f.dose, f.date, f.days) : null;
    document.getElementById('op-d-total').textContent = ok ? `${opFmt(c.volume, 2)} سی‌سی` : '—';
    document.getElementById('op-d-next').textContent = ok ? toPersianDigits(c.next) : '—';
    document.getElementById('op-d-weekday').textContent = ok ? c.weekday : '—';
}

// اصلاح «آخرین ارائه دارو» پس از ثبت/ویرایش/ابطال، بدون دست‌زدن به تاریخ‌هایی که از منبع دیگری آمده‌اند
function opSyncLastDispense(p, oldDate) {
    const dates = (p.dispenseHistory || []).map(h => opNormDate(h.date)).filter(Boolean).sort();
    const maxD = dates.length ? dates[dates.length - 1] : '';
    const cur = opNormDate(p.lastDispenseDate);
    if (!cur || (oldDate && cur === oldDate) || (maxD && maxD > cur)) p.lastDispenseDate = maxD;
}
// نوشتن/به‌روزرسانی «یک» رکورد آینه‌ای در تاریخچه‌ی ارائه دارو — هیچ‌گاه دوبار برای یک تحویل ثبت نمی‌شود.
function opMirrorDelivery(p, d) {
    p.dispenseHistory = p.dispenseHistory || [];
    const entry = {
        id: 'opium-' + d.id, opiumDeliveryId: d.id,
        date: d.date, drug: 'اپیوم', quantity: d.volume,
        nextVisit: toPersianDigits(d.nextVisitDate), recipient: 'خودش', companion: '', recordedBy: d.recordedBy
    };
    const idx = p.dispenseHistory.findIndex(h => h.opiumDeliveryId === d.id);
    if (idx > -1) p.dispenseHistory[idx] = Object.assign({}, p.dispenseHistory[idx], entry);
    else p.dispenseHistory.unshift(entry);
}

function submitOpiumDelivery() {
    if (opiumUI.busy) return;
    const pid = opiumUI.delPatientId;
    const p = opPatient(pid);
    if (!p) return;
    const f = opReadDeliveryForm();
    if (f.errors.length) { showToast(f.errors[0], 'error'); return; }
    const c = opComputeDelivery(f.dose, f.date, f.days);

    // جلوگیری از ثبت تکراری: همان بیمار، همان تاریخ، همان دوز و همان تعداد روز
    const dup = opDeliveriesOf(pid, false).find(d => d.id !== opiumUI.editingId && opNormDate(d.date) === f.date && Number(d.dailyDose) === f.dose && Number(d.days) === f.days);
    if (dup) { showToast('این تحویل (همین تاریخ، دوز و تعداد روز) قبلاً برای این بیمار ثبت شده است.', 'warning'); return; }

    opiumUI.busy = true;
    try {
        let msg, oldDate = '';
        if (opiumUI.editingId) {
            const d = (window.opiumDeliveries || []).find(x => x.id === opiumUI.editingId);
            if (!d || d.status === OPIUM_DELIVERY_VOID) { showToast('این تحویل قابل ویرایش نیست.', 'error'); return; }
            oldDate = opNormDate(d.date);
            (d.editHistory = d.editHistory || []).push({
                ts: Date.now(), date: opToday(), by: opWho(),
                before: { date: d.date, dailyDose: d.dailyDose, days: d.days, volume: d.volume, nextVisitDate: d.nextVisitDate }
            });
            Object.assign(d, { date: f.date, dailyDose: f.dose, days: f.days, volume: c.volume, nextVisitDate: c.next, nextVisitWeekday: c.weekday });
            opPersist('opiumDeliveries', d);
            opMirrorDelivery(p, d);
            msg = 'ویرایش تحویل ذخیره شد و مقادیر وابسته دوباره محاسبه گردید.';
        } else {
            const d = {
                id: crypto.randomUUID(), patientId: pid,
                date: f.date, dailyDose: f.dose, days: f.days, volume: c.volume,
                nextVisitDate: c.next, nextVisitWeekday: c.weekday,
                status: 'ثبت‌شده', recordedBy: opWho(), createdAt: Date.now()
            };
            (window.opiumDeliveries = window.opiumDeliveries || []).push(d);
            opPersist('opiumDeliveries', d);
            opMirrorDelivery(p, d);
            msg = `تحویل ${opFmt(d.volume, 2)} سی‌سی ثبت شد و در تاریخچه‌ی ارائه دارو و پرونده‌ی بیمار ذخیره گردید.`;
        }
        // فقط تاریخچه‌ی ارائه دارو و «آخرین ارائه دارو» در پرونده تغییر می‌کند؛ دارو و دوز درمانی دست‌نخورده می‌مانند.
        opSyncLastDispense(p, oldDate);
        dbPutRecord('patients', p);
        triggerBackupReminder();
        showToast(msg);
        renderOpiumPage();
        if (typeof renderDispenseList === 'function') { try { renderDispenseList(); } catch (e) { /* tab not rendered */ } }
        openOpiumDeliveryModal(pid);
    } finally {
        opiumUI.busy = false;
    }
}

function editOpiumDelivery(id) {
    const d = (window.opiumDeliveries || []).find(x => x.id === id);
    if (!d || d.status === OPIUM_DELIVERY_VOID) return;
    opiumUI.editingId = id;
    document.getElementById('op-d-dose').value = d.dailyDose;
    document.getElementById('op-d-date').value = opNormDate(d.date);
    document.getElementById('op-d-days').value = d.days;
    opDeliverySetMode(true);
    opDelRecalc();
    renderOpiumDeliveryHistory();
    document.getElementById('op-d-dose').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function cancelOpiumDeliveryEdit() {
    if (opiumUI.delPatientId) openOpiumDeliveryModal(opiumUI.delPatientId);
}

function voidOpiumDelivery(id) {
    const d = (window.opiumDeliveries || []).find(x => x.id === id);
    if (!d || d.status === OPIUM_DELIVERY_VOID) return;
    showCustomConfirm('ابطال تحویل',
        'این تحویل ابطال شود؟ در آمار مصرف واقعی حساب نمی‌شود و از تاریخچه‌ی ارائه دارو‌ی بیمار برداشته می‌شود؛ خودِ رکورد با وضعیت «ابطال‌شده» در سوابق می‌ماند.',
        () => {
            d.status = OPIUM_DELIVERY_VOID;
            d.voidedAt = opToday();
            d.voidedBy = opWho();
            opPersist('opiumDeliveries', d);
            const p = opPatient(d.patientId);
            if (p) {
                p.dispenseHistory = (p.dispenseHistory || []).filter(h => h.opiumDeliveryId !== d.id);
                opSyncLastDispense(p, opNormDate(d.date));
                dbPutRecord('patients', p);
            }
            triggerBackupReminder();
            showToast('تحویل ابطال شد.');
            renderOpiumPage();
            if (typeof renderDispenseList === 'function') { try { renderDispenseList(); } catch (e) { /* tab not rendered */ } }
            if (opiumUI.delPatientId) openOpiumDeliveryModal(opiumUI.delPatientId);
        });
}

function renderOpiumDeliveryHistory() {
    const body = document.getElementById('op-hist-body');
    if (!body) return;
    const list = opSortDeliveriesDesc(opDeliveriesOf(opiumUI.delPatientId, true));
    if (!list.length) { body.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-slate-400 font-bold">هنوز تحویلی برای این بیمار ثبت نشده است.</td></tr>'; return; }
    body.innerHTML = list.map(d => {
        const voided = d.status === OPIUM_DELIVERY_VOID;
        const editing = opiumUI.editingId === d.id;
        const action = voided
            ? `<span class="text-[10px] font-bold text-slate-400">ابطال‌شده${d.voidedAt ? ' — ' + toPersianDigits(d.voidedAt) : ''}</span>`
            : `<div class="flex items-center justify-center gap-1.5">
                    <button onclick="editOpiumDelivery('${d.id}')" class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[10px] font-bold">ویرایش تحویل</button>
                    <button onclick="voidOpiumDelivery('${d.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold">ابطال تحویل</button>
               </div>`;
        return `<tr class="${voided ? 'text-slate-400 line-through' : ''} ${editing ? 'bg-sky-50' : ''}">
            <td class="p-2.5 font-yekan">${opFmtDate(d.date)}</td>
            <td class="p-2.5 text-center font-yekan font-bold">${opFmt(d.dailyDose, 2)}</td>
            <td class="p-2.5 text-center font-yekan">${toPersianDigits(d.days)}</td>
            <td class="p-2.5 text-center font-yekan font-bold">${opFmt(d.volume, 2)}</td>
            <td class="p-2.5 font-yekan">${opFmtDate(d.nextVisitDate)} <span class="text-slate-400 font-sans">(${opWeekday(d.nextVisitDate) || '—'})</span></td>
            <td class="p-2.5 text-center">${action}</td>
        </tr>`;
    }).join('');
}

// ---------- Detailed consumption report ----------
const OPIUM_STATUS_OK = 'تحویل شد';
const OPIUM_STATUS_LATE = 'تأخیر در مراجعه';
// ---------- مرتب‌سازی ترکیبی (Multi-column) برای گزارش تفصیلی ----------
function opSortCodeVal(v) { const t = toEnglishDigits(String(v == null ? '' : v)).trim(); return t === '' ? null : t; }
// مقدار قابل‌مقایسه‌ی یک سلول؛ null = خالی
function opSortVal(c, r) {
    switch (c.stype) {
        case 'prio': { const i = OPIUM_PRIORITIES.indexOf(r.priority); return i < 0 ? null : i; }   // فقط مقدار واقعی اولویت (ترتیب منطقی سیستم)؛ «بدون اولویت» = خالی. برچسب «با تأخیر» هیچ نقشی در مرتب‌سازی ندارد.
        case 'wday': { const i = OPIUM_WEEKDAYS.indexOf(r.weekday); return i < 0 ? null : i; }
        case 'shift': { const i = OPIUM_WEEKDAYS.indexOf(opVisitShift(r.patientId)); return i < 0 ? null : i; }   // شیفت مراجعه: شنبه ← پنجشنبه             // شنبه ← جمعه
        case 'code': return opSortCodeVal(r.code);
        case 'num': { const v = c.raw(r); return (v === '' || v == null || !isFinite(Number(v))) ? null : Number(v); }
        default: { const v = c.raw(r); const t = String(v == null ? '' : v).trim(); return t === '' ? null : t; }
    }
}
function opSortCmp(type, a, b) {
    if (type === 'num' || type === 'prio' || type === 'wday' || type === 'shift') return a - b;
    if (type === 'date') return a < b ? -1 : (a > b ? 1 : 0);        // تاریخ نرمال‌شده‌ی YYYY/MM/DD
    if (type === 'code') {
        const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
        if (na && nb) return (Number(a) - Number(b)) || (a < b ? -1 : (a > b ? 1 : 0));   // ۲ قبل از ۱۰
        if (na !== nb) return na ? -1 : 1;                              // کد عددی قبل از کد غیرعددی
        return a.localeCompare(b, 'fa', { numeric: true });
    }
    return a.localeCompare(b, 'fa');
}

function opReportData() {
    const r = opRange();
    const mode = document.getElementById('opium-report-mode').value;
    const q = toEnglishDigits(document.getElementById('opium-report-search').value || '').trim().toLowerCase();
    const fPrio = document.getElementById('opium-report-priority').value;
    const fWk = document.getElementById('opium-report-weekday').value;

    // وضعیت «تأخیر در مراجعه» از روی سوابق واقعی استخراج می‌شود (نه یک رویداد تحویل جدید):
    // آخرین تحویل معتبرِ یک عضو فعال، که تاریخ مراجعه‌ی بعدی‌اش گذشته و تحویل دیگری بعد از آن ثبت نشده است.
    const flagsByPid = {};
    opActiveMembers().forEach(m => { flagsByPid[m.patientId] = opMemberFlags(m); });
    const isDelayed = d => { const f = flagsByPid[d.patientId]; return !!(f && f.followup && f.last && f.last.id === d.id); };
    const toItem = (d, carry) => {
        const p = opPatient(d.patientId); const m = opMemberByPatient(d.patientId);
        const delayed = isDelayed(d);
        return {
            id: d.id, patientId: d.patientId, name: opPatientName(p), code: p ? p.code : '', date: d.date, createdAt: d.createdAt || 0,
            dose: d.dailyDose, days: d.days, volume: d.volume, syrup: opSyrup(d.volume),
            nextVisit: d.nextVisitDate, weekday: d.nextVisitWeekday || opWeekday(d.nextVisitDate),
            priority: (m && m.active && m.priority) || OPIUM_NO_PRIORITY,   // بیمار حذف‌شده همیشه «بدون اولویت»
            removed: !!(m && !m.active),
            delayed, carry: !!carry,
            status: delayed ? OPIUM_STATUS_LATE : OPIUM_STATUS_OK
        };
    };
    const showRemoved = !!(document.getElementById('opium-report-show-removed') || {}).checked;
    const pass = x => {
        if (x.removed && !showRemoved) return false;   // بیماران حذف‌شده فقط با تیک چک‌باکس دیده می‌شوند
        if (q && !toEnglishDigits(x.name + ' ' + x.code).toLowerCase().includes(q)) return false;
        if (fPrio && x.priority !== fPrio) return false;
        // در گزارش تجمیعی، فیلتر «روز مراجعه بعدی» روی آخرین مراجعه‌ی بعدی هر بیمار اعمال می‌شود (پایین‌تر)؛ در بقیه‌ی حالت‌ها روی هر تحویل.
        if (fWk && mode !== 'detail' && x.weekday !== fWk) return false;
        return true;
    };
    // ---- بیماران «تأخیر» (در بازه/دوره‌ی جاری حتی یک تحویل معتبر ندارند) ----
    // مستقل از همه‌ی فیلترهای جدول (جست‌وجو، اولویت، روز، وضعیت تأخیر) و بر اساس بیماران یکتا محاسبه می‌شود.
    const deliveredPidsInRange = new Set(opRealDeliveries().filter(x => opInRange(x.date, r)).map(x => x.patientId));
    const delayedMap = new Map();
    if (!r.error) opActiveMembers().forEach(m => { if (!deliveredPidsInRange.has(m.patientId) && !delayedMap.has(m.patientId)) delayedMap.set(m.patientId, m); });
    const delayedTotal = delayedMap.size;
    // فیلتر وضعیت تأخیر فقط در حالت‌های بیمار‌محور (تجمیعی / به تفکیک بیمار) اثر دارد
    const dSel = document.getElementById('opium-report-delay');
    if (dSel) dSel.disabled = (mode === 'day');
    const dMode = (mode === 'day' || !dSel) ? 'all' : dSel.value;
    const delayedSrc = [];
    if (mode !== 'day' && dMode !== 'hide') {
        delayedMap.forEach(m => {
            const p = opPatient(m.patientId);
            const last = opLastDelivery(m.patientId);   // فقط برای نمایش آخرین «مراجعه بعدی» ثبت‌شده؛ چیزی تغییر نمی‌کند
            const x = {
                patientId: m.patientId, name: opPatientName(p), code: p ? p.code : '',
                priority: m.priority || OPIUM_NO_PRIORITY,
                nextVisit: last ? last.nextVisitDate : '',
                dose: last ? last.dailyDose : '',
                weekday: last ? (last.nextVisitWeekday || opWeekday(last.nextVisitDate)) : ''
            };
            if (q && !toEnglishDigits(x.name + ' ' + x.code).toLowerCase().includes(q)) return;
            if (fPrio && x.priority !== fPrio) return;
            if (fWk && x.weekday !== fWk) return;
            delayedSrc.push(x);
        });
    }

    let items = opRealDeliveries().filter(d => opInRange(d.date, r)).map(d => toItem(d, false)).filter(pass);
    if (mode !== 'day' && dMode === 'only') items = [];   // «فقط بیماران دارای تأخیر»: ردیف تحویل‌دار نمایش داده نمی‌شود

    let carry = []; // (در گزارش تجمیعی هر بیمار فقط یک ردیف دارد و ردیف‌های «تأخیر» حذف شده‌اند)

    // «اولین تاریخ تحویل در این دوره»: اولین تحویل معتبر بیمار که داخل بازه‌ی انتخابی ثبت شده است.
    // اگر آخرینِ تحویل‌های قبل از شروع بازه هنوز تا ابتدای بازه پوشش دارد (تاریخ تحویل + روزها > شروع بازه)،
    // به‌جای تاریخ عبارت «از دور قبل» نمایش داده می‌شود.
    const OP_FROM_PREV = 'از دور قبل';
    const firstInfo = pid => {
        const mine = items.filter(x => x.patientId === pid)
            .sort((x, y) => opNormDate(x.date).localeCompare(opNormDate(y.date)) || (x.createdAt || 0) - (y.createdAt || 0));
        const firstDate = mine.length ? opNormDate(mine[0].date) : '';
        let fromPrev = false;
        if (r.from && !r.error) {
            const prev = opSortDeliveriesDesc(opDeliveriesOf(pid, false).filter(d => opNormDate(d.date) && opNormDate(d.date) < r.from))[0];
            if (prev) {
                const end = opNormDate(addDaysToJalali(opNormDate(prev.date), Number(prev.days) || 0));
                if (end && end > r.from) fromPrev = true;
            }
        }
        return { firstDate, fromPrev };
    };
    const firstCol = {
        k: 'firstdate', l: 'اولین تاریخ تحویل در این دوره', stype: 'date',
        raw: r => r.fromPrev ? '0000/00/00' : (r.firstDate || ''),
        fmt: r => r.fromPrev ? `<span class="font-bold text-amber-600">${OP_FROM_PREV}</span>` : (r.firstDate ? toPersianDigits(r.firstDate) : '—'),
        csv: r => r.fromPrev ? OP_FROM_PREV : (r.firstDate || '')
    };

    // ستون «اولویت»: مقدار اولویت همیشه نمایش داده می‌شود؛ برای بیمار دارای تأخیر، برچسب ریز «با تأخیر» (بدون کادر) زیر آن می‌آید.
    const prioCol = {
        k: 'priority', l: 'اولویت', stype: 'prio', raw: r => r.priority,
        fmt: r => r.periodDelayed
            ? `<span>${escapeHTML(r.priority)}</span><span class="op-late-note">با تأخیر</span>`
            : escapeHTML(r.priority),
        // چاپ: برای اینکه هیچ ردیفی دوخطی نشود، برچسب کنار اولویت و با فونت ریز می‌آید
        pfmt: r => r.periodDelayed
            ? `${escapeHTML(r.priority)} <span style="font-size:6.5pt;font-weight:400;">(با تأخیر)</span>`
            : escapeHTML(r.priority),
        csv: r => r.periodDelayed ? 'تأخیر' : r.priority
    };
    // ستون «دوز روزانه»: دوز روزانه‌ی آخرین تحویل معتبر بیمار در بازه (فقط نمایشی؛ محاسبات تغییر نمی‌کند)
    const doseCol = {
        k: 'dose', l: 'دوز روزانه', stype: 'num', raw: r => r.dose,
        fmt: r => (r.dose === '' || r.dose == null) ? '—' : opFmt(r.dose, 2),
        csv: r => (r.dose === '' || r.dose == null) ? '' : r.dose
    };
    // ستون «شیفت مراجعه»: روز ثابت مراجعه هفتگی بیمار که در پنجره‌ی «مدیریت» ثبت شده است
    const shiftCol = {
        k: 'shift', l: 'شیفت مراجعه', stype: 'shift', raw: r => opVisitShift(r.patientId),
        fmt: r => { const v = opVisitShift(r.patientId); return v ? `<span class="font-bold text-slate-700">${escapeHTML(v)}</span>` : '—'; },
        csv: r => opVisitShift(r.patientId)
    };
    let cols, rows;
    if (mode === 'patient') {
        const g = {};
        items.forEach(x => {
            const k = x.patientId;
            g[k] = g[k] || { patientId: x.patientId, name: x.name, code: x.code, priority: x.priority, removed: x.removed, count: 0, days: 0, volume: 0 };
            g[k].count++; g[k].days += x.days; g[k].volume = opRound(g[k].volume + x.volume, 3);
        });
        rows = Object.values(g).map(x => ({ ...x, ...firstInfo(x.patientId), syrup: opSyrup(x.volume) }));
        cols = [
            { k: 'name', l: 'نام و نام خانوادگی', stype: 'text', cls: 'op-col-name', raw: r => r.name, fmt: r => escapeHTML(r.name), csv: r => r.name },
            { k: 'code', l: 'کد پرونده', stype: 'code', raw: r => Number(r.code) || 0, fmt: r => toPersianDigits(r.code), csv: r => r.code },
            prioCol,
            firstCol,
            { k: 'count', l: 'تعداد تحویل', stype: 'num', raw: r => r.count, fmt: r => toPersianDigits(r.count), csv: r => r.count },
            { k: 'days', l: 'مجموع روزهای پوشش', stype: 'num', raw: r => r.days, fmt: r => toPersianDigits(r.days), csv: r => r.days },
            { k: 'volume', l: 'حجم تحویل‌شده (سی‌سی)', stype: 'num', raw: r => r.volume, fmt: r => opFmt(r.volume, 2), csv: r => r.volume },
            { k: 'syrup', l: 'معادل شربت ۲۵۰ سی‌سی', stype: 'num', raw: r => r.syrup, fmt: r => opFmt(r.syrup, 3), csv: r => opRound(r.syrup, 3) }
        ];
    } else if (mode === 'day') {
        const g = {};
        items.forEach(x => {
            const k = opNormDate(x.date);
            g[k] = g[k] || { date: k, weekday: opWeekday(k), patients: new Set(), count: 0, volume: 0 };
            g[k].patients.add(x.patientId); g[k].count++; g[k].volume = opRound(g[k].volume + x.volume, 3);
        });
        rows = Object.values(g).map(x => ({ date: x.date, weekday: x.weekday, patients: x.patients.size, count: x.count, volume: x.volume, syrup: opSyrup(x.volume) }));
        cols = [
            { k: 'date', l: 'تاریخ', stype: 'date', raw: r => r.date, fmt: r => toPersianDigits(r.date), csv: r => r.date },
            { k: 'weekday', l: 'روز هفته', stype: 'wday', raw: r => OPIUM_WEEKDAYS.indexOf(r.weekday), fmt: r => r.weekday, csv: r => r.weekday },
            { k: 'patients', l: 'تعداد بیمار', stype: 'num', raw: r => r.patients, fmt: r => toPersianDigits(r.patients), csv: r => r.patients },
            { k: 'count', l: 'تعداد تحویل', stype: 'num', raw: r => r.count, fmt: r => toPersianDigits(r.count), csv: r => r.count },
            { k: 'volume', l: 'حجم تحویل‌شده (سی‌سی)', stype: 'num', raw: r => r.volume, fmt: r => opFmt(r.volume, 2), csv: r => r.volume },
            { k: 'syrup', l: 'معادل شربت ۲۵۰ سی‌سی', stype: 'num', raw: r => r.syrup, fmt: r => opFmt(r.syrup, 3), csv: r => opRound(r.syrup, 3) }
        ];
    } else {
        // گزارش تجمیعی: هر بیمار یک ردیف؛ مجموع «فقط تحویل‌های معتبر (غیرابطال‌شده) در بازه‌ی انتخابی»
        const g = {};
        items.forEach(x => {
            const o = g[x.patientId] = g[x.patientId] || { patientId: x.patientId, name: x.name, code: x.code, priority: x.priority, removed: x.removed, days: 0, volume: 0, count: 0, _d: '', _c: -1, nextVisit: '', weekday: '', dose: '' };
            o.days += Number(x.days) || 0;
            o.volume = opRound(o.volume + (Number(x.volume) || 0), 3);
            o.count++;
            // «آخرین مراجعه‌ی بعدی» = مراجعه‌ی بعدی جدیدترین تحویل معتبر بیمار در بازه
            const dt = opNormDate(x.date);
            if (dt > o._d || (dt === o._d && (x.createdAt || 0) >= o._c)) { o._d = dt; o._c = x.createdAt || 0; o.nextVisit = x.nextVisit; o.weekday = x.weekday; o.dose = x.dose; }
        });
        rows = Object.values(g).map(o => ({ ...o, ...firstInfo(o.patientId), syrup: opSyrup(o.volume) }));
        if (fWk) {
            rows = rows.filter(o => o.weekday === fWk);
            const keep = new Set(rows.map(o => o.patientId));
            items = items.filter(x => keep.has(x.patientId));   // جمع کل هم با همین فیلتر هماهنگ بماند
        }
        const dateFmt = (r, print) => r.nextVisit
            ? `<span class="font-yekan font-bold ${print ? '' : 'text-blue-600'}"${print ? ' style="color:#1d4ed8;"' : ''}>${toPersianDigits(opNormDate(r.nextVisit))}</span>`
            : '—';
        cols = [
            { k: 'name', l: 'نام و نام خانوادگی', stype: 'text', cls: 'op-col-name', raw: r => r.name, fmt: r => escapeHTML(r.name), csv: r => r.name },
            { k: 'code', l: 'کد پرونده', stype: 'code', raw: r => Number(r.code) || 0, fmt: r => toPersianDigits(r.code), csv: r => r.code },
            prioCol,
            doseCol,
            shiftCol,
            firstCol,
            { k: 'days', l: 'کل روزهای دریافتی', stype: 'num', raw: r => r.days, fmt: r => toPersianDigits(r.days), csv: r => r.days },
            { k: 'volume', l: 'میزان کل دریافتی', stype: 'num', raw: r => r.volume, fmt: r => opFmt(r.volume, 2), csv: r => r.volume },
            // مرتب‌سازی «روز» بر اساس ترتیب تقویم شمسی (شنبه تا جمعه) است؛ مرتب‌سازی «تاریخ» بر اساس تاریخ تقویمی
            { k: 'nextdate', l: 'تاریخ آخرین مراجعه بعدی', stype: 'date', raw: r => opNormDate(r.nextVisit), fmt: r => dateFmt(r, false), pfmt: r => dateFmt(r, true), csv: r => opNormDate(r.nextVisit) },
            { k: 'actions', l: 'اقدام', noSort: true, noExport: true, raw: r => '', csv: r => '',
              fmt: r => `<button onclick="opReportHistory('${r.patientId}')" class="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[10px] font-bold"><i class="fa-solid fa-clock-rotate-left ml-1"></i>تاریخچه</button>`,
              pfmt: r => '&nbsp;' }
        ];
    }

    // افزودن ردیف بیماران دارای تأخیر (فقط نمایشی؛ هیچ رکوردی ساخته یا تغییر داده نمی‌شود)
    delayedSrc.forEach(x => rows.push({
        ...x, ...firstInfo(x.patientId), count: 0, days: 0, volume: 0, syrup: 0, periodDelayed: true
    }));

    // ستون «ردیف» (شماره‌ی ترتیبی ردیف‌ها بر اساس چینش نهایی نمایش؛ قابل مرتب‌سازی نیست)
    cols.unshift({ k: 'rownum', l: 'ردیف', noSort: true, raw: r => r._i, fmt: r => toPersianDigits(r._i), csv: r => r._i });

    // ---- مرتب‌سازی چندستونه (فقط ترتیب نمایش؛ داده‌ها دست‌نخورده) ----
    // معیارهایی که در حالت نمایش فعلی ستون ندارند حذف می‌شوند.
    const sorts = (opiumUI.reportSort || []).filter(s => cols.some(c => c.k === s.key && !c.noSort));
    opiumUI.reportSort = sorts;
    const colOf = {}; cols.forEach(c => { colOf[c.k] = c; });
    // معیار پایدار نهایی: حالت «به تفکیک روز» بر اساس تاریخ، سایر حالت‌ها بر اساس نام ← کد پرونده ← شناسه‌ی بیمار
    const tieBreak = (a, b) => {
        if (mode === 'day') return opSortCmp('date', String(a.date), String(b.date));
        return opSortCmp('text', String(a.name || ''), String(b.name || ''))
            || opSortCmp('code', opSortCodeVal(a.code) || '', opSortCodeVal(b.code) || '')
            || String(a.patientId || '').localeCompare(String(b.patientId || ''));
    };
    rows.sort((ra, rb) => {
        for (const s of sorts) {
            const c = colOf[s.key];
            const a = opSortVal(c, ra), b = opSortVal(c, rb);
            if (a === null || b === null) {              // مقدار خالی همیشه ته گروه (مستقل از جهت مرتب‌سازی)
                if (a === b) {
                    // ستون اولویت: بین «بدون اولویت»ها، بیماران حذف‌شده همیشه آخر می‌آیند (صعودی و نزولی)
                    if (c.k === 'priority' && !!ra.removed !== !!rb.removed) return ra.removed ? 1 : -1;
                    continue;
                }
                return a === null ? 1 : -1;
            }
            const r = opSortCmp(c.stype, a, b);
            if (r) return s.dir === 'desc' ? -r : r;     // معیار بعدی فقط وقتی بررسی می‌شود که معیار قبلی مساوی باشد
        }
        return tieBreak(ra, rb);
    });
    rows.forEach((r, i) => { r._i = i + 1; });
    const sort = sorts.map(s => ({ key: s.key, dir: s.dir, label: colOf[s.key].l }));

    const totalVolume = opSum(items.map(x => x.volume));
    // مجموع حجم تحویل‌شده‌ی اولویت‌های انتخاب‌شده (فقط از تحویل‌های معتبرِ همین بازه؛ ردیف‌ها و آمار دست‌نخورده)
    const selSet = opTotalPrioSet();
    const selList = opAllPrioOptions().filter(x => selSet.has(x));
    // حجم هر اولویت‌ِ انتخاب‌شده (تحویل‌های معتبر بازه)؛ مجموع نهایی دقیقاً جمع همین مقادیر است
    const selByPrio = selList.map(pn => [pn, opSum(items.filter(x => x.priority === pn).map(x => x.volume))]);
    const selVolume = opSum(selByPrio.map(a => a[1]));
    // دورترین تاریخ مراجعه بعدی میان تحویل‌های معتبرِ منطبق با فیلترهای فعلی (بازه، بیمار، اولویت، روز)
    const nexts = items.map(x => opNormDate(x.nextVisit)).filter(Boolean).sort();
    const farthest = nexts.length ? nexts[nexts.length - 1] : '';
    // خلاصه‌ی پایین گزارش: هر بیمار فقط یک‌بار شمرده می‌شود؛ اولویت و «روز مراجعه بعدی» از جدیدترین تحویل معتبر بیمار در بازه
    const latestOf = {};
    items.forEach(x => {
        const k = opNormDate(x.date), c = x.createdAt || 0, o = latestOf[x.patientId];
        if (!o || k > o._d || (k === o._d && c >= o._c)) latestOf[x.patientId] = { _d: k, _c: c, priority: x.priority, weekday: x.weekday };
    });
    const lv = Object.values(latestOf);
    const cnt = (arr, f) => arr.filter(f).length;
    // آمار هر اولویت: کل = دریافت‌کننده‌ها + دارای تأخیر (اعضای فعالی که در بازه تحویل ندارند)؛ مستقل از فیلتر «اولویت‌های مشمول مجموع تحویل»
    const delayedMembers = Array.from(delayedMap.values());
    const prioList = opAllPrioOptions().map(pn => {
        const rec = cnt(lv, v => v.priority === pn);
        const dl = cnt(delayedMembers, m => (m.priority || OPIUM_NO_PRIORITY) === pn);
        return [pn, rec + dl, rec, dl];
    }).filter(a => a[1] > 0);
    // تعداد افراد در هر روز هفته: روز هفته از «تاریخ واقعی دریافت دارو» محاسبه می‌شود و هر بیمار در هر روز یک‌بار شمرده می‌شود
    // (نه تعداد دفعات ثبت تحویل)؛ فقط روزهایی که داده دارند؛ مستقل از اولویت‌های انتخاب‌شده برای محاسبه حجم.
    const dayPids = {};
    items.forEach(x => { const w = opWeekday(x.date) || 'نامشخص'; (dayPids[w] = dayPids[w] || new Set()).add(x.patientId); });
    const wkList = OPIUM_WEEKDAYS.filter(w => dayPids[w]).map(w => [w, dayPids[w].size]);
    if (dayPids['نامشخص']) wkList.push(['نامشخص', dayPids['نامشخص'].size]);
    // جمع کل بیماران = بیماران یکتای دریافت‌کننده در بازه + اعضای فعالِ بدون دریافت در بازه
    const summary = { total: lv.length + delayedTotal, received: lv.length, prio: prioList, wk: wkList, delayed: delayedTotal };
    return { mode, cols, rows, sort, summary, totalVolume, totalSyrup: opSyrup(totalVolume), selList, selByPrio, selVolume, selSyrup: opSyrup(selVolume), selLabel: opTotalPrioLabel(selList), deliveries: items.length, range: r, farthest, carryCount: carry.length };
}

// ویرایش از جدول گزارش: همان پاپ‌آپ «مدیریت تحویل» را در حالت ویرایش باز می‌کند تا منطق و محاسبات یکی باشد.
function opReportEdit(id) {
    const d = (window.opiumDeliveries || []).find(x => x.id === id);
    if (!d || d.status === OPIUM_DELIVERY_VOID) return;
    if (!opMemberByPatient(d.patientId)) { showToast('این بیمار در فهرست مدیریت اپیوم نیست؛ ابتدا او را به فهرست اضافه کنید.', 'warning'); return; }
    openOpiumDeliveryModal(d.patientId);
    editOpiumDelivery(id);
}

// «تاریخچه»: پنجره‌ی همان بیمار با همه‌ی تحویل‌هایش (ویرایش/ابطال همان‌جاست و گزارش بعد از هر تغییر دوباره محاسبه می‌شود)
function opReportHistory(pid) {
    if (!opMemberByPatient(pid)) { showToast('این بیمار در فهرست مدیریت اپیوم نیست؛ ابتدا او را به فهرست اضافه کنید.', 'warning'); return; }
    openOpiumDeliveryModal(pid);
}

// کلیک ساده: مرتب‌سازی تک‌ستونه (کلیک مجدد روی همان ستون = تغییر جهت؛ ستون جدید = حذف معیارهای قبلی)
// Shift/Ctrl + کلیک: افزودن معیار بعدی (اگر ستون قبلاً فعال بوده فقط جهتش عوض می‌شود و اولویتش ثابت می‌ماند)
function opReportSortBy(key, ev) {
    const multi = !!(ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
    const list = opReportData().sort.map(s => ({ key: s.key, dir: s.dir }));
    const i = list.findIndex(s => s.key === key);
    const flip = d => d === 'asc' ? 'desc' : 'asc';
    if (i >= 0) list[i].dir = flip(list[i].dir);
    else if (multi) list.push({ key, dir: 'asc' });
    else { list.length = 0; list.push({ key, dir: 'asc' }); }
    opiumUI.reportSort = list;
    renderOpiumReport();
}
function opReportSortClear() { opiumUI.reportSort = []; renderOpiumReport(); }

// ---------- فیلتر چندانتخابیِ «اولویت‌های مشمول محاسبه مجموع تحویل» ----------
// فقط «مجموع حجم تحویل‌شده» را تغییر می‌دهد؛ ردیف‌های جدول، سایر فیلترها و آمار تعداد افراد از آن تأثیر نمی‌گیرند.
// پیش‌فرض: همه‌ی اولویت‌ها (شامل «بدون اولویت») ← همان جمع کل قبلی.
function opAllPrioOptions() { return OPIUM_PRIORITIES.concat([OPIUM_NO_PRIORITY]); }
function opTotalPrioSet() { if (!opiumUI.totalPrios) opiumUI.totalPrios = new Set(opAllPrioOptions()); return opiumUI.totalPrios; }
function opJoinFa(arr) { return arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join('، ') + ' و ' + arr[arr.length - 1]; }
function opTotalPrioLabel(selList) {
    if (selList.length === opAllPrioOptions().length) return 'مجموع حجم تحویل‌شده به همه اولویت‌ها';
    return (selList.length === 1 ? 'مجموع حجم تحویل‌شده به اولویت ' : 'مجموع حجم تحویل‌شده به اولویت‌های ') + opJoinFa(selList);
}
function opRenderTotalPrioControl() {
    const listEl = document.getElementById('opium-total-prio-list');
    if (!listEl) return;
    const opts = opAllPrioOptions(), set = opTotalPrioSet();
    const sig = opts.join('|');
    // ساخت چک‌باکس‌ها فقط یک‌بار (یا با تغییر فهرست اولویت‌ها)؛ در رندرهای بعدی فقط وضعیت تیک به‌روز می‌شود تا چیدمان و فوکوس تغییر نکند
    if (listEl.dataset.sig !== sig) {
        listEl.dataset.sig = sig;
        listEl.innerHTML = opts.map(x => `
            <label class="op-prio-chk">
                <input type="checkbox" class="rounded text-teal-brand" onchange="opTotalPrioToggle(this.dataset.p, this.checked)" data-p="${escapeHTML(x)}">
                <bdi>${escapeHTML(x)}</bdi>
            </label>`).join('');
    }
    listEl.querySelectorAll('input[type=checkbox]').forEach(inp => {
        const on = set.has(inp.dataset.p);
        inp.checked = on;
        inp.parentElement.classList.toggle('is-on', on);
    });
}
function opTotalPrioToggle(p, on) { const set = opTotalPrioSet(); if (on) set.add(p); else set.delete(p); renderOpiumReport(); }
function opTotalPrioSetAll(on) { opiumUI.totalPrios = new Set(on ? opAllPrioOptions() : []); renderOpiumReport(); }

// جدول گزارش خلاصه: یک ردیف عنوان + یک ردیف اطلاعات؛ هر سلول مستقل است و مقادیر چندگانه، سطر به سطر (بدون جمله‌ی طولانی) نمایش داده می‌شوند.
function opSummaryTableHTML(d, print) {
    const sm = d.summary;
    const P = n => toPersianDigits(n);
    const line = (k, v, cls) => print
        ? `<div style="display:flex;justify-content:space-between;gap:8px;line-height:1.7;${cls === 'total' ? 'font-weight:800;' : ''}"><span><bdi>${escapeHTML(k)}</bdi>:</span><span>${v}</span></div>`
        : `<div class="op-sum-line ${cls === 'total' ? 'op-sum-total' : ''}"><span class="op-k"><bdi>${escapeHTML(k)}</bdi>:</span><span class="op-v font-yekan">${v}</span></div>`;
    const sep = print ? '<div style="border-top:1px solid #000;margin:3px 0;"></div>' : '<div class="op-sum-sep"></div>';
    const box = html => print ? `<div style="display:inline-block;min-width:90px;text-align:right;">${html}</div>` : `<div class="op-sum-box">${html}</div>`;
    const big = html => print ? `<b style="font-size:11pt;">${html}</b>` : `<span class="op-sum-big font-yekan">${html}</span>`;
    const muted = t => print ? `<div style="font-size:7pt;">${t}</div>` : `<div class="op-sum-muted">${t}</div>`;
    const warn = t => print ? `<b>${t}</b>` : `<span class="op-sum-warn">${t}</span>`;
    const dash = '—';

    const cTotal = big(P(sm.total)) + ' <span>نفر</span>';
    const cReceived = big(P(sm.received)) + ' <span>نفر</span>';
    const cVolume = d.selList.length
        ? box(d.selByPrio.map(a => line(a[0], opFmt(a[1], 2) + ' سی‌سی')).join('') + sep + line('مجموع', opFmt(d.selVolume, 2) + ' سی‌سی', 'total'))
        : warn('اولویتی انتخاب نشده است');
    const cSyrup = d.selList.length
        ? big(opFmt(d.selSyrup, 3)) + ' <span>شربت</span>'
          + muted('هر شربت ' + P(OPIUM_SYRUP_CC) + ' سی‌سی')
          + muted('شربت کامل: ' + opFmt(Math.floor(d.selSyrup + 1e-9), 0))
        : dash;
    const cPrio = sm.prio.length ? box(sm.prio.map(a => line(a[0], P(a[1]))).join('')) : dash;
    const cDay = sm.wk.length ? box(sm.wk.map(a => line(a[0], P(a[1]))).join('')) : dash;

    const heads = ['جمع کل بیماران', 'تعداد تحویل واقعی', 'مجموع حجم تحویل‌شده به اولویت‌های انتخاب‌شده', 'معادل شربتی', 'تعداد افراد در هر اولویت', 'تعداد افراد در هر روز'];
    const cells = [cTotal, cReceived, cVolume, cSyrup, cPrio, cDay];
    if (print) {
        return `<style>
            table.op-print-sum { width: 100% !important; table-layout: auto !important; border-collapse: collapse !important; border: 1px solid #000 !important; font-size: 8.5pt !important; margin-top: 14px; }
            table.op-print-sum th, table.op-print-sum td { border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; vertical-align: top !important; background: #fff !important; color: #000 !important; }
            table.op-print-sum th { font-weight: 800 !important; background: #f1f5f9 !important; vertical-align: middle !important; }
        </style>
        <table class="op-print-sum"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody><tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr></tbody></table>`;
    }
    return `<table class="op-sum-table text-right">
        <thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody><tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr></tbody>
    </table>`;
}

// عنوان ستون‌های طولانی را (فقط در نمایش) دو خطی می‌کند تا عرض ستون کمتر شود؛ متن اصلی عنوان (برای اکسل و فهرست انتخاب ستون چاپ) تغییری نمی‌کند.
function opHeadHTML(c) {
    const t = String(c.l || '');
    if (c.k === 'name' || t.length <= 11 || t.indexOf(' ') < 0) return t;
    const w = t.split(' ');
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < w.length; i++) {
        const diff = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return w.slice(0, best).join(' ') + '<br>' + w.slice(best).join(' ');
}
function renderOpiumReport() {
    const head = document.getElementById('opium-report-head');
    if (!head) return;
    opFillFilterSelects();
    opRenderTotalPrioControl();
    const d = opReportData();
    const pos = {}; d.sort.forEach((s, i) => { pos[s.key] = i; });
    head.innerHTML = `<tr class="bg-slate-100 text-slate-600 text-[11px] font-bold border-b border-gray-200">${d.cols.map(c => {
        if (c.noSort) return `<th class="p-3 whitespace-nowrap ${c.cls || ''}">${opHeadHTML(c)}</th>`;
        const active = c.k in pos;
        const dir = active ? d.sort[pos[c.k]].dir : '';
        const badge = active ? `<span class="inline-flex items-center justify-center min-w-[16px] h-4 px-1 mr-1 rounded-full bg-teal-brand text-white text-[9px] font-yekan font-bold" title="اولویت مرتب‌سازی">${toPersianDigits(pos[c.k] + 1)}</span>` : '';
        return `<th class="p-3 cursor-pointer select-none hover:bg-slate-200 whitespace-nowrap ${c.cls || ''}" title="کلیک: مرتب‌سازی — Shift+کلیک: افزودن معیار بعدی" onclick="opReportSortBy('${c.k}', event)">${opHeadHTML(c)} <i class="fa-solid ${active ? (dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort'} text-[9px] ${active ? 'text-teal-brand' : 'text-slate-300'}"></i>${badge}</th>`;
    }).join('')}</tr>`;
    const bar = document.getElementById('opium-report-sortbar');
    if (bar) {
        const chips = d.sort.map((s, i) => `<span class="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-[10px] font-bold">${toPersianDigits(i + 1)}. ${escapeHTML(s.label)} <i class="fa-solid ${s.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'} text-[9px]"></i></span>`).join('');
        bar.innerHTML = `<span class="text-[10px] font-bold text-slate-500">مرتب‌سازی:</span>${chips || '<span class="text-[10px] font-bold text-slate-400">پیش‌فرض</span>'}
            <button type="button" onclick="opReportSortClear()" ${d.sort.length ? '' : 'disabled'} class="px-2 py-1 bg-white border border-gray-300 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg text-[10px] font-bold transition disabled:opacity-40 disabled:pointer-events-none"><i class="fa-solid fa-xmark ml-1"></i>پاک‌کردن مرتب‌سازی</button>
            <span class="text-[10px] text-slate-400 font-bold">برای مرتب‌سازی ترکیبی، Shift را نگه دارید و روی سرستون‌های بعدی کلیک کنید.</span>`;
    }
    const fd = document.getElementById('opium-farthest-date'), fw = document.getElementById('opium-farthest-weekday');
    if (fd) { fd.textContent = d.farthest ? toPersianDigits(d.farthest) : '—'; if (fw) fw.textContent = d.farthest ? '(' + opWeekday(d.farthest) + ')' : ''; }
    document.getElementById('opium-report-body').innerHTML = d.rows.length
        ? d.rows.map(r => `<tr class="hover:bg-slate-50 ${r.carry ? 'bg-rose-50/60' : ''}"${r.carry ? ' title="تحویل قبلی (خارج از بازه) — فقط برای پیگیری تأخیر نمایش داده شده و در جمع مصرف نیامده است"' : ''}>${d.cols.map(c => `<td class="px-3 py-2 ${['name', 'status', 'weekday', 'priority', 'nextday', 'shift', 'actions'].includes(c.k) ? '' : 'font-yekan'} whitespace-nowrap ${c.cls || ''}">${c.fmt(r)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${d.cols.length}" class="p-8 text-center text-slate-400 font-bold">${d.range.error ? escapeHTML(d.range.error) : 'در این بازه تحویل واقعی ثبت نشده است.'}</td></tr>`;
    const sumEl = document.getElementById('opium-report-summary');
    if (sumEl) sumEl.innerHTML = opSummaryTableHTML(d, false)
        + (d.carryCount ? `<div class="mt-2 text-[11px] font-bold text-rose-700">${toPersianDigits(d.carryCount)} بیمار با «تأخیر در مراجعه» فقط برای پیگیری نمایش داده شده‌اند و در جمع مصرف نیامده‌اند.</div>` : '');
}

function opiumExportReportCSV() {
    const d = opReportData();
    if (!d.rows.length) { showToast('گزارشی برای خروجی گرفتن وجود ندارد.', 'warning'); return; }
    const esc = v => { let s = v == null ? '' : String(v); if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
    const xc = d.cols.filter(c => !c.noExport);
    const lines = [xc.map(c => esc(c.l)).join(',')];
    d.rows.forEach(r => lines.push(xc.map(c => esc(c.csv(r))).join(',')));
    lines.push(d.selList.length
        ? ['جمع کل', `تحویل‌ها: ${d.deliveries}`, `${d.selLabel} (سی‌سی): ${d.selVolume}`, `معادل شربت: ${opRound(d.selSyrup, 3)}`].map(esc).join(',')
        : ['جمع کل', `تحویل‌ها: ${d.deliveries}`, 'لطفاً حداقل یک اولویت را انتخاب کنید'].map(esc).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nasim_rahayi_opium_report_${getShamsiToday().replace(/\//g, '-')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('خروجی اکسل (CSV) گزارش مصرف اپیوم دانلود شد.');
}

// ---- انتخاب ستون‌های چاپ (فقط روی نسخه چاپی اثر دارد) ----
function openOpiumPrintColsModal() {
    const d = opReportData();
    if (!d.rows.length) { showToast('گزارشی برای چاپ وجود ندارد.', 'warning'); return; }
    // پیش‌فرض: همه‌ی ستون‌های جدول انتخاب‌اند، جز «اقدام» که عملیات نرم‌افزاری است
    opiumUI.printCols = d.cols.map(c => ({ k: c.k, l: c.l, on: c.k !== 'actions' }));
    opRenderPrintColsList();
    document.getElementById('opium-print-cols-modal').classList.remove('hidden');
    lockBackgroundScroll();
}
function closeOpiumPrintColsModal() {
    document.getElementById('opium-print-cols-modal').classList.add('hidden');
    unlockBackgroundScroll();
}
function opRenderPrintColsList() {
    document.getElementById('opium-print-cols-list').innerHTML = (opiumUI.printCols || []).map((c, i) => `
        <label class="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" class="rounded text-teal-brand w-4 h-4" ${c.on ? 'checked' : ''} onchange="opPrintColToggle(${i}, this.checked)">
            <span class="font-bold text-slate-700">${escapeHTML(c.l)}${c.k === 'actions' ? ' <span class="text-[10px] font-bold text-slate-400">(ستون خالی برای یادداشت دستی؛ دکمه‌های نرم‌افزار چاپ نمی‌شوند)</span>' : ''}</span>
        </label>`).join('');
}
function opPrintColToggle(i, on) { if (opiumUI.printCols && opiumUI.printCols[i]) opiumUI.printCols[i].on = !!on; }
function opPrintColsSetAll(on) { (opiumUI.printCols || []).forEach(c => c.on = on); opRenderPrintColsList(); }
function confirmOpiumPrintCols() {
    const keys = (opiumUI.printCols || []).filter(c => c.on).map(c => c.k);
    if (!keys.length) { showToast('حداقل یک ستون را برای چاپ انتخاب کنید.', 'error'); return; }
    closeOpiumPrintColsModal();
    opiumPrintReport(keys);
}

function opiumPrintReport(keys) {
    const d = opReportData();
    const pc = d.cols.filter(c => keys ? keys.includes(c.k) : c.k !== 'actions');
    const cell = (c, r) => (c.pfmt || c.fmt)(r);
    const hasName = pc.some(c => c.k === 'name');
    const namePct = pc.length >= 8 ? 26 : 32;
    const otherPct = hasName ? (100 - namePct) / (pc.length - 1) : 100 / pc.length;
    const colgroup = `<colgroup>${pc.map(c => `<col style="width:${(c.k === 'name' ? namePct : otherPct).toFixed(2)}%">`).join('')}</colgroup>`;
    const thead = `<tr>${pc.map(c => `<th${c.k === 'name' ? ' class="op-pn"' : ''}>${opHeadHTML(c)}</th>`).join('')}</tr>`;
    const tbody = d.rows.length
        ? d.rows.map(r => `<tr>${pc.map(c => `<td${c.k === 'name' ? ' class="op-pn"' : ''}>${cell(c, r)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${pc.length}">در این بازه تحویل واقعی ثبت نشده است.</td></tr>`;
    const area = document.getElementById('printable-report-area');
    deactivateAllPrintAreas();
    area.classList.add('print-active');
    area.innerHTML = `
        <h2 class="text-lg font-black text-center mb-1">${escapeHTML(window.settings.displayTitle || window.settings.clinicName || '')}</h2>
        <h3 class="text-sm font-bold text-center mb-1 text-slate-600">گزارش مصرف اپیوم — تاریخ چاپ: ${toPersianDigits(getShamsiToday())}</h3>
        <p class="text-xs font-bold text-center mb-4 text-slate-500">${escapeHTML(opRangeText(d.range))}</p>
        <style>
            table.op-print-table { width: 100% !important; margin: 0 auto !important; table-layout: fixed !important; border-collapse: collapse !important; border: 1px solid #000 !important; font-size: 8.5pt !important; }
            table.op-print-table th, table.op-print-table td { border: 1px solid #000 !important; padding: 0 2px !important; overflow: visible !important; line-height: 1.3 !important; text-align: center !important; vertical-align: middle !important; background: #fff !important; color: #000 !important; white-space: nowrap !important; }
            table.op-print-table th { font-weight: 800 !important; background: #f1f5f9 !important; white-space: normal !important; padding: 2px 2px !important; }
            table.op-print-table td * { text-align: center !important; color: #000 !important; }
        </style>
        <table class="op-print-table">
            ${colgroup}
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
        ${opSummaryTableHTML(d, true)}
        ${d.carryCount ? `<p class="text-[11px] font-bold mt-2" style="color:#b91c1c;">${toPersianDigits(d.carryCount)} ردیف با وضعیت «تأخیر در مراجعه» مربوط به تحویل قبلی (خارج از بازه) است و در جمع مصرف نیامده است.</p>` : ''}`;
    document.getElementById('print-preview-content').innerHTML = area.innerHTML;
    document.getElementById('print-preview-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

// The Jalali datepicker sets the value programmatically, so listen to its own event as well.
(function opBindDateEvents() {
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) { el.addEventListener('jdp:change', fn); el.addEventListener('change', fn); } };
    bind('opium-range-from', opOnRangeChange);
    bind('opium-range-to', opOnRangeChange);
    bind('op-d-date', () => opDelRecalc());
})();

// ---------- Page entry ----------
function renderOpiumPage() {
    const tab = document.getElementById('tab-opium');
    if (!tab) return;
    opFillFilterSelects();
    renderOpiumStats();
    renderOpiumTable();
    renderOpiumReport();
    // هر دو تب همیشه به‌روز نگه داشته می‌شوند؛ فقط نمایش تب فعلی (بدون پاک‌کردن فیلترها) اعمال می‌شود.
    switchOpiumSubTab(opiumUI.subTab || 'list');
}

