// نسیم رهایی — ارائه دارو و پنجره پرونده بیمار
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

// ================= NEW: DISPENSE TAB LOGIC =================
function filterDispenseTab(resetPage = true) {
    const q = document.getElementById('search-d-query').value.toLowerCase();
    const drug = document.getElementById('search-d-drug').value;
    const status = document.getElementById('search-d-status').value;
    const insurance = document.getElementById('search-d-insurance').value;

    const filtered = window.patients.filter(p => {
        const patName = p.fullName || (p.name + ' ' + p.lastname);
        const termMatch = patName.toLowerCase().includes(q) || 
                          p.code.toString().includes(q) || 
                          p.phone.includes(q) || 
                          (p.nationalId || '').includes(q);

        let drugMatch = drug === '' || p.currentDrug === drug;
        if (drug === 'داروی نامعلوم') {
            drugMatch = !p.currentDrug || !['روان درمانی', 'ش متادون', 'ق متادون', 'بوپرنورفین', 'اپیوم'].includes(p.currentDrug);
        }

        const statusMatch = status === '' || p.status === status;
        const insuranceMatch = insurance === '' || p.insurance === insurance;

        return termMatch && drugMatch && statusMatch && insuranceMatch;
    });

    // مرتب‌سازی صعودی
    filtered.sort((a, b) => Number(a.code) - Number(b.code));

    tableState.dispense.data = filtered;
    if (resetPage) tableState.dispense.page = 1;
    renderPaginatedDispense();
}

function renderDispenseList() {
    filterDispenseTab(false);
}

function renderPaginatedDispense() {
    const tbody = document.getElementById('dispense-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = tableState.dispense.data.length;
    const limit = tableState.dispense.limit;
    let start = limit === 'all' ? 0 : (tableState.dispense.page - 1) * limit;
    let end = limit === 'all' ? total : start + limit;
    const paginatedData = tableState.dispense.data.slice(start, end);

    const fragment = document.createDocumentFragment();

    // PERFORMANCE: build the patientId -> latest-visit lookup once for this render.
    const latestVisitByPatient = buildLatestVisitMap(window.visits);

    paginatedData.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-gray-100 text-xs";

        const latestVisit = latestVisitByPatient.get(p.id);
        const lastVisitDate = latestVisit ? latestVisit.date : p.admissionDate;
        const lastDispenseDate = p.lastDispenseDate || "ثبت نشده";

        // Color coding tags
        const statusClass = (p.status === 'فعال' || p.status === 'فعال می‌باشد (در حال مراجعه / در راه)') 
            ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';

        let attClass = 'bg-rose-100 text-rose-800';
        if (p.attendance === 'منظم') attClass = 'bg-emerald-100 text-emerald-800';
        else if (p.attendance === 'نامنظم') attClass = 'bg-amber-100 text-amber-800';

        const insClass = p.insurance === 'دارد' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600';

        tr.innerHTML = `
            <td class="p-4 font-bold text-teal-brand font-yekan">${toPersianDigits(p.code)}</td>
            <td class="p-4 font-bold text-slate-800">${escapeHTML(p.fullName || (p.name + ' ' + p.lastname))}</td>
            <td class="p-4 text-slate-700 font-bold">${escapeHTML(p.currentDrug)} <span class="text-indigo-600 font-yekan mr-1">(${formatDosageHTML(p.currentDrug, p.currentDosage)})</span></td>
            <td class="p-4 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${statusClass}">${escapeHTML(p.status)}</span></td>
            <td class="p-4 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${attClass}">${escapeHTML(p.attendance)}</span></td>
            <td class="p-4 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${insClass}">${escapeHTML(p.insurance)}</span></td>
            <td class="p-4 text-slate-500 font-yekan font-bold">${toPersianDigits(lastVisitDate)}</td>
            <td class="p-4 text-teal-700 font-yekan font-bold bg-teal-50/30 border-r border-gray-100">${toPersianDigits(lastDispenseDate)}</td>
            <td class="p-4 text-center">
                <button onclick="openDispenseModal('${p.id}')" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold transition shadow-sm flex items-center gap-1 mx-auto border border-teal-500/30">
                    <i class="fa-solid fa-pills text-[10px]"></i> ثبت ارائه دارو
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    renderPaginationControls('dispense');
}

// ================= DISPENSE MEDICATION MODAL HANDLERS =================
window.handleDispenseDrugChange = function() {
    const drug = document.getElementById('dispense-drug-display').value;
    const unitSpan = document.getElementById('dispense-quantity-unit');
    if (drug && (drug.includes('قرص') || drug.includes('ق ') || drug === 'ق متادون' || drug.includes('بوپرنورفین'))) {
        unitSpan.innerText = "میلی‌گرم";
    } else {
        unitSpan.innerText = "سی‌سی";
    }
};

window.openDispenseModal = function(id) {
    const p = window.patients.find(pat => pat.id === id);
    if (!p) return;

    document.getElementById('dispense-patient-id').value = id;
    document.getElementById('d-m-code').innerText = toPersianDigits(p.code);
    document.getElementById('d-m-name').innerText = p.fullName || (p.name + ' ' + p.lastname);
    document.getElementById('d-m-drug').innerText = p.currentDrug || "بدون دارو";
    document.getElementById('d-m-daily-dosage').innerText = p.currentDosage ? `${toPersianDigits(p.currentDosage)} ${getDoseUnitCode(p.currentDrug)} روزانه`.replace(/\s+/g, ' ').trim() : "۰ / روان درمانی";

    // Fill input values
    document.getElementById('dispense-date').value = getShamsiToday();

    // Set dropdown to current drug dynamically or fallback to psychotherapy
    const drugSelect = document.getElementById('dispense-drug-display');
    drugSelect.value = p.currentDrug || "روان درمانی";
    // If the patient's drug isn't in the standard list, fallback to default logic safely
    if (!drugSelect.value) drugSelect.value = "روان درمانی";

    document.getElementById('dispense-quantity').value = '';
    document.getElementById('dispense-next-visit').value = '';
    document.getElementById('dispense-days-calculated').innerText = '۰ روز دیگر';

    // Prefill quantity units (سی‌سی / میلی‌گرم) dynamically based on what was selected
    handleDispenseDrugChange();

    // Recipient Reset
    document.getElementById('dispense-recipient').value = 'خودش';
    document.getElementById('dispense-companion-name').value = '';
    document.getElementById('dispense-companion-name').removeAttribute('required');
    document.getElementById('dispense-companion-container').classList.add('hidden');

    document.getElementById('dispense-modal').classList.remove('hidden');
    lockBackgroundScroll();

    // Real-time calculation binding on date change as well
    const dispenseDateInput = document.getElementById('dispense-date');
    if (dispenseDateInput) {
        dispenseDateInput.addEventListener('jdp:change', calculateNextDispenseVisit);
        dispenseDateInput.addEventListener('change', calculateNextDispenseVisit);
        dispenseDateInput.addEventListener('input', calculateNextDispenseVisit);
    }

    calculateNextDispenseVisit();
}

window.closeDispenseModal = function() {
    document.getElementById('dispense-modal').classList.add('hidden');
    unlockBackgroundScroll();
}

window.handleDispenseRecipientChange = function() {
    const recipientSelect = document.getElementById('dispense-recipient');
    const companionContainer = document.getElementById('dispense-companion-container');
    const companionInput = document.getElementById('dispense-companion-name');

    if (recipientSelect.value === 'همراه') {
        companionContainer.classList.remove('hidden');
        companionInput.setAttribute('required', 'required');
    } else {
        companionContainer.classList.add('hidden');
        companionInput.removeAttribute('required');
        companionInput.value = '';
    }
}

window.calculateNextDispenseVisit = function() {
    const id = document.getElementById('dispense-patient-id').value;
    const p = window.patients.find(pat => pat.id === id);
    if (!p) return;

    const quantity = parseFloat(document.getElementById('dispense-quantity').value) || 0;
    const dailyDosage = parseFloat(p.currentDosage) || 0;
    const dispenseDate = document.getElementById('dispense-date').value;
    const selectedDrug = document.getElementById('dispense-drug-display').value;

    const nextVisitInput = document.getElementById('dispense-next-visit');
    const daysCalculatedSpan = document.getElementById('dispense-days-calculated');

    // Handle Psychotherapy or No active daily dosage
    if (selectedDrug === 'روان درمانی' || selectedDrug === 'بدون دارو (فقط روان‌درمانی)' || dailyDosage === 0) {
        nextVisitInput.value = "بدون نیاز به مراجعه دارویی";
        daysCalculatedSpan.innerText = "روان درمانی";
        return;
    }

    if (quantity <= 0) {
        nextVisitInput.value = "منتظر تعیین مقدار...";
        daysCalculatedSpan.innerText = "۰ روز دیگر";
        return;
    }

    // Calculation based on Daily Dosage (rounded down)
    const days = Math.floor(quantity / dailyDosage);

    if (days <= 0) {
        nextVisitInput.value = "مقدار دارو ناکافی است";
        daysCalculatedSpan.innerText = "۰ روز دیگر";
        return;
    }

    // Compute the future Jalali date accurately
    const calculatedFutureDate = addDaysToJalali(dispenseDate, days);

    nextVisitInput.value = toPersianDigits(calculatedFutureDate);
    daysCalculatedSpan.innerText = `${toPersianDigits(days)} روز دیگر`;
}

window.handleDispenseSubmit = function(event) {
    event.preventDefault();

    const pId = document.getElementById('dispense-patient-id').value;
    const dispenseDate = document.getElementById('dispense-date').value;

    // گرفتن مقادیر جدید برای ذخیره در تاریخچه
    const drug = document.getElementById('dispense-drug-display').value;
    const quantity = parseFloat(document.getElementById('dispense-quantity').value) || 0;
    const nextVisit = document.getElementById('dispense-next-visit').value;
    const recipient = document.getElementById('dispense-recipient').value;
    const companion = document.getElementById('dispense-companion-name').value || '';

    const patientIndex = window.patients.findIndex(pat => pat.id === pId);
    if (patientIndex > -1) {
        const patient = window.patients[patientIndex];

        // ذخیره تاریخ آخرین ارائه دارو روی پرونده بیمار
        patient.lastDispenseDate = dispenseDate;

        // افزودن لاگ ارائه دارو به آرایه تاریخچه
        patient.dispenseHistory = patient.dispenseHistory || [];
        patient.dispenseHistory.unshift({
            id: crypto.randomUUID(),
            date: dispenseDate,
            drug: drug,
            quantity: quantity,
            nextVisit: nextVisit,
            recipient: recipient,
            companion: companion,
            recordedBy: window.staff?.doctors?.[0] || "سیستم"
        });

        dbPutRecord('patients', patient);
        triggerBackupReminder();

        showToast("ثبت ارائه دارو با موفقیت انجام شد و در تاریخچه پرونده ذخیره گردید.");
        closeDispenseModal();
        renderDispenseList(); // رفرش جدول برای نمایش تاریخ جدید
    }
}

// Details Modal Controllers
function openDetailsModal(id, initialTab = 'base') {
    activePatientForModal = window.patients.find(p => p.id === id);
    if (!activePatientForModal) return;

    // NEW: Update modal title with dynamic patient info
    const p = activePatientForModal;
    const patName = p.fullName || (p.name + ' ' + p.lastname);
    document.getElementById('details-modal-title').innerHTML = `پرونده پزشکی بیمار <span class="mx-2 text-teal-200">|</span> ${escapeHTML(patName)} <span class="text-teal-200 font-yekan text-[11px] px-2 py-0.5 bg-teal-800/80 rounded border border-teal-700 mr-2 shadow-sm">کد: ${toPersianDigits(p.code)}</span>`;

    isModalEditMode = false;
    document.getElementById('details-modal').classList.remove('hidden');
    lockBackgroundScroll();
    switchModalTab(initialTab);

    // Modal Actions Linkings
    document.getElementById('btn-modal-action-edit').onclick = () => {
        closeDetailsModal();
        triggerEditMode(id);
    };
    document.getElementById('btn-modal-action-print').onclick = () => {
        openPrintSectionsModal(id);
    };
}

function closeDetailsModal() {
    document.getElementById('details-modal').classList.add('hidden');
    unlockBackgroundScroll();
    activePatientForModal = null;
    isModalEditMode = false;

    // --- رفع مورد ۵: پاکسازی DOM برای جلوگیری از اشغال حافظه ---
    const modalBody = document.getElementById('details-modal-body');
    if (modalBody) {
        modalBody.innerHTML = ''; 
    }
}

function switchModalTab(tabKey) {
    activeModalTab = tabKey;

    // Edit mode resets when switching tabs
    isModalEditMode = false;

    // Tab visual states
    const baseBtn = document.getElementById('modal-tab-btn-base');
    const visitsBtn = document.getElementById('modal-tab-btn-visits');
    const callsBtn = document.getElementById('modal-tab-btn-calls');
    const historyBtn = document.getElementById('modal-tab-btn-history');
    const dispenseBtn = document.getElementById('modal-tab-btn-dispense');
    const reviewsBtn = document.getElementById('modal-tab-btn-reviews');

    [baseBtn, visitsBtn, callsBtn, historyBtn, dispenseBtn, reviewsBtn].forEach(b => {
        if (b) b.className = "px-4 py-2 text-xs font-bold text-slate-500 border-b-2 border-transparent transition whitespace-nowrap";
    });

    const activeBtn = document.getElementById(`modal-tab-btn-${tabKey}`);
    if (activeBtn) activeBtn.className = "px-4 py-2 text-xs font-bold border-b-2 border-teal-brand text-teal-brand transition whitespace-nowrap";

    // Toggle visibility of the inline edit button in modal footer
    const inlineEditBtn = document.getElementById('btn-modal-action-inline-edit');
    if (tabKey === 'base') {
        inlineEditBtn.classList.remove('hidden');
    } else {
        inlineEditBtn.classList.add('hidden');
    }

    renderModalTabBody();
}

function toggleModalInlineEdit(state) {
    isModalEditMode = state;
    renderModalTabBody();

    // Re-bind Jalali Datepicker to dynamically created input in modal
    if (state && typeof jalaliDatepicker !== 'undefined') {
        jalaliDatepicker.startWatch();

        // Dynamic age calculation within modal fields
        const mBirthdateInput = document.getElementById('m-p-birthdate');
        if (mBirthdateInput) {
            const updateModalAge = () => {
                const dob = mBirthdateInput.value;
                const calculatedAge = calculateShamsiAge(dob);
                if (calculatedAge !== '') {
                    document.getElementById('m-p-age').value = calculatedAge;
                }
            };
            mBirthdateInput.addEventListener('jdp:change', updateModalAge);
            mBirthdateInput.addEventListener('change', updateModalAge);
            mBirthdateInput.addEventListener('input', updateModalAge);
        }
    }
}

// Handles inline drug dosage unit toggles in dynamic modal
window.handleModalDrugChange = function() {
    handleDrugDosageUnits('m-p-drug', 'm-dosage-container', 'm-dosage-unit');
    togglePriorityField('m-p-drug', 'm-priority-container');
}

// Handles inline drug dosage unit toggles for the INITIAL treatment protocol fields
// in the quick-edit modal (mirrors handleModalDrugChange, but for initialDrug/initialDosage).
window.handleModalInitialDrugChange = function() {
    handleDrugDosageUnits('m-p-initialDrug', 'm-initial-dosage-container', 'm-initial-dosage-unit');
    togglePriorityField('m-p-initialDrug', 'm-initial-priority-container');
}

function renderModalTabBody() {
    const body = document.getElementById('details-modal-body');
    body.innerHTML = '';
    const p = activePatientForModal;

    if (activeModalTab === 'base') {
        if (isModalEditMode) {
            // RENDER INLINE EDITABLE FORM INSIDE MODAL WORKSPACE
            let counselorOptionsHTML = ``;
            window.staff.psychologists.forEach(psy => {
                counselorOptionsHTML += `<option value="${psy}" ${p.counselor === psy ? 'selected' : ''}>${psy}</option>`;
            });

            body.innerHTML = `
                <form id="modalInlineEditForm" onsubmit="saveModalInlineChanges(event)" class="space-y-3 text-xs text-slate-700 animate-fade-in font-sans">
                    <div class="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl flex items-center justify-between">
                        <span class="font-bold text-amber-800"><i class="fa-solid fa-triangle-exclamation ml-1"></i> در حال ویرایش درجا و مستقیم اطلاعات بیمار</span>
                        <div class="flex gap-2">
                            <button type="button" onclick="toggleModalInlineEdit(false)" class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold transition">انصراف</button>
                            <button type="submit" class="px-4 py-1.5 bg-teal-brand hover-bg-teal text-white rounded-lg font-bold transition">ثبت تغییرات پرونده</button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <div>
                            <label class="block font-bold mb-1">کد پرونده <span class="text-red-500">*</span></label>
                            <input type="number" id="m-p-code" data-patient-id="${p.id}" oninput="validateQuickEditCodeField(this)" required class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand font-yekan" value="${p.code}">
                            <span id="m-p-code-dup-err" class="text-[10px] text-red-500 hidden mt-1 block font-bold">این کد پرونده قبلاً برای بیمار دیگری ثبت شده است!</span>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">نام و نام خانوادگی <span class="text-red-500">*</span></label>
                            <input type="text" id="m-p-fullName" required class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand" value="${p.fullName || (p.name + ' ' + p.lastname)}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">کد ملی <span class="text-slate-400 font-normal text-[10px]">(اختیاری)</span></label>
                            <input type="text" id="m-p-nationalId" maxlength="10" class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand font-yekan tracking-wider" value="${p.nationalId || ''}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">تاریخ تولد شمسی <span class="text-red-500">*</span></label>
                            <input type="text" id="m-p-birthdate" data-jdp required class="w-full px-3 py-1.5 border rounded-xl outline-none text-center focus:border-teal-brand font-yekan" value="${p.birthdate}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">شماره تماس اضطراری <span class="text-red-500">*</span></label>
                            <input type="tel" id="m-p-phone" required class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand text-left font-yekan tracking-wider" value="${escapeHTML(p.phone)}">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                        <div>
                            <label class="block font-bold mb-1">تاریخ پذیرش <span class="text-red-500">*</span></label>
                            <input type="text" id="m-p-admissionDate" data-jdp required class="w-full px-3 py-1.5 border rounded-xl outline-none text-center focus:border-teal-brand font-yekan" value="${p.admissionDate}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">سن <span class="text-red-500">*</span></label>
                            <input type="number" id="m-p-age" required min="12" max="100" class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand font-yekan" value="${escapeHTML(p.age)}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">وضعیت تاهل</label>
                            <select id="m-p-marital" class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand">
                                <option value="مجرد" ${p.marital === 'مجرد' ? 'selected' : ''}>مجرد</option>
                                <option value="متأهل" ${p.marital === 'متأهل' ? 'selected' : ''}>متأهل</option>
                                <option value="مطلقه - متارکه" ${p.marital === 'مطلقه - متارکه' ? 'selected' : ''}>مطلقه - متارکه</option>
                                <option value="همسر فوت شده" ${p.marital === 'همسر فوت شده' ? 'selected' : ''}>همسر فوت شده</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">وضعیت اشتغال</label>
                            <select id="m-p-employment" class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand">
                                <option value="شاغل" ${p.employment === 'شاغل' ? 'selected' : ''}>شاغل</option>
                                <option value="بیکار" ${p.employment === 'بیکار' ? 'selected' : ''}>بیکار</option>
                                <option value="بازنشسته" ${p.employment === 'بازنشسته' ? 'selected' : ''}>بازنشسته</option>
                                <option value="دانش‌آموز/دانشجو" ${p.employment === 'دانش‌آموز/دانشجو' ? 'selected' : ''}>دانش‌آموز/دانشجو</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">عنوان شغل</label>
                            <input type="text" id="m-p-job" class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand" value="${p.job || ''}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">مشاور (روانشناس) <span class="text-red-500">*</span></label>
                            <select id="m-p-counselor" required class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand">
                                ${counselorOptionsHTML}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 border-t pt-2.5">
                        <div>
                            <label class="block font-bold mb-1">ماده مصرفی اصلی <span class="text-red-500">*</span></label>
                            <select id="m-p-substance" required class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="تریاک" ${p.substance === 'تریاک' ? 'selected' : ''}>تریاک</option>
                                <option value="شیره" ${p.substance === 'شیره' ? 'selected' : ''}>شیره</option>
                                <option value="هروئین" ${p.substance === 'هروئین' ? 'selected' : ''}>هروئین</option>
                                <option value="کراک" ${p.substance === 'کراک' ? 'selected' : ''}>کراک</option>
                                <option value="شیشه (مت‌آمفتامین)" ${p.substance === 'شیشه (مت‌آمفتامین)' ? 'selected' : ''}>شیشه (مت‌آمفتامین)</option>
                                <option value="ترامادول" ${p.substance === 'ترامادول' ? 'selected' : ''}>ترامادول</option>
                                <option value="ماریجوانا / گل" ${p.substance === 'ماریجوانا / گل' ? 'selected' : ''}>ماریجوانا / گل</option>
                                <option value="حشیش" ${p.substance === 'حشیش' ? 'selected' : ''}>حشیش</option>
                                <option value="الکل" ${p.substance === 'الکل' ? 'selected' : ''}>الکل</option>
                                <option value="کوکائین" ${p.substance === 'کوکائین' ? 'selected' : ''}>کوکائین</option>
                                <option value="اکستازی" ${p.substance === 'اکستازی' ? 'selected' : ''}>اکستازی</option>
                                <option value="سایر مواد روانگردان" ${p.substance === 'سایر مواد روانگردان' ? 'selected' : ''}>سایر مواد روانگردان</option>
                                <option value="مصرف چندگانه (پلی‌سابستنس)" ${p.substance === 'مصرف چندگانه (پلی‌سابستنس)' ? 'selected' : ''}>مصرف چندگانه (پلی‌سابستنس)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">سن شروع مصرف (سال)</label>
                            <input type="number" id="m-p-startAge" class="w-full px-3 py-1.5 border rounded-xl outline-none font-yekan" value="${p.startAge || ''}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">مدت مصرف (سال)</label>
                            <input type="number" id="m-p-duration" class="w-full px-3 py-1.5 border rounded-xl outline-none font-yekan" value="${p.duration || ''}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1">سوابق ترک قبلی</label>
                            <select id="m-p-attempts" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="هیچ‌وقت ترک نکرده" ${p.attempts === 'هیچ‌وقت ترک نکرده' ? 'selected' : ''}>هیچ‌وقت ترک نکرده</option>
                                <option value="۱ بار" ${p.attempts === '۱ بار' ? 'selected' : ''}>۱ بار</option>
                                <option value="۲ تا ۵ بار" ${p.attempts === '۲ تا ۵ بار' ? 'selected' : ''}>۲ تا ۵ بار</option>
                                <option value="بیش از ۵ بار" ${p.attempts === 'بیش از ۵ بار' ? 'selected' : ''}>بیش از ۵ بار</option>
                            </select>
                        </div>
                    </div>

                    <!-- Initial Treatment Settings inside Inline Modal (kept fully in sync with the "برنامه درمانی اولیه" section of the Full Edit form: initialDrug / initialDosage / initialPriority) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 border-t pt-2.5">
                        <div>
                            <label class="block font-bold mb-1">درمان / پروتکل دارویی اولیه <span class="text-red-500">*</span></label>
                            <select id="m-p-initialDrug" required onchange="handleModalInitialDrugChange()" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="روان درمانی" ${(p.initialDrug === 'روان درمانی' || p.initialDrug === 'بدون دارو (فقط روان‌درمانی)') ? 'selected' : ''}>روان درمانی</option>
                                <option value="ش متادون" ${(p.initialDrug === 'ش متادون' || p.initialDrug === 'شربت متادون') ? 'selected' : ''}>ش متادون</option>
                                <option value="ق متادون" ${(p.initialDrug === 'ق متادون' || p.initialDrug === 'قرص متادون') ? 'selected' : ''}>ق متادون</option>
                                <option value="بوپرنورفین" ${(p.initialDrug === 'بوپرنورفین' || p.initialDrug === 'قرص ب۲ (بوپرنورفین)') ? 'selected' : ''}>بوپرنورفین</option>
                                <option value="اپیوم" ${(p.initialDrug === 'اپیوم' || p.initialDrug === 'شربت اوپیوم') ? 'selected' : ''}>اپیوم</option>
                            </select>
                        </div>
                        <div id="m-initial-dosage-container">
                            <label class="block font-bold mb-1">دوز دارویی اولیه <span class="text-red-500">*</span></label>
                            <div class="relative rounded-xl shadow-sm">
                                <input type="number" id="m-p-initialDosage" step="0.1" class="w-full px-3 py-1.5 border rounded-xl outline-none font-yekan" value="${p.initialDosage || 0}">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span id="m-initial-dosage-unit" class="text-[10px] text-gray-500 font-bold">واحد</span>
                                </div>
                            </div>
                        </div>
                        <!-- Opium priority for the initial protocol — shown only when initial drug is اپیوم -->
                        <div id="m-initial-priority-container" class="${p.initialDrug === 'اپیوم' ? '' : 'hidden'}">
                            <label class="block font-bold mb-1">اولویت اپیوم (اولیه)</label>
                            <select id="m-p-initialPriority" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="" ${!p.initialPriority ? 'selected' : ''}>انتخاب کنید</option>
                                <option value="A1" ${p.initialPriority === 'A1' ? 'selected' : ''}>A1</option>
                                <option value="A2" ${p.initialPriority === 'A2' ? 'selected' : ''}>A2</option>
                                <option value="B1" ${p.initialPriority === 'B1' ? 'selected' : ''}>B1</option>
                                <option value="B2" ${p.initialPriority === 'B2' ? 'selected' : ''}>B2</option>
                                <option value="B3" ${p.initialPriority === 'B3' ? 'selected' : ''}>B3</option>
                            </select>
                        </div>
                    </div>

                    <!-- Treatment Settings inside Inline Modal -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 border-t pt-2.5">
                        <div>
                            <label class="block font-bold mb-1">درمان دارویی فعلی <span class="text-red-500">*</span></label>
                            <select id="m-p-drug" required onchange="handleModalDrugChange()" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="روان درمانی" ${(p.currentDrug === 'روان درمانی' || p.currentDrug === 'بدون دارو (فقط روان‌درمانی)') ? 'selected' : ''}>روان درمانی</option>
                                <option value="ش متادون" ${(p.currentDrug === 'ش متادون' || p.currentDrug === 'شربت متادون') ? 'selected' : ''}>ش متادون</option>
                                <option value="ق متادون" ${(p.currentDrug === 'ق متادون' || p.currentDrug === 'قرص متادون') ? 'selected' : ''}>ق متادون</option>
                                <option value="بوپرنورفین" ${(p.currentDrug === 'بوپرنورفین' || p.currentDrug === 'قرص ب۲ (بوپرنورفین)') ? 'selected' : ''}>بوپرنورفین</option>
                                <option value="اپیوم" ${(p.currentDrug === 'اپیوم' || p.currentDrug === 'شربت اوپیوم') ? 'selected' : ''}>اپیوم</option>
                            </select>
                        </div>
                        <div id="m-dosage-container">
                            <label class="block font-bold mb-1">دوز دارویی فعلی <span class="text-red-500">*</span></label>
                            <div class="relative rounded-xl shadow-sm">
                                <input type="number" id="m-p-dosage" step="0.1" class="w-full px-3 py-1.5 border rounded-xl outline-none font-yekan" value="${p.currentDosage || 0}">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span id="m-dosage-unit" class="text-[10px] text-gray-500 font-bold">واحد</span>
                                </div>
                            </div>
                        </div>
                        <!-- NEW: Opium priority field — shown only when current drug is اپیوم, editable here (quick edit) -->
                        <div id="m-priority-container" class="${p.currentDrug === 'اپیوم' ? '' : 'hidden'}">
                            <label class="block font-bold mb-1">اولویت اپیوم</label>
                            <select id="m-p-priority" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="" ${!p.currentPriority ? 'selected' : ''}>انتخاب کنید</option>
                                <option value="A1" ${p.currentPriority === 'A1' ? 'selected' : ''}>A1</option>
                                <option value="A2" ${p.currentPriority === 'A2' ? 'selected' : ''}>A2</option>
                                <option value="B1" ${p.currentPriority === 'B1' ? 'selected' : ''}>B1</option>
                                <option value="B2" ${p.currentPriority === 'B2' ? 'selected' : ''}>B2</option>
                                <option value="B3" ${p.currentPriority === 'B3' ? 'selected' : ''}>B3</option>
                            </select>
                        </div>
                    </div>

                    <!-- Controls inside Inline Modal -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 border-t pt-2.5">
                        <div>
                            <label class="block font-bold mb-1">وضعیت پرونده <span class="text-red-500">*</span></label>
                            <select id="m-p-status" required onchange="toggleModalDeactiveReasonField()" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="فعال" ${(p.status === 'فعال' || p.status === 'فعال می‌باشد (در حال مراجعه / در راه)') ? 'selected' : ''}>فعال</option>
                                <option value="غیرفعال" ${p.status === 'غیرفعال' ? 'selected' : ''}>غیرفعال</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">نظم حضور در مرکز</label>
                            <select id="m-p-attendance" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="منظم" ${p.attendance === 'منظم' ? 'selected' : ''}>منظم</option>
                                <option value="نامنظم" ${p.attendance === 'نامنظم' ? 'selected' : ''}>نامنظم</option>
                                <option value="غیبت" ${p.attendance === 'غیبت' ? 'selected' : ''}>غیبت</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">پوشش بیمه‌ای</label>
                            <select id="m-p-insurance" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="دارد" ${p.insurance === 'دارد' ? 'selected' : ''}>دارد</option>
                                <option value="ندارد" ${p.insurance === 'ندارد' ? 'selected' : ''}>ندارد</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">ثبت در سامانه</label>
                            <select id="m-p-systemRegistered" class="w-full px-3 py-1.5 border rounded-xl outline-none">
                                <option value="بله" ${(p.systemRegistered || 'خیر') === 'بله' ? 'selected' : ''}>بله</option>
                                <option value="خیر" ${(p.systemRegistered || 'خیر') === 'خیر' ? 'selected' : ''}>خیر</option>
                            </select>
                        </div>
                    </div>

                    <!-- Reason of Inactivity inside details Modal Edit mode -->
                    <div id="m-deactive-reason-container" class="${p.status === 'غیرفعال' ? '' : 'hidden'} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 border-t pt-2.5">
                        <div>
                            <label class="block font-bold mb-1.5 font-semibold text-rose-700">علت غیرفعال شدن پرونده <span class="text-red-500">*</span></label>
                            <select id="m-p-deactiveReason" class="w-full px-3 py-1.5 border rounded-xl outline-none border-rose-300">
                                <option value="" disabled ${!p.deactiveReason ? 'selected' : ''}>انتخاب کنید</option>
                                <option value="بهبودی کامل (ترخیص)" ${p.deactiveReason === 'بهبودی کامل (ترخیص)' ? 'selected' : ''}>بهبودی کامل (ترخیص)</option>
                                <option value="انصراف از درمان" ${p.deactiveReason === 'انصراف از درمان' ? 'selected' : ''}>انصراف از درمان</option>
                                <option value="انتقال به مرکز دیگر" ${p.deactiveReason === 'انتقال به مرکز دیگر' ? 'selected' : ''}>انتقال به مرکز دیگر</option>
                                <option value="فوت" ${p.deactiveReason === 'فوت' ? 'selected' : ''}>فوت</option>
                                <option value="عدم مراجعه طولانی مدت" ${p.deactiveReason === 'عدم مراجعه طولانی مدت' ? 'selected' : ''}>عدم مراجعه طولانی مدت</option>
                                <option value="مشکلات مالی" ${p.deactiveReason === 'مشکلات مالی' ? 'selected' : ''}>مشکلات مالی</option>
                                <option value="علت نامشخص" ${p.deactiveReason === 'علت نامشخص' ? 'selected' : ''}>علت نامشخص</option>
                                <option value="سایر" ${p.deactiveReason === 'سایر' ? 'selected' : ''}>سایر</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1">توضیحات علت غیرفعال شدن (اختیاری)</label>
                            <input type="text" id="m-p-deactiveNotes" class="w-full px-3 py-1.5 border rounded-xl outline-none" value="${escapeHTML(p.deactiveNotes || '')}" placeholder="توضیحات بیشتر...">
                        </div>
                    </div>

                    <!-- Checkboxes Disease history in modal -->
                    <div class="border-t pt-2.5 space-y-2">
                        <label class="block font-bold">بیماری‌های زمینه‌ای (بروزرسانی تیک‌ها):</label>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5 bg-slate-50 p-2 rounded-xl border">
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="بیماری کبدی" ${p.medHistory && p.medHistory.includes('بیماری کبدی') ? 'checked' : ''} class="rounded text-teal-brand"> <span>بیماری کبدی</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="دیابت" ${p.medHistory && p.medHistory.includes('دیابت') ? 'checked' : ''} class="rounded text-teal-brand"> <span>دیابت</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="فشار خون" ${p.medHistory && p.medHistory.includes('فشار خون') ? 'checked' : ''} class="rounded text-teal-brand"> <span>فشار خون</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="صرع" ${p.medHistory && p.medHistory.includes('صرع') ? 'checked' : ''} class="rounded text-teal-brand"> <span>صرع</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="افسردگی" ${p.medHistory && p.medHistory.includes('افسردگی') ? 'checked' : ''} class="rounded text-teal-brand"> <span>افسردگی</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="اختلال اضطرابی" ${p.medHistory && p.medHistory.includes('اختلال اضطرابی') ? 'checked' : ''} class="rounded text-teal-brand"> <span>اختلال اضطرابی</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="بیماری کلیوی" ${p.medHistory && p.medHistory.includes('بیماری کلیوی') ? 'checked' : ''} class="rounded text-teal-brand"> <span>بیماری کلیوی</span></label>
                            <label class="flex items-center space-x-1 space-x-reverse"><input type="checkbox" name="m-p-med" value="نارسایی قلبی" ${p.medHistory && p.medHistory.includes('نارسایی قلبی') ? 'checked' : ''} class="rounded text-teal-brand"> <span>نارسایی قلبی</span></label>
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold mb-1">توضیحات بالینی و یادداشت‌های روانپزشکی:</label>
                        <textarea id="m-p-medicalNotes" rows="2" class="w-full px-3 py-1.5 border rounded-xl outline-none focus:border-teal-brand">${escapeHTML(p.medicalNotes || '')}</textarea>
                    </div>

                    <div class="pt-2.5 border-t flex justify-end gap-2">
                        <button type="button" onclick="toggleModalInlineEdit(false)" class="px-6 py-1.5 border rounded-xl font-bold hover:bg-slate-50 transition">انصراف از ویرایش</button>
                        <button type="submit" class="px-8 py-1.5 bg-teal-brand text-white rounded-xl font-bold hover:bg-teal-700 shadow-md transition">ذخیره نهایی تغییرات</button>
                    </div>
                </form>
            `;
            // Run the dosage unit update at render
            handleDrugDosageUnits('m-p-drug', 'm-dosage-container', 'm-dosage-unit');
            togglePriorityField('m-p-drug', 'm-priority-container');
            // togglePriorityField clears the value when the field is hidden, but not when
            // it's شown — restore the patient's saved priority since the <select> was just
            // freshly rendered with the right `selected` option already in its HTML above.
            if (p.currentDrug === 'اپیوم') {
                document.getElementById('m-p-priority').value = p.currentPriority || '';
            }

            // Same setup for the INITIAL treatment protocol fields
            handleDrugDosageUnits('m-p-initialDrug', 'm-initial-dosage-container', 'm-initial-dosage-unit');
            togglePriorityField('m-p-initialDrug', 'm-initial-priority-container');
            if (p.initialDrug === 'اپیوم') {
                document.getElementById('m-p-initialPriority').value = p.initialPriority || '';
            }
        } else {
            // RENDER DEFAULT READONLY MODE AS DESIRED WITH NEW STYLISH VIEW
            const isActive = p.status === 'فعال' || p.status === 'فعال می‌باشد (در حال مراجعه / در راه)';
            const statusColor = isActive ? 'from-emerald-500 to-teal-600' : 'from-rose-500 to-red-600';
            const attendanceColor = p.attendance === 'منظم' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.attendance === 'نامنظم' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';

            // Calculate clinical treatment status dynamically
            let treatmentStatus = "در طی درمان";
            let treatmentBadgeClass = "bg-amber-50 text-amber-700 border-amber-200 shadow-sm";

            if (p.status === 'غیرفعال') {
                if (p.deactiveReason === 'بهبودی کامل (ترخیص)') {
                    treatmentStatus = "بهبود یافته";
                    treatmentBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm";
                } else if (p.deactiveReason === 'انتقال به مرکز دیگر') {
                    treatmentStatus = "ادامه درمرکز دیگر";
                    treatmentBadgeClass = "bg-blue-50 text-blue-700 border-blue-200 shadow-sm";
                } else {
                    treatmentStatus = "قطع درمان";
                    treatmentBadgeClass = "bg-rose-50 text-rose-700 border-rose-200 shadow-sm";
                }
            } else {
                const testVisits = window.visits
                    .filter(v => v.patientId === p.id && (v.testResult === 'منفی' || v.testResult === 'مثبت'))
                    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

                if (testVisits.length >= 4) {
                    const last4Tests = testVisits.slice(0, 4);
                    if (last4Tests.every(v => v.testResult === 'منفی')) {
                        treatmentStatus = "بهبود یافته";
                        treatmentBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm";
                    }
                }
            }

            body.innerHTML = `
                <!-- Top Controls (Moved from removed dark header) -->
                <div class="flex justify-between items-center mb-2">
                    <p class="text-[11px] text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5"><i class="fa-solid fa-calendar-check text-slate-400"></i> تاریخ پذیرش: <strong class="text-slate-800 font-yekan">${toPersianDigits(p.admissionDate)}</strong></p>
                    <button onclick="toggleModalInlineEdit(true)" class="px-4 py-1.5 bg-teal-brand hover:bg-teal-700 text-white font-extrabold text-[11px] rounded-xl shadow-sm hover:shadow-md transition-all duration-150 flex items-center gap-1.5 border border-teal-400/20">
                        <i class="fa-solid fa-user-pen text-[10px]"></i> ویرایش سریع
                    </button>
                </div>

                <!-- Main Clinical Cards Grid -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">

                    <!-- Card 1: Identity & General Metrics -->
                    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-2.5 space-y-2 flex flex-col h-full hover:border-slate-300/80 transition duration-200">
                        <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                            <i class="fa-solid fa-id-card text-teal-brand text-sm"></i>
                            <span>مشخصات هویتی و سوابق</span>
                        </h4>

                        <div class="flex-1 flex flex-col justify-between space-y-2">
                            <!-- 6 Cards Grid (2 Columns x 3 Rows) -->
                            <div class="grid grid-cols-2 gap-2">
                                <!-- Right Column (3 Cards) -->
                                <div class="space-y-2 flex flex-col justify-between">
                                    <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                        <span class="text-[10px] text-slate-400 font-bold block mb-0.5">کد ملی ده رقمی</span>
                                        <div class="flex items-center justify-between gap-1">
                                            <span class="font-bold text-slate-800 text-[11px] font-yekan tracking-wider">${p.nationalId ? toPersianDigits(p.nationalId) : '<span class="text-slate-400 font-normal">ثبت نشده</span>'}</span>
                                            ${p.nationalId ? `<button type="button" onclick="copyCleanValueToClipboard('${escapeHTML(p.nationalId)}', 'کد ملی')" title="کپی کد ملی با فرمت استاندارد (اعداد انگلیسی)" class="text-slate-400 hover:text-teal-brand transition p-1 shrink-0"><i class="fa-regular fa-copy text-[11px]"></i></button>` : ''}
                                        </div>
                                    </div>

                                    <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                        <span class="text-[10px] text-slate-400 font-bold block mb-0.5">سن بالینی</span>
                                        <span class="font-extrabold text-slate-800 text-[11px]"><span class="font-yekan">${toPersianDigits(p.age)}</span> سال <span class="text-[9px] text-slate-400 font-medium font-yekan">(${toPersianDigits(p.birthdate)})</span></span>
                                    </div>

                                    <div class="p-1.5 bg-amber-50/40 rounded-xl border border-amber-100 flex flex-col justify-center">
                                        <span class="text-[10px] text-amber-700 font-bold block mb-0.5">ماده مصرفی اصلی مراجع</span>
                                        <div class="font-black text-amber-900 text-[11px] truncate" title="${escapeHTML(p.substance)}">
                                            ${escapeHTML(p.substance)} ${p.substanceOther ? `(${escapeHTML(p.substanceOther)})` : ''} 
                                            <span class="text-[9px] font-semibold text-amber-800 inline-block mr-1">(سابقه <span class="font-yekan">${toPersianDigits(p.duration)}</span> سال)</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Left Column (3 Cards) -->
                                <div class="space-y-2 flex flex-col justify-between">
                                    <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                        <span class="text-[10px] text-slate-400 font-bold block mb-0.5">تلفن اضطراری مراجع</span>
                                        <div class="flex items-center justify-between gap-1">
                                            <span class="font-bold text-slate-800 text-[11px] font-yekan tracking-wider" dir="ltr">${toPersianDigits(p.phone)}</span>
                                            <button type="button" onclick="copyCleanValueToClipboard('${escapeHTML(p.phone)}', 'شماره تماس')" title="کپی شماره تماس با فرمت استاندارد (اعداد انگلیسی)" class="text-slate-400 hover:text-teal-brand transition p-1 shrink-0"><i class="fa-regular fa-copy text-[11px]"></i></button>
                                        </div>
                                    </div>

                                    <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                        <span class="text-[10px] text-slate-400 font-bold block mb-0.5">وضعیت خانوادگی و اشتغال</span>
                                        <span class="font-bold text-slate-800 text-[11px]">${p.marital} <span class="text-slate-300 mx-1">/</span> ${p.employment}</span>
                                    </div>

                                    <div class="p-1.5 bg-teal-50/30 rounded-xl border border-teal-100/50 flex flex-col justify-center">
                                        <span class="text-[10px] text-teal-600 font-bold block mb-0.5">مشاور (روانشناس) معالج</span>
                                        <span class="font-extrabold text-teal-900 text-[11px] flex items-center gap-1.5"><i class="fa-solid fa-user-doctor text-teal-500"></i> ${escapeHTML(p.counselor) || 'ثبت نشده'}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Bottom Full-Width Horizontal Card for Diseases -->
                            <div class="p-2 bg-red-50/30 rounded-xl border border-red-100/60 flex flex-col justify-center w-full">
                                <span class="text-[10px] text-red-700 font-bold block mb-1">بیماری‌های زمینه‌ای و آسیب‌های همزمان</span>
                                <div class="flex flex-wrap gap-1.5">
                                    ${p.medHistory && p.medHistory.length ? p.medHistory.map(disease => `
                                        <span class="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100/80 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            ${escapeHTML(disease)}
                                        </span>
                                    `).join('') : `
                                        <span class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1.5">
                                            <i class="fa-solid fa-circle-check text-emerald-500 text-[9px]"></i>
                                            فاقد هرگونه بیماری زمینه‌ای گزارش شده
                                        </span>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: Treatment & Protocol Details -->
                    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-2.5 space-y-2 flex flex-col h-full hover:border-slate-300/80 transition duration-200">
                        <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                            <i class="fa-solid fa-prescription text-indigo-500 text-sm"></i>
                            <span>برنامه درمانی و پروتکل دارویی</span>
                        </h4>

                        <div class="grid grid-cols-2 gap-1.5 flex-1">
                            <!-- Row 1: Treatment Status & Attendance -->
                            <div class="p-1.5 ${treatmentBadgeClass.split(' ')[0]} rounded-xl border ${treatmentBadgeClass.split(' ')[2]} flex flex-col justify-center">
                                <span class="text-[10px] ${treatmentBadgeClass.split(' ')[1]} font-bold block mb-0.5">وضعیت درمانی</span>
                                <span class="font-black text-slate-950 text-[10px] flex items-center gap-1">
                                    ${treatmentStatus === 'بهبود یافته' ? '<i class="fa-solid fa-check text-[10px] text-emerald-600"></i>' : ''} ${treatmentStatus}
                                </span>
                            </div>

                            <div class="p-1.5 ${attendanceColor} rounded-xl border flex flex-col justify-center">
                                <span class="text-[10px] opacity-80 font-bold block mb-0.5">نظم حضور</span>
                                <span class="font-extrabold text-[10px]">${p.attendance}</span>
                            </div>

                            <!-- Row 2: Current Drug & Initial Drug -->
                            <div class="p-1.5 bg-indigo-50/30 rounded-xl border border-indigo-100 hover:bg-indigo-50/50 transition flex flex-col justify-center">
                                <span class="text-[10px] text-indigo-600 font-bold block mb-0.5">درمان دارویی فعلی</span>
                                <div class="flex items-center justify-between mt-0.5">
                                    <span class="font-extrabold text-indigo-950 text-[10px] block leading-relaxed">${escapeHTML(p.currentDrug)}${(p.currentDrug === 'اپیوم' && p.currentPriority) ? `<span class="text-indigo-300 font-normal mx-0.5">/</span>${escapeHTML(p.currentPriority)}` : ''}</span>
                                    ${p.currentDosage ? `<span class="inline-block text-[9px] font-bold text-white bg-indigo-600 px-1 py-0.5 rounded font-yekan">دوز: ${formatDosageHTML(p.currentDrug, p.currentDosage)}</span>` : ''}
                                </div>
                            </div>

                            <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                <span class="text-[10px] text-slate-400 font-bold block mb-0.5">درمان بدو ورود</span>
                                <div class="flex items-center justify-between mt-0.5">
                                    <span class="font-bold text-slate-700 text-[10px] block leading-relaxed">${escapeHTML(p.initialDrug)}${(p.initialDrug === 'اپیوم' && p.initialPriority) ? `<span class="text-slate-300 font-normal mx-0.5">/</span>${escapeHTML(p.initialPriority)}` : ''}</span>
                                    ${p.initialDosage ? `<span class="inline-block text-[9px] font-bold text-white bg-slate-500 px-1 py-0.5 rounded font-yekan">دوز: ${formatDosageHTML(p.initialDrug, p.initialDosage)}</span>` : ''}
                                </div>
                            </div>

                            <!-- Row 3: Insurance & Start Age -->
                            <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                <span class="text-[10px] text-slate-400 font-bold block mb-0.5">پوشش بیمه‌ای</span>
                                <span class="font-bold text-slate-800 text-[10px] flex items-center gap-1 mt-0.5">
                                    <i class="fa-solid ${p.insurance === 'دارد' ? 'fa-shield-halved text-blue-500' : 'fa-triangle-exclamation text-slate-400'} text-[10px]"></i>
                                    ${p.insurance === 'دارد' ? 'فعال می‌باشد' : 'فاقد بیمه'}
                                </span>
                            </div>

                            <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition flex flex-col justify-center">
                                <span class="text-[10px] text-slate-400 font-bold block mb-0.5">شروع اولین مصرف</span>
                                <span class="font-bold text-slate-800 text-[10px] block mt-0.5">${p.startAge ? `سن <span class="font-yekan">${toPersianDigits(p.startAge)}</span> سالگی` : 'ثبت نشده'}</span>
                            </div>

                            <!-- Row 4: File Status & Deactivation Details -->
                            <div class="p-1.5 ${isActive ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50 border-rose-200'} rounded-xl border flex flex-col justify-center">
                                <span class="text-[10px] ${isActive ? 'text-emerald-600' : 'text-rose-600'} font-bold block mb-0.5">وضعیت پرونده</span>
                                <span class="font-extrabold ${isActive ? 'text-emerald-800' : 'text-rose-800'} text-[10px] flex items-center gap-1 mt-0.5">
                                    ${isActive ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]"></span> فعال' : '<span class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_4px_#f43f5e]"></span> غیرفعال'}
                                </span>
                            </div>

                            ${p.status === 'غیرفعال' ? `
                            <div class="p-1.5 bg-rose-50 rounded-xl border border-rose-200 flex flex-col justify-center overflow-hidden">
                                <span class="text-[10px] text-rose-600 font-bold block mb-0.5">علت قطعی درمان</span>
                                <span class="font-extrabold text-rose-800 text-[10px] flex items-center gap-1 truncate" title="${escapeHTML(p.deactiveReason) || 'نامعلوم'}">
                                    <i class="fa-solid fa-ban text-rose-600 text-[9px]"></i> ${escapeHTML(p.deactiveReason) || 'نامعلوم'}
                                </span>
                            </div>` : `
                            <div class="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-center opacity-70">
                                <span class="text-[10px] text-slate-400 font-bold block mb-0.5">توضیحات قطع درمان</span>
                                <span class="font-bold text-slate-500 text-[10px] block mt-0.5">-</span>
                            </div>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Clinical Notes Section -->
                <div class="bg-white rounded-2xl border border-slate-200/80 p-3 space-y-2 hover:border-slate-300/80 transition duration-200 mb-2">
                    <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2 mb-2">
                        <i class="fa-solid fa-comment-medical text-teal-brand text-sm"></i>
                        <span>یادداشت‌های روانپزشکی و گزارشات بالینی</span>
                    </h4>
                    <p class="text-[11px] text-slate-700 bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-100 leading-relaxed text-justify font-semibold whitespace-pre-line">
                        ${escapeHTML(p.medicalNotes) || 'هیچ یادداشت بالینی ثبت نشده است.'}
                    </p>
                </div>
            `;
        }
    } else if (activeModalTab === 'visits') {
        const pVisits = window.visits
            .filter(v => v.patientId === p.id)
            .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        if (!pVisits.length) {
            body.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 italic font-bold">تاکنون هیچگونه ویزیت بالینی طولی برای این مراجع ثبت نشده است.</div>`;
            return;
        }

        let listHTML = `<div class="relative border-r-2 border-teal-brand pr-6 space-y-6">`;
        pVisits.forEach((v, index) => {
            // Logic to display test badges
            let testBadges = '';
            if (v.labRequest) testBadges += `<span class="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[9px] ml-1 shadow-sm">درخواست آزمایش</span>`;
            if (v.addictionTest) testBadges += `<span class="px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-[9px] ml-1 shadow-sm">درخواست تست اعتیاد</span>`;
            if (v.testResult) {
                const resColor = v.testResult === 'منفی' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200';
                testBadges += `<span class="px-2 py-0.5 ${resColor} border rounded text-[9px] shadow-sm font-bold">تست ${v.testResult}</span>`;
            }

            listHTML += `
                <div class="relative">
                    <span class="absolute -right-[31px] top-1 bg-teal-brand text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold border-2 border-white">${toPersianDigits(index + 1)}</span>
                    <div class="bg-slate-50 border rounded-2xl p-4 space-y-2">
                        <div class="flex justify-between text-xs font-bold">
                            <span class="text-teal-brand">تاریخ ویزیت: ${toPersianDigits(v.date)}</span>
                            <span class="text-slate-400">ثبت کننده: ${escapeHTML(v.recordedBy)}</span>
                        </div>
                        <div class="text-xs">پروتکل: <strong class="text-indigo-600">${escapeHTML(v.newDrug)} / ${formatDosageHTML(v.newDrug, v.newDosage)}</strong> | وضعیت مراجعه: <strong class="text-amber-600">${escapeHTML(v.status)}</strong></div>
                        ${testBadges ? `<div class="flex flex-wrap gap-1 mt-1">${testBadges}</div>` : ''}
                        <p class="text-xs text-slate-600 leading-relaxed text-justify bg-white p-3 rounded-xl border border-slate-100">${escapeHTML(v.notes)}</p>
                        <div class="flex justify-end gap-2 pt-2 border-t border-slate-200/50">
                            <button onclick="editVisitRecord('${v.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                                <i class="fa-solid fa-pen text-[9px]"></i> ویرایش ویزیت
                            </button>
                            <button onclick="deleteVisitRecord('${v.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                                <i class="fa-solid fa-trash-can text-[9px]"></i> حذف ویزیت
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        listHTML += `</div>`;
        body.innerHTML = listHTML;
    } else if (activeModalTab === 'dispense') {
        const pDispense = p.dispenseHistory || [];

        if (!pDispense.length) {
            body.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 italic font-bold border border-dashed border-slate-300 rounded-xl bg-slate-50/50">تاکنون هیچ سابقه ارائه‌ دارویی برای این مراجع ثبت نشده است.</div>`;
            return;
        }

        let html = `
            <div class="mb-3">
                <h4 class="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <i class="fa-solid fa-pills text-teal-600"></i> سوابق و تاریخچه تحویل دارو
                </h4>
            </div>
            <div class="space-y-2 font-sans relative border-r-2 border-teal-brand pr-4">
        `;

        pDispense.forEach((d, index) => {
            const unit = (d.drug.includes('قرص') || d.drug.includes('ق ') || d.drug.includes('بوپرنورفین')) ? 'میلی‌گرم' : 'سی‌سی';

            html += `
                <div class="relative">
                    <span class="absolute -right-[23px] top-3 bg-teal-brand text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold border border-white z-10"><i class="fa-solid fa-check"></i></span>
                    <div class="bg-white border border-slate-200 px-3 py-2 rounded-lg hover:border-teal-300 hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px] shadow-sm">

                        <!-- Date and icon -->
                        <div class="flex items-center gap-2 min-w-[120px]">
                            <span class="text-teal-700 font-bold flex items-center gap-1">
                                <i class="fa-regular fa-calendar text-teal-500 text-[10px]"></i>
                                <span>تحویل:</span>
                                <span class="font-yekan text-xs">${toPersianDigits(d.date)}</span>
                            </span>
                        </div>

                        <!-- Drug & Quantity (Compact Badge) -->
                        <div class="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-2 py-1 rounded border border-slate-100 flex-1 max-w-full sm:max-w-[180px]">
                            <span class="text-slate-500 font-semibold text-[10px]">دارو:</span>
                            <div class="flex items-center gap-1">
                                <span class="font-extrabold text-indigo-700">${escapeHTML(d.drug)}</span>
                                <span class="font-yekan font-black text-indigo-900 border-r border-indigo-200 pr-1 mr-1">${toPersianDigits(d.quantity)} <span class="text-[9px] font-sans font-normal">${unit}</span></span>
                            </div>
                        </div>

                        <!-- Next Appointment Date (Compact Badge) -->
                        <div class="flex items-center justify-between sm:justify-start gap-2 bg-amber-50/60 px-2 py-1 rounded border border-amber-100/50 flex-1 max-w-full sm:max-w-[170px]">
                            <span class="text-amber-700 font-semibold text-[10px]">مراجعه بعدی:</span>
                            <span class="font-bold text-amber-950 font-yekan flex items-center gap-1">
                                <i class="fa-solid fa-clock-rotate-left text-amber-500 text-[9px]"></i>
                                ${toPersianDigits(d.nextVisit)}
                            </span>
                        </div>

                        <!-- Recipient & Reporter -->
                        <div class="flex items-center justify-between sm:justify-start gap-3">
                            <!-- Recipient Badge -->
                            <span class="px-1.5 py-0.5 rounded text-[10px] ${d.recipient === 'خودش' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'} font-bold whitespace-nowrap">
                                <i class="fa-solid fa-hand-holding-hand text-slate-400 ml-1"></i>
                                ${escapeHTML(d.recipient === 'خودش' ? 'خود بیمار' : 'همراه (' + d.companion + ')')}
                            </span>

                            <!-- User name -->
                            <span class="text-slate-400 text-[9px] font-medium whitespace-nowrap flex items-center gap-0.5">
                                <i class="fa-solid fa-user-check text-slate-300"></i>
                                ${escapeHTML(d.recordedBy || 'سیستم')}
                            </span>
                        </div>

                    </div>
                </div>
            `;
        });

        html += `</div>`;
        body.innerHTML = html;
    } else if (activeModalTab === 'calls') {
        const pCalls = window.contactLogs
            .filter(c => c.patientId === p.id)
            .sort((a, b) => b.id.localeCompare(a.id)); // مرتب‌سازی نظولی (جدیدترین‌ها اول)

        let html = `
            <div class="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                <h4 class="text-xs font-black text-slate-800 mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <i class="fa-solid fa-phone-volume text-teal-600"></i> ثبت نتیجه پیگیری تلفنی جدید
                </h4>
                <form onsubmit="handleInlineCallSubmit(event)" class="text-[11px]">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
                        <div class="md:col-span-1">
                            <label class="block font-bold mb-1 text-slate-700">نتیجه تماس <span class="text-red-500">*</span></label>
                            <select id="inline-call-result" required class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20 bg-white font-semibold shadow-sm">
                                <option value="فعال می‌باشد (در حال مراجعه / در راه)">فعال می‌باشد (در حال مراجعه / در راه)</option>
                                <option value="عدم پاسخگویی (نیاز به تماس مجدد)">عدم پاسخگویی (نیاز به تماس مجدد)</option>
                                <option value="خارج از دسترس / خاموش">خارج از دسترس / خاموش</option>
                                <option value="شماره واگذار شده / اشتباه">شماره واگذار شده / اشتباه</option>
                                <option value="ترک درمان (انصراف موقت/دائم)">ترک درمان (انصراف موقت/دائم)</option>
                                <option value="مراجعه به مرکز دیگر (موازی کاری)">مراجعه به مرکز دیگر (موازی کاری)</option>
                                <option value="بستری در کمپ / زندان / بیمارستان">بستری در کمپ / زندان / بیمارستان</option>
                                <option value="فوت">فوت</option>
                                <option value="سایر موارد">سایر موارد</option>
                            </select>
                        </div>
                        <div class="md:col-span-1">
                            <label class="block font-bold mb-1 text-slate-700">اقدام بعدی / پیگیری</label>
                            <input type="text" id="inline-call-next-action" class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20 shadow-sm" placeholder="مثال: تماس مجدد فردا...">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block font-bold mb-1 text-slate-700">شرح مکالمه <span class="text-red-500">*</span></label>
                            <input type="text" id="inline-call-notes" required class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20 shadow-sm" placeholder="خلاصه توضیحات و بهانه‌ها...">
                        </div>
                    </div>
                    <div class="flex justify-end mt-3">
                        <button type="submit" class="px-4 py-1.5 bg-teal-brand text-white rounded-lg font-bold hover:bg-teal-700 shadow transition flex items-center gap-1.5">
                            <i class="fa-solid fa-plus text-[10px]"></i> ثبت لاگ تماس
                        </button>
                    </div>
                </form>
            </div>
        `;

        if (!pCalls.length) {
            html += `<div class="p-6 text-center text-xs text-slate-400 italic font-bold border border-dashed border-slate-300 rounded-xl bg-slate-50/50">تاکنون هیچگونه تماس تلفنی برای این مراجع ثبت نشده است.</div>`;
        } else {
            html += `<div class="space-y-4 relative border-r-2 border-teal-brand pr-4">`;
            pCalls.forEach(c => {
                let resultColor = 'bg-slate-100 text-slate-700 border-slate-200';
                if (c.result.includes('فعال')) resultColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                else if (c.result.includes('عدم پاسخ') || c.result.includes('خاموش')) resultColor = 'bg-amber-50 text-amber-700 border-amber-200';
                else if (c.result.includes('فوت') || c.result.includes('ترک درمان') || c.result.includes('واگذار')) resultColor = 'bg-rose-50 text-rose-700 border-rose-200';
                else if (c.result.includes('مرکز دیگر')) resultColor = 'bg-blue-50 text-blue-700 border-blue-200';

                html += `
                    <div class="relative">
                        <span class="absolute -right-[23px] top-1/2 -translate-y-1/2 bg-white text-teal-brand rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold border-2 border-teal-brand z-10"><i class="fa-solid fa-headset"></i></span>
                        <div class="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm hover:shadow transition space-y-2 text-xs">
                            <div class="flex justify-between items-start flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1 font-yekan">
                                        <i class="fa-regular fa-calendar text-[10px]"></i> ${toPersianDigits(c.date)}
                                    </span>
                                    <span class="px-2 py-0.5 rounded font-bold border text-[10px] ${resultColor}">${escapeHTML(c.result)}</span>
                                </div>
                                <span class="text-slate-400 font-medium text-[10px] flex items-center gap-1"><i class="fa-regular fa-user"></i> ${escapeHTML(c.recordedBy)}</span>
                            </div>
                            <p class="text-slate-600 font-semibold text-justify leading-relaxed mt-1"><i class="fa-solid fa-quote-right text-slate-300 ml-1"></i> ${escapeHTML(c.notes)}</p>
                            ${c.nextAction ? `<div class="bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1.5"><i class="fa-solid fa-thumbtack text-amber-500"></i> اقدام بعدی: ${escapeHTML(c.nextAction)}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        body.innerHTML = html;
    } else if (activeModalTab === 'history') {
        // Sort newest first by real timestamp. Older records saved before this fix
        // don't have `timestamp`; they fall back to 0 and sort after any timestamped
        // record (their relative order among themselves is unchanged).
        const pAudits = window.auditLogs
            .filter(a => a.patientId === p.id)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (!pAudits.length) {
            body.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 italic font-bold border border-dashed border-slate-300 rounded-xl bg-slate-50/50">تاکنون تغییری در اطلاعات پایه این پرونده ثبت و ضبط نشده است.</div>`;
            return;
        }

        let html = `
            <div class="mb-4">
                <h4 class="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <i class="fa-solid fa-clock-rotate-left text-teal-600"></i> تاریخچه تغییرات پرونده (Audit Trail)
                </h4>
                <p class="text-[10px] text-slate-400 mt-1">تمام تغییرات ایجاد شده در اطلاعات پایه بیمار به صورت خودکار در این بخش ثبت می‌گردند.</p>
            </div>
            <div class="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table class="w-full text-right border-collapse">
                    <thead class="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-gray-200">
                        <tr>
                            <th class="p-3">فیلد تغییر داده شده</th>
                            <th class="p-3">تغییر</th>
                            <th class="p-3">تاریخ و ساعت</th>
                        </tr>
                    </thead>
                    <tbody class="text-[11px] divide-y divide-gray-100 text-slate-700">
        `;

        pAudits.forEach(a => {
            html += `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-bold text-teal-700 whitespace-nowrap"><i class="fa-solid fa-pen-clip text-slate-400 ml-1"></i>${escapeHTML(a.fieldName)}</td>
                    <td class="p-3">
                        <div class="flex items-center gap-2 text-[10px] font-semibold">
                            <span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded line-through">${escapeHTML(a.oldValue)}</span>
                            <i class="fa-solid fa-arrow-left-long text-slate-300"></i>
                            <span class="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-black">${escapeHTML(a.newValue)}</span>
                        </div>
                    </td>
                    <td class="p-3 text-slate-400 font-yekan font-medium text-[10px] whitespace-nowrap">${toPersianDigits(a.date)} - ${toPersianDigits(a.time)}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        body.innerHTML = html;
    } else if (activeModalTab === 'reviews') {
        const currentReviewer = window.settings.chiefDoctorName || (window.staff.doctors && window.staff.doctors[0]) || "دکتر حسن‌پور";

        let deficiencyCheckboxesHTML = '';
        REVIEW_DEFICIENCY_OPTIONS.forEach((item, idx) => {
            deficiencyCheckboxesHTML += `<label class="flex items-center space-x-2 space-x-reverse cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition"><input type="checkbox" name="review-deficiency-item" value="${escapeHTML(item)}" onchange="updateDropdownLabel('reviewNewDeficiency')" class="rounded text-teal-brand w-4 h-4"> <span class="pr-2">${escapeHTML(item)}</span></label>`;
        });

        let html = `
            <div class="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                <h4 class="text-xs font-black text-slate-800 mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <i class="fa-solid fa-clipboard-check text-teal-600"></i> ثبت بررسی جدید پرونده (کنترل کیفیت)
                </h4>
                <form onsubmit="handleInlineReviewSubmit(event)" class="text-[11px] space-y-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label class="block font-bold mb-1 text-slate-700">تاریخ بررسی</label>
                            <input type="text" disabled class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-yekan font-bold text-center" value="${toPersianDigits(getShamsiToday())}">
                        </div>
                        <div>
                            <label class="block font-bold mb-1 text-slate-700">بررسی‌کننده (مسئول فنی)</label>
                            <input type="text" disabled class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-bold" value="${escapeHTML(currentReviewer)}">
                        </div>
                        <div class="bg-white border border-slate-200 rounded-xl p-2 flex items-center">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="review-is-complete" onchange="toggleReviewDeficiencySection()" class="rounded text-emerald-600 w-4 h-4">
                                <span class="font-bold text-slate-700">پرونده کامل است</span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div id="review-deficiency-section" class="md:col-span-2">
                            <label class="block font-bold mb-1.5 text-slate-700">موارد نقص <span class="text-red-500">*</span></label>
                            <div class="relative dropdown-container" id="dropdown-review-new-deficiency-container">
                                <button type="button" onclick="toggleDropdown('dropdown-review-new-deficiency-menu')" class="w-full flex justify-between items-center px-3 py-2 bg-white hover:bg-slate-50 border border-gray-300 rounded-xl text-[11px] font-bold text-slate-700 outline-none transition shadow-sm">
                                    <span id="dropdown-review-new-deficiency-label" class="text-slate-500 truncate max-w-[85%]">انتخاب موارد نقص...</span>
                                    <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200" id="dropdown-review-new-deficiency-icon"></i>
                                </button>
                                <div id="dropdown-review-new-deficiency-menu" class="hidden min-w-[220px] absolute right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2.5 max-h-52 overflow-y-auto custom-scrollbar space-y-1.5 animate-fade-in">
                                    ${deficiencyCheckboxesHTML}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block font-bold mb-1 text-slate-700">توضیحات</label>
                            <textarea id="review-notes" rows="1" class="w-full h-[38px] px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20 shadow-sm resize-none" placeholder="توضیحات تکمیلی مسئول فنی..."></textarea>
                        </div>
                    </div>

                    <div class="flex justify-end">
                        <button type="submit" class="px-4 py-1.5 bg-teal-brand text-white rounded-lg font-bold hover:bg-teal-700 shadow transition flex items-center gap-1.5">
                            <i class="fa-solid fa-plus text-[10px]"></i> ثبت بررسی پرونده
                        </button>
                    </div>
                </form>
            </div>
        `;

        const pReviews = window.patientReviews
            .filter(r => r.patientId === p.id)
            .sort((a, b) => b.id.localeCompare(a.id));

        if (!pReviews.length) {
            html += `<div class="p-6 text-center text-xs text-slate-400 italic font-bold border border-dashed border-slate-300 rounded-xl bg-slate-50/50">تاکنون هیچ بررسی کنترل کیفیتی برای این پرونده ثبت نشده است.</div>`;
        } else {
            html += `
                <div class="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                    <table class="w-full text-right border-collapse">
                        <thead class="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-gray-200">
                            <tr>
                                <th class="p-3">تاریخ</th>
                                <th class="p-3">بررسی‌کننده</th>
                                <th class="p-3">نتیجه بررسی</th>
                                <th class="p-3">موارد نقص</th>
                                <th class="p-3">توضیحات</th>
                            </tr>
                        </thead>
                        <tbody class="text-[11px] divide-y divide-gray-100 text-slate-700">
            `;
            pReviews.forEach(r => {
                html += `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="p-3 font-yekan font-bold text-teal-700 whitespace-nowrap">${toPersianDigits(r.date)}</td>
                        <td class="p-3">${escapeHTML(r.reviewer)}</td>
                        <td class="p-3">
                            ${r.isComplete
                                ? `<span class="px-2 py-0.5 rounded font-bold border text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">کامل</span>`
                                : `<span class="px-2 py-0.5 rounded font-bold border text-[10px] bg-rose-50 text-rose-700 border-rose-200">ناقص</span>`
                            }
                        </td>
                        <td class="p-3">${r.deficiencies && r.deficiencies.length ? escapeHTML(r.deficiencies.join('، ')) : '-'}</td>
                        <td class="p-3 text-slate-500">${r.notes ? escapeHTML(r.notes) : '-'}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        }

        body.innerHTML = html;
    }

    bindDigitConverters(); // اتصال رویدادها به فیلدهای مودال پس از رندر
}

// Toggle visibility of deficiency multi-select when "پرونده کامل است" is checked/unchecked
function toggleReviewDeficiencySection() {
    const isComplete = document.getElementById('review-is-complete').checked;
    const section = document.getElementById('review-deficiency-section');
    if (!section) return;
    if (isComplete) {
        section.classList.add('hidden');
        // Uncheck all deficiency checkboxes when marked as complete
        document.querySelectorAll('#dropdown-review-new-deficiency-menu input[type="checkbox"]').forEach(c => c.checked = false);
        updateDropdownLabel('reviewNewDeficiency');
    } else {
        section.classList.remove('hidden');
    }
}

// Handle submission of a new patient file review record
window.handleInlineReviewSubmit = function(event) {
    event.preventDefault();
    const p = activePatientForModal;
    if (!p) return;

    const isComplete = document.getElementById('review-is-complete').checked;
    const deficiencies = [];
    document.querySelectorAll('#dropdown-review-new-deficiency-menu input[type="checkbox"]:checked').forEach(c => {
        deficiencies.push(c.value);
    });

    if (!isComplete && deficiencies.length === 0) {
        showCustomAlert("خطای فرم", "در صورت ناقص بودن پرونده، لطفاً حداقل یک مورد نقص را انتخاب کنید.");
        return;
    }

    const currentReviewer = window.settings.chiefDoctorName || (window.staff.doctors && window.staff.doctors[0]) || "دکتر حسن‌پور";
    const currentDate = getShamsiToday();
    const currentTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const reviewPayload = {
        id: crypto.randomUUID(),
        patientId: p.id,
        patientName: p.fullName || (p.name + ' ' + p.lastname),
        date: currentDate,
        reviewer: currentReviewer,
        isComplete: isComplete,
        deficiencies: isComplete ? [] : deficiencies,
        notes: document.getElementById('review-notes').value,
        recordedBy: currentReviewer
    };

    window.patientReviews.unshift(reviewPayload);
    dbPutRecord('patientReviews', reviewPayload);

    // Also register this review in the patient's audit trail (تغییرات پرونده)
    const auditPayload = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        patientId: p.id,
        fieldName: "بررسی پرونده",
        oldValue: "-",
        newValue: isComplete ? "بررسی پرونده انجام شد (کامل)" : "بررسی پرونده انجام شد (ناقص)",
        date: currentDate,
        time: currentTime,
        recordedBy: currentReviewer
    };
    window.auditLogs.unshift(auditPayload);
    dbPutRecord('auditLogs', auditPayload);

    triggerBackupReminder();

    // Re-render the active modal tab immediately to show newly added review
    renderModalTabBody();

    showToast("بررسی پرونده با موفقیت ثبت شد.");
};

// Inline Save Controller within Modal Workspace
window.saveModalInlineChanges = function(event) {
    event.preventDefault();
    const p = activePatientForModal;
    if (!p) return;

    const nationalId = normalizeIdentifierValue(document.getElementById('m-p-nationalId').value);
    // The national ID field is OPTIONAL — only validate format/uniqueness when the user
    // actually entered something (empty is a valid, permanent state and must not block save).
    if (nationalId) {
        if (!validateIranianNationalId(nationalId)) {
            showCustomAlert("خطای ورود اطلاعات", "کد ملی وارد شده نامعتبر است!");
            return;
        }
        const isDuplicate = window.patients.some(other => other.nationalId === nationalId && other.id !== p.id);
        if (isDuplicate) {
            showCustomAlert("خطای ورود اطلاعات", "کد ملی تکراری است و به قسمت مدیریت مراجعین مراجعه کنید");
            return;
        }
    }

    const isInsuranceChanged = p.insurance !== document.getElementById('m-p-insurance').value;
    const medHistories = [];
    document.querySelectorAll('input[name="m-p-med"]:checked').forEach(chk => {
        medHistories.push(chk.value);
    });

    // Find current and record changes to audits
    const formCode = parseInt(document.getElementById('m-p-code').value);
    if (isNaN(formCode)) {
        showCustomAlert("خطای فرم", "کد پرونده نامعتبر است.");
        return;
    }
    // این بررسی، لایه‌ی نهایی و قطعی جلوگیری از کد پرونده تکراری است: مستقل از هشدار
    // زنده‌ی بالای فیلد، درست قبل از ذخیره‌ی واقعی در دیتابیس دوباره اجرا می‌شود تا حتی
    // اگر هشدار نادیده گرفته شود یا با دور زدن UI ذخیره صورت گیرد، دو پرونده هرگز کد
    // یکسان نگیرند. رکورد خود همین بیمار (p.id) از این بررسی مستثنی است.
    if (isPatientCodeTaken(formCode, p.id)) {
        showCustomAlert("خطای ویرایش سریع", "این کد پرونده قبلاً برای بیمار دیگری ثبت شده است. لطفاً کد پرونده دیگری وارد کنید.");
        return;
    }
    const formFullName = document.getElementById('m-p-fullName').value;
    const formPhone = normalizeIdentifierValue(document.getElementById('m-p-phone').value);
    const formStatus = document.getElementById('m-p-status').value;
    const formAttendance = document.getElementById('m-p-attendance').value;
    const formInsurance = document.getElementById('m-p-insurance').value;
    const formSystemRegistered = document.getElementById('m-p-systemRegistered').value;
    const formCounselor = document.getElementById('m-p-counselor').value;
    const formDrug = document.getElementById('m-p-drug').value;
    const formDosage = parseFloat(document.getElementById('m-p-dosage').value) || 0;
    const formPriority = formDrug === 'اپیوم' ? (document.getElementById('m-p-priority') ? document.getElementById('m-p-priority').value : '') : '';
    const formInitialDrug = document.getElementById('m-p-initialDrug').value;
    const formInitialDosage = parseFloat(document.getElementById('m-p-initialDosage').value) || 0;
    const formInitialPriority = formInitialDrug === 'اپیوم' ? (document.getElementById('m-p-initialPriority') ? document.getElementById('m-p-initialPriority').value : '') : '';

    // Validate deactive reason inside inline Modal
    const deReason = document.getElementById('m-p-deactiveReason') ? document.getElementById('m-p-deactiveReason').value : '';
    const deNotes = document.getElementById('m-p-deactiveNotes') ? document.getElementById('m-p-deactiveNotes').value : '';

    if (formStatus === 'غیرفعال' && !deReason) {
        showCustomAlert("خطای فرم", "لطفاً علت غیرفعال شدن پرونده را تعیین کنید!");
        return;
    }

    // اولویت اپیوم یک فیلد اختیاری است و مانع ذخیره فرم نمی‌شود.

    const patName = p.fullName || (p.name + ' ' + p.lastname);
    if (p.code !== formCode) logChange(p.id, "کد پرونده", p.code, formCode);
    if (patName !== formFullName) logChange(p.id, "نام و نام خانوادگی", patName, formFullName);
    if (p.phone !== formPhone) logChange(p.id, "شماره تماس مراجع", p.phone, formPhone);
    if (p.status !== formStatus) logChange(p.id, "وضعیت پرونده", p.status, formStatus);
    if (p.attendance !== formAttendance) logChange(p.id, "نظم حضور", p.attendance, formAttendance);
    if (p.insurance !== formInsurance) logChange(p.id, "وضعیت بیمه", p.insurance, formInsurance);
    if ((p.systemRegistered || 'خیر') !== formSystemRegistered) logChange(p.id, "ثبت در سامانه", p.systemRegistered || 'خیر', formSystemRegistered);
    if (p.counselor !== formCounselor) logChange(p.id, "مشاور (روانشناس)", p.counselor || "-", formCounselor || "-");
    if (p.currentDrug !== formDrug) logChange(p.id, "درمان دارویی فعلی", p.currentDrug, formDrug);
    if (p.currentDosage !== formDosage) logChange(p.id, "دوز تجویزی فعلی", p.currentDosage, formDosage);
    if ((p.currentPriority || '') !== formPriority) logChange(p.id, "اولویت اپیوم", p.currentPriority || "-", formPriority || "-");
    if (p.initialDrug !== formInitialDrug) logChange(p.id, "پروتکل دارویی اولیه", p.initialDrug, formInitialDrug);
    if (p.initialDosage !== formInitialDosage) logChange(p.id, "دوز دارویی اولیه", p.initialDosage, formInitialDosage);
    if ((p.initialPriority || '') !== formInitialPriority) logChange(p.id, "اولویت اپیوم (اولیه)", p.initialPriority || "-", formInitialPriority || "-");
    if (p.deactiveReason !== deReason) logChange(p.id, "علت غیرفعال‌سازی", p.deactiveReason || "-", deReason || "-");

    // Save payload changes directly to active in-memory object reference
    p.code = formCode;
    p.fullName = formFullName;
    p.nationalId = nationalId;
    p.birthdate = document.getElementById('m-p-birthdate').value;
    p.age = parseInt(document.getElementById('m-p-age').value);
    p.phone = formPhone;
    p.admissionDate = document.getElementById('m-p-admissionDate').value;
    p.marital = document.getElementById('m-p-marital').value;
    p.employment = document.getElementById('m-p-employment').value;
    p.job = document.getElementById('m-p-job').value;
    p.attempts = document.getElementById('m-p-attempts').value;
    p.counselor = formCounselor;
    p.substance = document.getElementById('m-p-substance').value;
    p.startAge = parseInt(document.getElementById('m-p-startAge').value) || 0;
    p.duration = parseInt(document.getElementById('m-p-duration').value) || 0;
    p.currentDrug = formDrug;
    p.currentDosage = formDosage;
    p.currentPriority = formPriority;
    p.initialDrug = formInitialDrug;
    p.initialDosage = formInitialDosage;
    p.initialPriority = formInitialPriority;
    p.status = formStatus;

    // Set default attendance to absent if deactivated
    p.attendance = formStatus === 'غیرفعال' ? 'غیبت' : formAttendance;
    p.insurance = formInsurance;
    p.systemRegistered = formSystemRegistered;
    p.medHistory = medHistories;
    p.medicalNotes = document.getElementById('m-p-medicalNotes').value;
    p.deactiveReason = formStatus === 'غیرفعال' ? deReason : '';
    p.deactiveNotes = formStatus === 'غیرفعال' ? deNotes : '';

    if (isInsuranceChanged) {
        const newInsLog = {
            id: crypto.randomUUID(),
            patientId: p.id,
            insuranceStatus: formInsurance,
            date: new Date().toLocaleDateString('fa-IR'),
            recordedBy: "دکتر حسن‌پور"
        };
        window.insuranceHistory.unshift(newInsLog);
        dbPutRecord('insuranceHistory', newInsLog);
    }

    // Sync database & save
    const targetIndex = window.patients.findIndex(pat => pat.id === p.id);
    if (targetIndex > -1) {
        window.patients[targetIndex] = p;
    }

    dbPutRecord('patients', p);
    // یکپارچه‌سازی دوطرفه اولویت اپیوم: اگر بیمار عضو فهرست مدیریت اپیوم است، اولویت تازه در آن فهرست هم منعکس شود.
    if (typeof opSyncMemberPriorityFromPatient === 'function') { try { opSyncMemberPriorityFromPatient(p.id, formPriority); } catch (e) {} }
    triggerBackupReminder();

    toggleModalInlineEdit(false);

    // Re-render other list items instantly
    renderPatientsList();
    renderDashboard();
    renderVisitsList();
    if (typeof renderOpiumPage === 'function' && document.getElementById('tab-opium') && !document.getElementById('tab-opium').classList.contains('hidden')) { try { renderOpiumPage(); } catch (e) {} }

    showToast("اطلاعات مراجع با موفقیت به صورت درجا و سریع بروزرسانی شد.");
};
