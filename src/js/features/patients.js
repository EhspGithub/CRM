// نسیم رهایی — پذیرش و مدیریت مراجعین
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// =====================================================================================
// سابقه اقامت در کمپ
// -------------------------------------------------------------------------------------
// روی پرونده‌ی بیمار دو فیلد:
//   campHistory : 'دارد' | 'ندارد'   (برای پرونده‌های قدیمی که هنوز ثبت نشده: undefined = «ثبت نشده»)
//   campStays   : [{ start: '1403/01/05', end: '1403/02/10' | '' }]   — به ترتیب تاریخ شروع
// پایان خالی یعنی تاریخ پایان نامشخص است یا بیمار هنوز در کمپ است.
// ویرایشگر (تیک + ردیف‌های تاریخ) هم در فرم پذیرش (پیشوند «p») و هم در ویرایش سریع پرونده (پیشوند «m-p») استفاده می‌شود.
// =====================================================================================
function campNormDate(s) {
    const t = toEnglishDigits(String(s == null ? '' : s)).replace(/[-.]/g, '/').replace(/\s+/g, '');
    const m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1300 || y > 1500 || mo < 1 || mo > 12 || d < 1 || d > (mo <= 6 ? 31 : 30)) return null;
    return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}
function campDateMs(s) {
    const n = campNormDate(s);
    if (!n) return null;
    const [gy, gm, gd] = jalaliToGregorian(...n.split('/'));
    return Date.UTC(gy, gm - 1, gd);
}
// تعداد روزهای اقامت (روز شروع و روز پایان هر دو حساب می‌شوند)
function campStayDays(stay) {
    const a = campDateMs(stay && stay.start), b = campDateMs(stay && stay.end);
    if (a === null || b === null || b < a) return null;
    return Math.round((b - a) / 86400000) + 1;
}
function campStaysOf(p) {
    return (p && Array.isArray(p.campStays) ? p.campStays : [])
        .map(s => ({ start: campNormDate(s && s.start) || '', end: campNormDate(s && s.end) || '' }))
        .filter(s => s.start || s.end);
}
function campHas(p) { return !!p && (p.campHistory === 'دارد' || campStaysOf(p).length > 0); }
function campSummary(p) {
    const stays = campStaysOf(p);
    let total = 0, known = 0, lastMs = null, last = null;
    stays.forEach(s => {
        const d = campStayDays(s);
        if (d !== null) { total += d; known++; }
        const ms = campDateMs(s.end) ?? campDateMs(s.start);
        if (ms !== null && (lastMs === null || ms > lastMs)) { lastMs = ms; last = s; }
    });
    return { has: campHas(p), recorded: !!p && (p.campHistory === 'دارد' || p.campHistory === 'ندارد' || stays.length > 0), count: stays.length, totalDays: total, knownDays: known, lastMs, last, stays };
}
// متن کوتاه برای گزارش، اکسل و ثبت تغییرات
function campSummaryText(p, persian = true) {
    const s = campSummary(p);
    const f = persian ? toPersianDigits : (x => String(x));
    if (!s.recorded) return 'ثبت نشده';
    if (!s.has) return 'ندارد';
    if (!s.count) return 'دارد (تاریخ ثبت نشده)';
    const parts = [`${f(s.count)} بار`];
    if (s.knownDays) parts.push(`${f(s.totalDays)} روز`);
    const last = s.last;
    if (last) parts.push(`آخرین: ${f(last.start || '?')} تا ${last.end ? f(last.end) : 'نامشخص'}`);
    return parts.join(' · ');
}
// آیا در N روز گذشته در کمپ بوده (هر بخشی از یک دوره‌ی اقامت در این بازه باشد)
function campWithinDays(p, days) {
    const now = Date.now(), from = now - days * 86400000;
    return campStaysOf(p).some(s => {
        const a = campDateMs(s.start), b = s.end ? campDateMs(s.end) : now;
        return a !== null && b !== null && b >= from && a <= now;
    });
}

// ---------- ویرایشگر ----------
function campRowHTML(stay) {
    const st = stay || {};
    const dateInput = (kind, label, val) => `
        <div class="min-w-0">
            <label class="block text-[10px] font-bold text-slate-500 mb-1">${label}</label>
            <input type="text" data-jdp data-camp="${kind}" value="${escapeHTML(val ? toPersianDigits(val) : '')}" placeholder="روز/ماه/سال"
                class="w-full px-2 py-1.5 border border-gray-300 rounded-xl text-xs text-center font-yekan outline-none focus:ring-2 focus:ring-amber-300/50 bg-white">
        </div>`;
    return `
        <div class="camp-row grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end bg-white p-2 rounded-xl border border-amber-100">
            <span class="camp-row-no w-6 h-6 mb-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black flex items-center justify-center font-yekan"></span>
            ${dateInput('start', 'شروع اقامت', st.start)}
            ${dateInput('end', 'پایان اقامت', st.end)}
            <button type="button" onclick="campRemoveRow(this)" title="حذف این دوره" class="w-8 h-8 mb-0.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>`;
}
function campEditorHTML(prefix, p) {
    const has = campHas(p);
    const stays = campStaysOf(p);
    return `
        <div id="${prefix}-camp" class="camp-editor bg-amber-50/50 border border-amber-200/70 rounded-2xl p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input type="checkbox" id="${prefix}-camp-has" onchange="campToggle('${prefix}')" ${has ? 'checked' : ''} class="w-4 h-4 rounded text-amber-600">
                    <i class="fa-solid fa-campground text-amber-600"></i>
                    سابقه اقامت در کمپ دارد
                </label>
                <span id="${prefix}-camp-count" class="text-[10px] font-bold text-amber-700"></span>
            </div>
            <div id="${prefix}-camp-body" class="${has ? '' : 'hidden'} mt-2.5 space-y-2">
                <div id="${prefix}-camp-rows" class="space-y-2 md:max-w-2xl">${stays.map(campRowHTML).join('')}</div>
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="campAddRow('${prefix}')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-sm transition flex items-center gap-1.5">
                        <i class="fa-solid fa-plus"></i> افزودن دوره اقامت
                    </button>
                    <span class="text-[10px] text-slate-500">اگر تاریخ پایان معلوم نیست یا بیمار هنوز در کمپ است، پایان را خالی بگذارید.</span>
                </div>
            </div>
        </div>`;
}
function campRenumber(prefix) {
    const rows = document.querySelectorAll(`#${prefix}-camp-rows .camp-row`);
    rows.forEach((r, i) => { const n = r.querySelector('.camp-row-no'); if (n) n.textContent = toPersianDigits(i + 1); });
    const c = document.getElementById(`${prefix}-camp-count`);
    const on = document.getElementById(`${prefix}-camp-has`);
    if (c) c.textContent = on && on.checked && rows.length ? `${toPersianDigits(rows.length)} دوره` : '';
}
function campAddRow(prefix, stay) {
    const box = document.getElementById(`${prefix}-camp-rows`);
    if (!box) return;
    box.insertAdjacentHTML('beforeend', campRowHTML(stay));
    if (typeof bindDigitConverters === 'function') bindDigitConverters();
    campRenumber(prefix);
}
function campRemoveRow(btn) {
    const editor = btn.closest('.camp-editor');
    btn.closest('.camp-row').remove();
    if (editor) campRenumber(editor.id.replace(/-camp$/, ''));
}
function campToggle(prefix) {
    const on = document.getElementById(`${prefix}-camp-has`).checked;
    document.getElementById(`${prefix}-camp-body`).classList.toggle('hidden', !on);
    if (on && !document.querySelector(`#${prefix}-camp-rows .camp-row`)) campAddRow(prefix);
    campRenumber(prefix);
}
// خواندن و اعتبارسنجی. خروجی: { ok, error, campHistory, campStays }
function campRead(prefix) {
    const has = !!(document.getElementById(`${prefix}-camp-has`) || {}).checked;
    if (!has) return { ok: true, campHistory: 'ندارد', campStays: [] };
    const stays = [];
    const rows = document.querySelectorAll(`#${prefix}-camp-rows .camp-row`);
    for (let i = 0; i < rows.length; i++) {
        const rawS = rows[i].querySelector('[data-camp="start"]').value.trim();
        const rawE = rows[i].querySelector('[data-camp="end"]').value.trim();
        if (!rawS && !rawE) continue;                                   // ردیف خالی نادیده گرفته می‌شود
        const n = toPersianDigits(i + 1);
        const s = campNormDate(rawS), e = rawE ? campNormDate(rawE) : '';
        if (!rawS) return { ok: false, error: `در ردیف ${n} سابقه کمپ، تاریخ شروع اقامت را وارد کنید.` };
        if (!s) return { ok: false, error: `تاریخ شروع اقامت در ردیف ${n} معتبر نیست (نمونه: ۱۴۰۳/۰۲/۱۵).` };
        if (e === null) return { ok: false, error: `تاریخ پایان اقامت در ردیف ${n} معتبر نیست (نمونه: ۱۴۰۳/۰۳/۱۵).` };
        if (e && campDateMs(e) < campDateMs(s)) return { ok: false, error: `در ردیف ${n} سابقه کمپ، تاریخ پایان قبل از تاریخ شروع است.` };
        stays.push({ start: s, end: e });
    }
    stays.sort((a, b) => campDateMs(a.start) - campDateMs(b.start));
    return { ok: true, campHistory: 'دارد', campStays: stays };
}
// فرم پذیرش: ویرایشگر را (خالی یا با اطلاعات بیمار در حالت ویرایش کامل) در جای خودش می‌سازد
function campMountAdmission(p) {
    const mount = document.getElementById('p-camp-mount');
    if (!mount) return;
    mount.innerHTML = campEditorHTML('p', p || null);
    campRenumber('p');
}
document.addEventListener('DOMContentLoaded', () => campMountAdmission(null));
if (document.readyState !== 'loading') campMountAdmission(null);
document.addEventListener('reset', (e) => { if (e.target && e.target.id === 'patientForm') campMountAdmission(null); }, true);

// نمایش در پرونده‌ی بیمار
function campCardHTML(p) {
    const s = campSummary(p);
    let body;
    if (!s.recorded) {
        body = `<span class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">ثبت نشده — از «ویرایش سریع» تکمیل کنید</span>`;
    } else if (!s.has) {
        body = `<span class="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1.5"><i class="fa-solid fa-circle-check text-emerald-500 text-[9px]"></i> سابقه اقامت در کمپ ندارد</span>`;
    } else if (!s.count) {
        body = `<span class="px-2 py-0.5 bg-amber-100/70 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold">دارد — تاریخ‌ها ثبت نشده</span>`;
    } else {
        body = s.stays.map((st, i) => {
            const d = campStayDays(st);
            return `<span class="px-2 py-0.5 bg-white text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold font-yekan shadow-sm">
                ${toPersianDigits(i + 1)}) ${toPersianDigits(st.start || '?')} تا ${st.end ? toPersianDigits(st.end) : 'نامشخص'}${d !== null ? ` <span class="text-amber-500">(${toPersianDigits(d)} روز)</span>` : ''}
            </span>`;
        }).join('');
    }
    const head = s.has && s.count ? `<span class="text-[10px] font-black text-amber-700 font-yekan">${toPersianDigits(s.count)} بار${s.knownDays ? ` · مجموع ${toPersianDigits(s.totalDays)} روز` : ''}</span>` : '';
    return `
        <div class="p-2 bg-amber-50/40 rounded-xl border border-amber-100 flex flex-col justify-center w-full">
            <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[10px] text-amber-700 font-bold flex items-center gap-1.5"><i class="fa-solid fa-campground"></i> سابقه اقامت در کمپ</span>
                ${head}
            </div>
            <div class="flex flex-wrap gap-1.5">${body}</div>
        </div>`;
}

// 2. PATIENT ADMISSION / INTAKE FORM
function handleFormSubmit(event) {
    event.preventDefault();

    const birthdate = document.getElementById('p-birthdate').value;
    const nationalId = normalizeIdentifierValue(document.getElementById('p-nationalId').value);

    // Basic validation check — the national ID field is OPTIONAL. Only validate its
    // format/uniqueness when the user actually entered something; an empty value is a
    // valid, permanent state (e.g. imported records or people without a national ID yet)
    // and must never block saving or trigger an "invalid national ID" error.
    if (nationalId && !validateIranianNationalId(nationalId)) {
        showCustomAlert("خطای پذیرش مراجع", "کد ملی وارد شده نامعتبر است!");
        return;
    }

    const campData = campRead('p');
    if (!campData.ok) {
        showCustomAlert("خطای سابقه اقامت در کمپ", campData.error);
        return;
    }

    const isEdit = document.getElementById('form-edit-id').value;
    const targetId = isEdit ? isEdit : crypto.randomUUID();

    // Check for duplicate patient code in database on submit (covers both new admissions
    // and full-edit of an existing patient — isEdit is excluded from the check).
    const pCodeVal = parseInt(document.getElementById('p-code').value);
    if (isPatientCodeTaken(pCodeVal, isEdit)) {
        showCustomAlert("خطای پذیرش مراجع", "کد پرونده وارد شده تکراری است. لطفاً یک کد یکتا اختصاص دهید!");
        return;
    }

    // Check for duplicate national ID in database on submit — only meaningful when a
    // national ID was actually provided; several patients may legitimately have none.
    const isDuplicate = nationalId && window.patients.some(p => p.nationalId === nationalId && p.id !== isEdit);
    if (isDuplicate) {
        showCustomAlert("خطای پذیرش مراجع", "کد ملی تکراری است و به قسمت مدیریت مراجعین مراجعه کنید");
        return;
    }

    const ageFieldVal = parseInt(document.getElementById('p-age').value);

    // Gathers selected diseases checklist
    const medHistories = [];
    document.querySelectorAll('input[name="p-med"]:checked').forEach(chk => {
        medHistories.push(chk.value);
    });

    // Validate Reason of Inactivity if "غیرفعال" selected
    const statusVal = document.getElementById('p-status').value;
    const deactiveReasonVal = document.getElementById('p-deactiveReason').value;
    const deactiveNotesVal = document.getElementById('p-deactiveNotes').value || '';

    if (statusVal === 'غیرفعال' && !deactiveReasonVal) {
        showCustomAlert("اطلاعات ناقص", "لطفاً علت غیرفعال شدن پرونده را انتخاب کنید!");
        return;
    }

    const editingPatient = isEdit ? window.patients.find(p => p.id === isEdit) : null;

    const patientPayload = {
        id: targetId,
        code: parseInt(document.getElementById('p-code').value),
        fullName: document.getElementById('p-fullName').value,
        nationalId: nationalId,
        birthdate: birthdate,
        age: ageFieldVal,
        gender: document.querySelector('input[name="p-gender"]:checked').value,
        marital: document.getElementById('p-marital').value,
        employment: document.getElementById('p-employment').value,
        job: document.getElementById('p-job').value,
        phone: normalizeIdentifierValue(document.getElementById('p-phone').value),
        admissionDate: document.getElementById('p-admissionDate').value,
        insurance: document.getElementById('p-insurance').value,
        systemRegistered: document.getElementById('p-systemRegistered').value,
        attempts: document.getElementById('p-attempts').value,
        counselor: document.getElementById('p-counselor').value,
        substance: document.getElementById('p-substance').value,
        substanceOther: document.getElementById('p-substanceOther').value || '',
        startAge: parseInt(document.getElementById('p-startAge').value) || 0,
        duration: parseInt(document.getElementById('p-duration').value) || 0,
        medHistory: medHistories,
        campHistory: campData.campHistory,
        campStays: campData.campStays,
        medicalNotes: document.getElementById('p-medicalNotes').value,
        initialDrug: document.getElementById('p-drug').value,
        initialDosage: parseFloat(document.getElementById('p-dosage').value) || 0,
        initialPriority: document.getElementById('p-drug').value === 'اپیوم' ? document.getElementById('p-priority').value : '',
        currentDrug: editingPatient ? editingPatient.currentDrug : document.getElementById('p-drug').value,
        currentDosage: editingPatient ? editingPatient.currentDosage : (parseFloat(document.getElementById('p-dosage').value) || 0),
        currentPriority: editingPatient ? editingPatient.currentPriority : (document.getElementById('p-drug').value === 'اپیوم' ? document.getElementById('p-priority').value : ''),
        status: statusVal,
        attendance: statusVal === 'غیرفعال' ? 'غیبت' : document.getElementById('p-attendance').value,
        deactiveReason: statusVal === 'غیرفعال' ? deactiveReasonVal : '',
        deactiveNotes: statusVal === 'غیرفعال' ? deactiveNotesVal : ''
    };

    // محل پرونده: ثبت جدید ← از نوع حضور؛ ویرایش ← مقدار قبلی حفظ می‌شود و فقط با تغییر نوع حضور هماهنگ می‌شود
    patientPayload.fileStatus = editingPatient ? getPatientFileStatus(editingPatient) : (statusVal === 'غیرفعال' ? 'بایگانی' : 'فعال');
    if (editingPatient && editingPatient.status !== patientPayload.status) {
        applyFileStatusRule(patientPayload, patientPayload.status);
    }

    if (isEdit) {
        // Find existing, compare for Audit logging
        const existingIndex = window.patients.findIndex(p => p.id === isEdit);
        const original = window.patients[existingIndex];

        if (original.fullName !== patientPayload.fullName) logChange(targetId, "نام و نام خانوادگی", original.fullName, patientPayload.fullName);
        if (original.phone !== patientPayload.phone) logChange(targetId, "تلفن اضطراری", original.phone, patientPayload.phone);
        if (original.counselor !== patientPayload.counselor) logChange(targetId, "مشاور (روانشناس)", original.counselor, patientPayload.counselor);
        if (original.status !== patientPayload.status) logChange(targetId, "نوع حضور", original.status, patientPayload.status);
        if (original.attendance !== patientPayload.attendance) logChange(targetId, "نظم حضور", original.attendance, patientPayload.attendance);
        if (getPatientFileStatus(original) !== patientPayload.fileStatus) logChange(targetId, "محل پرونده (بایگانی / معلق / حذف)", getPatientFileStatus(original), patientPayload.fileStatus);
        if (original.deactiveReason !== patientPayload.deactiveReason) logChange(targetId, "علت غیرفعال‌سازی", original.deactiveReason || "-", patientPayload.deactiveReason || "-");
        const campBefore = campSummaryText(original), campAfter = campSummaryText(patientPayload);
        if (campBefore !== campAfter) logChange(targetId, "سابقه اقامت در کمپ", campBefore, campAfter);

        window.patients[existingIndex] = patientPayload;
        showToast(`اطلاعات مراجع ${patientPayload.fullName} با موفقیت ویرایش شد.`);
    } else {
        window.patients.unshift(patientPayload);
        showToast(`مراجع جدید ${patientPayload.fullName} با موفقیت پذیرش شد.`);
    }

    dbPutRecord('patients', patientPayload);
    triggerBackupReminder();

    document.getElementById('patientForm').reset();
    document.getElementById('form-edit-id').value = '';
    document.getElementById('btn-submit-form').innerText = "ثبت";
    document.getElementById('national-id-err').classList.add('hidden');
    document.getElementById('national-id-dup-err').classList.add('hidden');
    document.getElementById('p-code-dup-err').classList.add('hidden');
    updateLastPatientCodeHint();

    // Clear extra layout structures
    document.getElementById('deactive-reason-container').classList.add('hidden');
    switchTab('patients-list');
}

// 3. PATIENTS DIRECTORY tab
function filterDirectory(resetPage = true) {
    const q = document.getElementById('search-m-query').value.toLowerCase();
    const substance = document.getElementById('search-m-substance').value;
    const drug = document.getElementById('search-m-drug').value;
    const status = document.getElementById('search-m-status').value;
    const fileStatus = document.getElementById('search-m-filestatus').value;

    const filtered = window.patients.filter(p => {
        const patName = p.fullName || (p.name + ' ' + p.lastname);
        const termMatch = patName.toLowerCase().includes(q) || 
                          p.code.toString().includes(q) || 
                          p.phone.includes(q) || 
                          (p.nationalId || '').includes(q);

        const subMatch = substance === '' || p.substance === substance;

        let drugMatch = drug === '' || p.currentDrug === drug;
        if (drug === 'داروی نامعلوم') {
            drugMatch = !p.currentDrug || !['روان درمانی', 'ش متادون', 'ق متادون', 'بوپرنورفین', 'اپیوم', 'متقاضی اپیوم'].includes(p.currentDrug);
        }

        const statusMatch = status === '' || p.status === status;
        const fileStatusMatch = fileStatus === '' || getPatientFileStatus(p) === fileStatus;

        return termMatch && subMatch && drugMatch && statusMatch && fileStatusMatch;
    });

    // مرتب‌سازی صعودی: از کد کمتر در بالا به کد بیشتر در پایین
    filtered.sort((a, b) => Number(a.code) - Number(b.code));

    tableState.patients.data = filtered;
    if (resetPage) tableState.patients.page = 1;
    renderPaginatedPatients();
}

function renderPatientsList(customList = null) {
    if (customList) {
        tableState.patients.data = customList;
        tableState.patients.page = 1;
        renderPaginatedPatients();
    } else {
        filterDirectory(false);
    }
}

function renderPaginatedPatients() {
    const tbody = document.getElementById('directory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = tableState.patients.data.length;
    document.getElementById('badge-total-m').innerText = `کل: ${toPersianDigits(total)} بیمار`;

    const limit = tableState.patients.limit;
    let start = limit === 'all' ? 0 : (tableState.patients.page - 1) * limit;
    let end = limit === 'all' ? total : start + limit;
    const paginatedData = tableState.patients.data.slice(start, end);

    // بهینه‌سازی پرفورمنس: استفاده از DocumentFragment برای جلوگیری از رندر مجدد و سنگین DOM
    const fragment = document.createDocumentFragment();

    // تابع کمکی برای اعمال کلاس‌های هایلایت متنی به انواع داروها
    function getDrugHighlightStyle(drugName) {
        if (!drugName) return 'bg-transparent text-slate-400';

        const lowerDrug = drugName.toLowerCase();

        // متقاضی اپیوم (بدون دوز): هایلایت بنفش ملایم — قبل از شرط اپیوم چون شامل کلمهٔ «اپیوم» است
        if (drugName === 'متقاضی اپیوم') {
            return 'bg-violet-100/60 text-violet-800';
        }
        // اپیوم: هایلایت خاکستری ملایم
        if (lowerDrug.includes('اپیوم') || lowerDrug.includes('اوپیوم') || lowerDrug.includes('opium')) {
            return 'bg-slate-100/60 text-slate-700';
        }
        // شربت متادون: هایلایت زرد ملایم
        if (lowerDrug.includes('شربت متادون') || lowerDrug.includes('ش متادون') || lowerDrug === 'ش متادون') {
            return 'bg-amber-100/60 text-amber-800';
        }
        // قرص متادون: هایلایت نارنجی ملایم
        if (lowerDrug.includes('قرص متادون') || lowerDrug.includes('ق متادون') || lowerDrug === 'ق متادون') {
            return 'bg-orange-100/60 text-orange-800';
        }
        // بوپرنورفین: هایلایت فیروزه‌ای/آبی ملایم
        if (lowerDrug.includes('ب۲') || lowerDrug.includes('بوپرنورفین') || lowerDrug.includes('b2')) {
            return 'bg-sky-100/60 text-sky-800';
        }
        // روان درمانی یا موارد متفرقه: هایلایت سبز ملایم
        return 'bg-emerald-100/60 text-emerald-800';
    }

    // PERFORMANCE: build the patientId -> visit lookup once for this render, instead of
    // re-scanning window.visits for every row below.
    const firstVisitByPatient = buildFirstVisitMap(window.visits);

    paginatedData.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-gray-100 text-xs";

        // Resolve Dynamic Inline Softer Color Backgrounds (Pastel Soft Tones) for Select Fields
        const statusClass = (p.status === 'فعال' || p.status === 'فعال می‌باشد (در حال مراجعه / در راه)') 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-rose-50 text-rose-700 border border-rose-200';

        let attClass = 'bg-rose-50 text-rose-700 border border-rose-200';
        if (p.attendance === 'منظم') {
            attClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        } else if (p.attendance === 'نامنظم') {
            attClass = 'bg-amber-50 text-amber-700 border border-amber-200';
        }

        const sysClass = (p.systemRegistered || 'خیر') === 'بله'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-transparent text-slate-500 border border-slate-300';

        // Fetch Last Visit
        const lastVisit = firstVisitByPatient.get(p.id);
        const lastVisitDate = lastVisit ? lastVisit.date : p.admissionDate;

        const fileStatus = getPatientFileStatus(p);
        const fileStatusClass = FILE_STATUS_STYLES[fileStatus];

        tr.innerHTML = `
            <td class="p-4 font-bold text-teal-brand font-yekan">${toPersianDigits(p.code)}</td>
            <td class="p-4">
                <div class="font-bold text-slate-800">${escapeHTML(p.fullName || (p.name + ' ' + p.lastname))}</div>
                <div class="text-[10px] text-gray-400 font-yekan">${toPersianDigits(p.age)} سال | ${escapeHTML(p.marital)}</div>
                <div class="text-[10px] text-gray-400 font-yekan">${toPersianDigits(p.phone)}</div>
            </td>
            <td class="p-4 text-slate-500 font-yekan font-bold">
                <div class="flex items-center gap-1">
                    <span>${toPersianDigits(p.nationalId)}</span>
                    ${p.nationalId ? `<button type="button" onclick="copyCleanValueToClipboard('${escapeHTML(p.nationalId)}', 'کد ملی')" title="کپی کد ملی با فرمت استاندارد (اعداد انگلیسی)" class="text-slate-400 hover:text-teal-brand transition p-1 shrink-0"><i class="fa-regular fa-copy text-[11px]"></i></button>` : ''}
                </div>
            </td>
            <td class="p-4 text-center">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap inline-block ${getDrugHighlightStyle(p.initialDrug)}">
                    ${escapeHTML(p.initialDrug)}${(p.initialDrug === 'اپیوم' && p.initialPriority) ? `<span class="text-slate-300 font-normal mx-0.5">/</span>${escapeHTML(p.initialPriority)}` : ''} ${p.initialDosage ? ` / ${formatDosageHTML(p.initialDrug, p.initialDosage)}` : ''}
                </span>
            </td>
            <td class="p-4 text-center">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap inline-block ${getDrugHighlightStyle(p.currentDrug)}">
                    ${escapeHTML(p.currentDrug)}${(p.currentDrug === 'اپیوم' && p.currentPriority) ? `<span class="text-slate-300 font-normal mx-0.5">/</span>${escapeHTML(p.currentPriority)}` : ''} ${p.currentDosage ? `<span class="text-slate-300 font-normal mx-0.5">/</span>${formatDosageHTML(p.currentDrug, p.currentDosage)}` : ''}
                </span>
            </td>
            <td class="p-2 text-center">
                <div class="flex flex-col items-center gap-1">
                    <select onchange="inlineUpdateStatus('${p.id}', this.value)" title="${p.status === 'غیرفعال' ? escapeHTML('علت غیرفعال‌سازی: ' + (p.deactiveReason || 'علت نامشخص') + (p.deactiveNotes ? ' — ' + p.deactiveNotes : '')) : 'وضعیت حضور (فعال / غیرفعال)'}" class="${statusClass} font-bold text-[10px] rounded-lg px-1.5 py-1 w-[65px] mx-auto block outline-none text-center cursor-pointer shadow-sm transition border-0 focus:ring-2 focus:ring-teal-brand/50">
                        <option value="فعال" ${(p.status === 'فعال' || p.status === 'فعال می‌باشد (در حال مراجعه / در راه)') ? 'selected' : ''} class="bg-white text-slate-800">فعال</option>
                        <option value="غیرفعال" ${p.status === 'غیرفعال' ? 'selected' : ''} class="bg-white text-slate-800">غیرفعال</option>
                    </select>
                    <select onchange="inlineUpdateAttendance('${p.id}', this.value)" title="نظم حضور" class="${attClass} font-bold text-[10px] rounded-lg px-1.5 py-1 w-[65px] mx-auto block outline-none text-center cursor-pointer shadow-sm transition border-0 focus:ring-2 focus:ring-teal-brand/50">
                        <option value="منظم" ${p.attendance === 'منظم' ? 'selected' : ''} class="bg-white text-slate-800">منظم</option>
                        <option value="نامنظم" ${p.attendance === 'نامنظم' ? 'selected' : ''} class="bg-white text-slate-800">نامنظم</option>
                        <option value="غیبت" ${p.attendance === 'غیبت' ? 'selected' : ''} class="bg-white text-slate-800">غیبت</option>
                    </select>
                </div>
            </td>
            <td class="p-2 text-center">
                <select onchange="inlineUpdateFileStatus('${p.id}', this.value)" title="محل پرونده" class="${fileStatusClass} font-bold text-[10px] rounded-lg px-1.5 py-1 w-[78px] mx-auto block outline-none text-center cursor-pointer shadow-sm transition focus:ring-2 focus:ring-teal-brand/50">
                    ${FILE_STATUS_OPTIONS.map(opt => `<option value="${opt}" ${fileStatus === opt ? 'selected' : ''} class="bg-white text-slate-800">${opt}</option>`).join('')}
                </select>
            </td>
            <td class="p-2 text-center">
                <div class="flex flex-col items-center gap-1">
                    <select onchange="inlineUpdateSystemRegistered('${p.id}', this.value)" title="ثبت در سامانه" class="${sysClass} font-bold text-[10px] rounded-lg px-1.5 py-1 w-[65px] mx-auto block outline-none text-center cursor-pointer shadow-sm transition focus:ring-2 focus:ring-teal-brand/50">
                        <option value="بله" ${(p.systemRegistered || 'خیر') === 'بله' ? 'selected' : ''} class="bg-white text-slate-800">بله</option>
                        <option value="خیر" ${(p.systemRegistered || 'خیر') === 'خیر' ? 'selected' : ''} class="bg-white text-slate-800">خیر</option>
                    </select>
                    ${(p.systemRegistered || 'خیر') === 'خیر' ? `<button type="button" onclick="openSystemNotRegisteredModal('${p.id}')" class="text-[10px] text-amber-600 hover:text-amber-800 underline">${p.systemNotRegisteredReason ? 'ویرایش علت' : 'ثبت علت'}</button>` : ''}
                </div>
            </td>
            <td class="p-4 text-slate-500 font-yekan font-bold">${toPersianDigits(lastVisitDate)}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center space-x-1.5 space-x-reverse">
                    <button onclick="openDetailsModal('${p.id}')" class="p-1.5 bg-teal-brand/10 text-teal-brand hover:bg-teal-brand hover:text-white rounded-lg transition" title="شرح پرونده"><i class="fa-solid fa-eye text-xs"></i></button>
                    <button onclick="deletePatientRecord('${p.id}')" class="p-1.5 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition" title="حذف پرونده"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    renderPaginationControls('patients');
}

// ---------- محل پرونده (فعال / بایگانی / حذف پرونده / معلق) ----------
const FILE_STATUS_OPTIONS = ['فعال', 'بایگانی', 'حذف پرونده', 'معلق'];
const FILE_STATUS_STYLES = {
    'فعال': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'بایگانی': 'bg-slate-100 text-slate-600 border border-slate-300',
    'حذف پرونده': 'bg-rose-50 text-rose-700 border border-rose-200',
    'معلق': 'bg-amber-50 text-amber-700 border border-amber-200'
};

// پرونده‌های قدیمی فیلد fileStatus ندارند: مقدار پیش‌فرض از «نوع حضور» (فعال/غیرفعال) به‌دست می‌آید.
function getPatientFileStatus(p) {
    if (p && FILE_STATUS_OPTIONS.includes(p.fileStatus)) return p.fileStatus;
    return (p && p.status === 'غیرفعال') ? 'بایگانی' : 'فعال';
}

// هماهنگی خودکار با «نوع حضور»: غیرفعال ← بایگانی ؛ برگشت به فعال ← فعال (فقط اگر خودکار بایگانی شده بود).
// «حذف پرونده» فقط دستی انتخاب می‌شود و این قاعده هرگز آن را عوض نمی‌کند. «معلق» هم با فعال‌شدن تغییر نمی‌کند.
function applyFileStatusRule(p, newPresenceStatus) {
    const current = getPatientFileStatus(p);
    let next = current;
    if (current !== 'حذف پرونده') {
        if (newPresenceStatus === 'غیرفعال') next = 'بایگانی';
        else if (current === 'بایگانی') next = 'فعال';
    }
    p.fileStatus = next;
    return next;
}

function inlineUpdateFileStatus(id, value) {
    if (!FILE_STATUS_OPTIONS.includes(value)) return;
    const idx = window.patients.findIndex(p => p.id === id);
    if (idx === -1) return;
    const old = getPatientFileStatus(window.patients[idx]);
    window.patients[idx].fileStatus = value;
    if (old !== value) logChange(id, "محل پرونده (بایگانی / معلق / حذف)", old, value);

    dbPutRecord('patients', window.patients[idx]);
    triggerBackupReminder();

    showToast(`محل پرونده مراجع به «${value}» تغییر کرد.`);
    renderPatientsList();
}

// Inline Status Change intercept for "غیرفعال" popup trigger
function inlineUpdateStatus(id, value) {
    if (value === 'غیرفعال') {
        // Revert visual selection state to active first until they complete the deactivate modal form
        renderPatientsList(); 
        openDeactivateModal(id);
    } else {
        const idx = window.patients.findIndex(p => p.id === id);
        if (idx > -1) {
            const old = window.patients[idx].status;
            window.patients[idx].status = value;
            window.patients[idx].deactiveReason = ''; // Clear prior deactivation parameters
            window.patients[idx].deactiveNotes = '';

            const oldFileStatus = getPatientFileStatus(window.patients[idx]);
            const newFileStatus = applyFileStatusRule(window.patients[idx], value);
            if (oldFileStatus !== newFileStatus) logChange(id, "محل پرونده (بایگانی / معلق / حذف)", oldFileStatus, newFileStatus);

            logChange(id, "نوع حضور (سریع)", old, value);

            dbPutRecord('patients', window.patients[idx]);
            triggerBackupReminder();

            showToast("نوع حضور مراجع فوراً فعال شد.");
            renderPatientsList();
            renderDashboard();
        }
    }
}

// Quick Deactivation popup open
function openDeactivateModal(id) {
    const p = window.patients.find(pat => pat.id === id);
    if (!p) return;

    document.getElementById('deactivate-patient-id').value = id;
    document.getElementById('deactivate-patient-details').innerText = `${p.fullName || (p.name + ' ' + p.lastname)} (پرونده: ${p.code} - تلفن تماس: ${p.phone})`;
    document.getElementById('deactivate-reason').value = '';
    document.getElementById('deactivate-notes').value = '';

    // Defensive reset: guarantee the Save button is always usable when the modal opens,
    // even if a previous session left it disabled via an error path.
    const submitBtn = document.getElementById('deactivate-submit-btn');
    if (submitBtn) submitBtn.disabled = false;

    document.getElementById('deactivate-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function closeDeactivateModal() {
    document.getElementById('deactivate-modal').classList.add('hidden');
    unlockBackgroundScroll();
    renderPatientsList();
}

// Handles Quick deactivation submit
function handleDeactivateSubmit(event) {
    event.preventDefault();

    // Guard against duplicate operations from a double-click / double-submit: the
    // button is disabled for the duration of this handler and only re-enabled if we
    // bail out early. On success the modal is closed, which naturally prevents further
    // submits until it's reopened (openDeactivateModal always resets this flag).
    const submitBtn = document.getElementById('deactivate-submit-btn');
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) submitBtn.disabled = true;

    const id = document.getElementById('deactivate-patient-id').value;
    const reason = document.getElementById('deactivate-reason').value;
    const notes = document.getElementById('deactivate-notes').value;

    // Belt-and-suspenders validation in addition to the native `required` attribute on
    // the <select>, since required-field validation can be bypassed in some edge cases
    // (e.g. programmatic form submission).
    if (!reason) {
        showCustomAlert("اطلاعات ناقص", "لطفاً علت غیرفعال شدن پرونده را انتخاب کنید!");
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    const idx = window.patients.findIndex(p => p.id === id);
    if (idx > -1) {
        const oldStatus = window.patients[idx].status;
        const oldReason = window.patients[idx].deactiveReason;

        window.patients[idx].status = 'غیرفعال';
        window.patients[idx].deactiveReason = reason;
        window.patients[idx].deactiveNotes = notes;
        window.patients[idx].attendance = 'غیبت'; // Inactive files default to absent on followups
        const oldFileStatus = getPatientFileStatus(window.patients[idx]);
        const newFileStatus = applyFileStatusRule(window.patients[idx], 'غیرفعال'); // → بایگانی
        if (oldFileStatus !== newFileStatus) logChange(id, "محل پرونده (بایگانی / معلق / حذف)", oldFileStatus, newFileStatus);

        logChange(id, "نوع حضور (سریع به غیرفعال)", oldStatus, "غیرفعال");
        logChange(id, "علت غیرفعال شدن پرونده", oldReason || "-", reason);

        dbPutRecord('patients', window.patients[idx]);
        triggerBackupReminder();

        closeDeactivateModal(); // Now correctly handles scroll unlock and hiding
        showToast(`پرونده مراجع به علت "${reason}" با موفقیت غیرفعال شد.`);

        renderDashboard();
    } else {
        // Patient record vanished (e.g. deleted in another tab) — re-enable so the user
        // isn't stuck with a dead button, and let them close the modal manually.
        if (submitBtn) submitBtn.disabled = false;
    }
}

function inlineUpdateAttendance(id, value) {
    const idx = window.patients.findIndex(p => p.id === id);
    if (idx > -1) {
        const old = window.patients[idx].attendance;
        window.patients[idx].attendance = value;
        logChange(id, "نظم حضور (سریع)", old, value);

        dbPutRecord('patients', window.patients[idx]);
        triggerBackupReminder();

        showToast("نظم حضور مراجع فوراً بروزرسانی شد.");
        renderPatientsList();
        renderDashboard();
    }
}

function inlineUpdateInsurance(id, value) {
    const idx = window.patients.findIndex(p => p.id === id);
    if (idx > -1) {
        const old = window.patients[idx].insurance;
        window.patients[idx].insurance = value;

        // Also log to Insurance History for audit trails
        const newInsLog = {
            id: crypto.randomUUID(),
            patientId: id,
            insuranceStatus: value,
            date: new Date().toLocaleDateString('fa-IR'),
            recordedBy: "دکتر حسن‌پور"
        };
        window.insuranceHistory.unshift(newInsLog);
        dbPutRecord('insuranceHistory', newInsLog);

        logChange(id, "وضعیت بیمه (سریع)", old, value);

        dbPutRecord('patients', window.patients[idx]);
        triggerBackupReminder();

        showToast("وضعیت پوشش بیمه ماهانه بیمار فوراً بروزرسانی شد.");
        renderPatientsList();
        renderDashboard();
    }
}

function inlineUpdateSystemRegistered(id, value) {
    if (value === 'خیر') {
        // Revert visual selection state to "بله" first until they complete the reason popup
        renderPatientsList();
        openSystemNotRegisteredModal(id);
    } else {
        const idx = window.patients.findIndex(p => p.id === id);
        if (idx > -1) {
            const old = window.patients[idx].systemRegistered || 'خیر';
            window.patients[idx].systemRegistered = value;
            // NOTE: systemNotRegisteredReason / systemOtherCenterName are intentionally left
            // untouched here — per spec they must be preserved as history even after switching
            // back to "بله"; they simply stop being shown/used while the current status is "بله".

            logChange(id, "ثبت در سامانه", old, value);

            dbPutRecord('patients', window.patients[idx]);
            triggerBackupReminder();

            showToast("وضعیت ثبت در سامانه فوراً بروزرسانی شد.");
            renderPatientsList();
            renderDashboard();
        }
    }
}

// Popup collecting WHY a patient is not registered in the system, opened whenever the
// "سامانه" dropdown is set to "خیر" (or via the "ویرایش/ثبت علت" link for an existing one).
function openSystemNotRegisteredModal(id) {
    const p = window.patients.find(pat => pat.id === id);
    if (!p) return;

    document.getElementById('sysnotreg-patient-id').value = id;
    document.getElementById('sysnotreg-patient-details').innerText = `${p.fullName || (p.name + ' ' + p.lastname)} (پرونده: ${p.code} - تلفن تماس: ${p.phone})`;
    document.getElementById('sysnotreg-reason').value = p.systemNotRegisteredReason || 'فعلاً ثبت نشده';
    document.getElementById('sysnotreg-othercenter').value = p.systemOtherCenterName || '';
    toggleSysNotRegOtherCenterField();

    const submitBtn = document.getElementById('sysnotreg-submit-btn');
    if (submitBtn) submitBtn.disabled = false;

    document.getElementById('system-not-registered-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function closeSystemNotRegisteredModal() {
    document.getElementById('system-not-registered-modal').classList.add('hidden');
    unlockBackgroundScroll();
    renderPatientsList();
}

// Shows the "نام مرکز دیگر" field only when the selected reason is "ثبت در مرکز دیگر"
function toggleSysNotRegOtherCenterField() {
    const reasonVal = document.getElementById('sysnotreg-reason').value;
    const container = document.getElementById('sysnotreg-othercenter-container');
    if (!container) return;
    container.classList.toggle('hidden', reasonVal !== 'ثبت در مرکز دیگر');
}

function handleSystemNotRegisteredSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('sysnotreg-submit-btn');
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) submitBtn.disabled = true;

    const id = document.getElementById('sysnotreg-patient-id').value;
    const reason = document.getElementById('sysnotreg-reason').value;
    const otherCenter = document.getElementById('sysnotreg-othercenter').value.trim();

    if (!reason) {
        showCustomAlert("اطلاعات ناقص", "لطفاً علت عدم ثبت در سامانه را انتخاب کنید!");
        if (submitBtn) submitBtn.disabled = false;
        return;
    }
    if (reason === 'ثبت در مرکز دیگر' && !otherCenter) {
        showCustomAlert("اطلاعات ناقص", "لطفاً نام مرکز دیگر را وارد کنید!");
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    const idx = window.patients.findIndex(p => p.id === id);
    if (idx > -1) {
        const oldSystemReg = window.patients[idx].systemRegistered || 'خیر';
        const oldReason = window.patients[idx].systemNotRegisteredReason;

        window.patients[idx].systemRegistered = 'خیر';
        window.patients[idx].systemNotRegisteredReason = reason;
        window.patients[idx].systemOtherCenterName = reason === 'ثبت در مرکز دیگر' ? otherCenter : '';

        if (oldSystemReg !== 'خیر') logChange(id, "ثبت در سامانه", oldSystemReg, 'خیر');
        if (oldReason !== reason) logChange(id, "علت عدم ثبت در سامانه", oldReason || "-", reason);

        dbPutRecord('patients', window.patients[idx]);
        triggerBackupReminder();

        closeSystemNotRegisteredModal();
        showToast(`علت عدم ثبت در سامانه با موفقیت ذخیره شد.`);

        renderDashboard();
    } else {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function updateVisitDosageFields(patient, selectedDrug) {
    const containerEl = document.getElementById('v-dosage-container');
    const unitSpan = document.getElementById('v-dosage-unit');
    const dosageInput = document.getElementById('visit-dosage');

    let actualDrug = selectedDrug;
    if (selectedDrug === 'بدون تغییر') {
        actualDrug = patient.currentDrug;
    }

    if (actualDrug === 'روان درمانی' || actualDrug === 'بدون دارو (فقط روان‌درمانی)' || actualDrug === 'متقاضی اپیوم' || !actualDrug) {
        containerEl.classList.add('hidden');
        dosageInput.removeAttribute('required');
        dosageInput.value = 0;
    } else {
        containerEl.classList.remove('hidden');
        dosageInput.setAttribute('required', 'required');

        // Set default to current dosage if drug remains unchanged
        if (selectedDrug === 'بدون تغییر') {
            dosageInput.value = patient.currentDosage || 0;
        }

        if (actualDrug.includes('قرص') || actualDrug.includes('ق ') || actualDrug === 'ق متادون' || actualDrug.includes('بوپرنورفین')) {
            unitSpan.innerText = "میلی‌گرم در روز";
        } else {
            unitSpan.innerText = "سی‌سی در روز";
        }
    }
}

// NEW: Toggle & prefill the "اولویت اپیوم" field in the visit modal. This mirrors
// updateVisitDosageFields()'s handling of the "بدون تغییر" (no change) option: if the
// patient is already on اپیوم and the doctor doesn't change the drug, the field still
// shows (and lets the doctor edit) the patient's current priority — satisfying the
// requirement that priority be changeable during a visit even without a drug change.
function updateVisitPriorityField(patient, selectedDrug) {
    const containerEl = document.getElementById('v-priority-container');
    const priorityInput = document.getElementById('visit-priority');
    if (!containerEl || !priorityInput) return;

    let actualDrug = selectedDrug;
    if (selectedDrug === 'بدون تغییر') {
        actualDrug = patient.currentDrug;
    }

    if (actualDrug === 'اپیوم') {
        containerEl.classList.remove('hidden');
        // Optional field — never forced required.
        // Default to the patient's existing priority; the doctor can still change it.
        priorityInput.value = patient.currentPriority || '';
    } else {
        containerEl.classList.add('hidden');
        priorityInput.removeAttribute('required');
        priorityInput.value = '';
    }
}

function handleVisitDrugChange() {
    const pId = document.getElementById('visit-patient-id').value;
    const patient = window.patients.find(p => p.id === pId);
    if (!patient) return;
    const selectedValue = document.getElementById('visit-drug').value;
    updateVisitDosageFields(patient, selectedValue);
    updateVisitPriorityField(patient, selectedValue);
}

// Trigger Patient Editing Flow
function triggerEditMode(id) {
    const p = window.patients.find(pat => pat.id === id);
    if (!p) return;

    document.getElementById('form-edit-id').value = p.id;
    document.getElementById('p-code').value = p.code;
    document.getElementById('p-fullName').value = p.fullName || (p.name + ' ' + p.lastname);
    document.getElementById('p-nationalId').value = p.nationalId;
    document.getElementById('p-birthdate').value = p.birthdate;
    document.getElementById('p-age').value = p.age;

    // Gender radio
    const genderRadios = document.querySelectorAll('input[name="p-gender"]');
    genderRadios.forEach(r => {
        if (r.value === p.gender) r.checked = true;
    });

    document.getElementById('p-marital').value = p.marital;
    document.getElementById('p-employment').value = p.employment;
    document.getElementById('p-job').value = p.job;
    document.getElementById('p-phone').value = p.phone;
    document.getElementById('p-admissionDate').value = p.admissionDate;
    document.getElementById('p-insurance').value = p.insurance;
    document.getElementById('p-systemRegistered').value = p.systemRegistered || 'خیر';
    document.getElementById('p-attempts').value = p.attempts;
    document.getElementById('p-counselor').value = p.counselor || '';

    // Clean error labels on entry
    document.getElementById('national-id-err').classList.add('hidden');
    document.getElementById('national-id-dup-err').classList.add('hidden');
    document.getElementById('p-code-dup-err').classList.add('hidden');

    // Substance & conditional layout
    document.getElementById('p-substance').value = p.substance;
    toggleSubstanceOtherField();
    if (p.substance === 'سایر مواد روانگردان') {
        document.getElementById('p-substanceOther').value = p.substanceOther;
    }

    document.getElementById('p-startAge').value = p.startAge;
    document.getElementById('p-duration').value = p.duration;

    // Reset checkboxes and recheck
    document.querySelectorAll('input[name="p-med"]').forEach(chk => chk.checked = false);
    if (p.medHistory) {
        p.medHistory.forEach(disease => {
            const chk = document.querySelector(`input[name="p-med"][value="${disease}"]`);
            if (chk) chk.checked = true;
        });
    }

    document.getElementById('p-medicalNotes').value = p.medicalNotes;
    campMountAdmission(p);

    // Drug plans
    document.getElementById('p-drug').value = p.initialDrug;
    handleDrugDosageUnits('p-drug', 'p-dosage-container', 'p-dosage-unit');
    document.getElementById('p-dosage').value = p.initialDosage;
    togglePriorityField('p-drug', 'p-priority-container');
    document.getElementById('p-priority').value = p.initialPriority || '';

    // Controls
    document.getElementById('p-status').value = p.status;
    toggleDeactiveReasonField();
    if (p.status === 'غیرفعال') {
        document.getElementById('p-deactiveReason').value = p.deactiveReason || '';
        document.getElementById('p-deactiveNotes').value = p.deactiveNotes || '';
    }

    document.getElementById('p-attendance').value = p.attendance;

    // Header title update to reflect edit mode
    document.getElementById('btn-submit-form').innerText = "بروزرسانی نهایی پرونده";
    switchTab('add-patient');
}

function deletePatientRecord(id) {
    showCustomConfirm(
        "حذف دائمی پرونده",
        "آیا از حذف کامل و دائمی این پرونده از کلینیک اطمینان دارید؟ تمامی سوابق ویزیت و تماس‌های مرتبط نیز از بین خواهند رفت.",
        () => {
            window.patients = window.patients.filter(p => p.id !== id);
            dbDeleteRecord('patients', id);

            window.visits.filter(v => v.patientId === id).forEach(v => dbDeleteRecord('visits', v.id));
            window.visits = window.visits.filter(v => v.patientId !== id);

            window.contactLogs.filter(c => c.patientId === id).forEach(c => dbDeleteRecord('contactLogs', c.id));
            window.contactLogs = window.contactLogs.filter(c => c.patientId !== id);

            window.insuranceHistory.filter(i => i.patientId === id).forEach(i => dbDeleteRecord('insuranceHistory', i.id));
            window.insuranceHistory = window.insuranceHistory.filter(i => i.patientId !== id);

            window.auditLogs.filter(a => a.patientId === id).forEach(a => dbDeleteRecord('auditLogs', a.id));
            window.auditLogs = window.auditLogs.filter(a => a.patientId !== id);

            window.patientReviews.filter(r => r.patientId === id).forEach(r => dbDeleteRecord('patientReviews', r.id));
            window.patientReviews = window.patientReviews.filter(r => r.patientId !== id);

            ['opiumMembers', 'opiumPlans', 'opiumDeliveries'].forEach(store => {
                (window[store] || []).filter(r => r.patientId === id).forEach(r => dbDeleteRecord(store, r.id));
                window[store] = (window[store] || []).filter(r => r.patientId !== id);
            });

            triggerBackupReminder();
            renderPatientsList();
            renderDashboard();
            showToast("پرونده و کل سوابق بالینی مرتبط با موفقیت حذف شدند.");
        }
    );
}

function filterVisitsTab(resetPage = true) {
    const q = document.getElementById('search-v-query').value.toLowerCase();
    const attendance = document.getElementById('search-v-attendance').value;
    const drug = document.getElementById('search-v-drug').value;
    const status = document.getElementById('search-v-status').value;

    const filtered = window.patients.filter(p => {
        const patName = p.fullName || (p.name + ' ' + p.lastname);
        const termMatch = patName.toLowerCase().includes(q) || 
                          p.code.toString().includes(q) || 
                          p.phone.includes(q) || 
                          (p.nationalId || '').includes(q);

        const attMatch = attendance === '' || p.attendance === attendance;

        let drugMatch = drug === '' || p.currentDrug === drug;
        if (drug === 'داروی نامعلوم') {
            drugMatch = !p.currentDrug || !['روان درمانی', 'ش متادون', 'ق متادون', 'بوپرنورفین', 'اپیوم', 'متقاضی اپیوم'].includes(p.currentDrug);
        }

        const statusMatch = status === '' || p.status === status;

        return termMatch && attMatch && drugMatch && statusMatch;
    });

    // مرتب‌سازی صعودی: از کد کمتر در بالا به کد بیشتر در پایین
    filtered.sort((a, b) => Number(a.code) - Number(b.code));

    tableState.visits.data = filtered;
    if (resetPage) tableState.visits.page = 1;
    renderPaginatedVisits();
}

function renderVisitsList() {
    filterVisitsTab(false);
}

function renderPaginatedVisits() {
    const tbody = document.getElementById('visits-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = tableState.visits.data.length;
    const limit = tableState.visits.limit;
    let start = limit === 'all' ? 0 : (tableState.visits.page - 1) * limit;
    let end = limit === 'all' ? total : start + limit;
    const paginatedData = tableState.visits.data.slice(start, end);

    // بهینه‌سازی پرفورمنس: استفاده از DocumentFragment
    const fragment = document.createDocumentFragment();

    // PERFORMANCE: build the patientId -> latest-visit lookup once for this render.
    const latestVisitByPatient = buildLatestVisitMap(window.visits);

    paginatedData.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-gray-100 text-xs";

        const latestVisit = latestVisitByPatient.get(p.id);
        const lastVisitDate = latestVisit ? latestVisit.date : "فاقد مراجعه قبلی";

        tr.innerHTML = `
            <td class="p-4 font-bold text-teal-brand font-yekan">${toPersianDigits(p.code)}</td>
            <td class="p-4 font-bold text-slate-800">${escapeHTML(p.fullName || (p.name + ' ' + p.lastname))}</td>
            <td class="p-4 text-slate-700 font-semibold">${escapeHTML(p.currentDrug)}</td>
            <td class="p-4 font-bold text-indigo-600 font-yekan">${formatDosageHTML(p.currentDrug, p.currentDosage)}</td>
            <td class="p-4 text-slate-500 font-yekan font-bold">${lastVisitDate !== "فاقد مراجعه قبلی" ? toPersianDigits(lastVisitDate) : lastVisitDate}</td>
            <td class="p-4"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${p.attendance === 'منظم' ? 'bg-emerald-100 text-emerald-800' : p.attendance === 'نامنظم' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">${escapeHTML(p.attendance)}</span></td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center space-x-1.5 space-x-reverse">
                    <button onclick="openVisitModal('${p.id}')" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition" title="ثبت ویزیت جدید"><i class="fa-solid fa-plus ml-1 text-[9px]"></i> ویزیت جدید</button>
                    <button onclick="openDetailsModal('${p.id}', 'visits')" class="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition" title="مشاهده تاریخچه ویزیت">سوابق درمانی</button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    renderPaginationControls('visits');
}

