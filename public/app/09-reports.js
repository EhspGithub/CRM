// نسیم رهایی — گزارش‌ساز سفارشی
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

// 7. REPORT BUILDER tab
function resetReportBuilder() {
    // Uncheck all custom dropdown checkboxes
    document.querySelectorAll('#dropdown-drugs-menu input[type="checkbox"]').forEach(c => c.checked = false);
    document.querySelectorAll('#dropdown-ages-menu input[type="checkbox"]').forEach(c => c.checked = false);
    document.querySelectorAll('#dropdown-substances-menu input[type="checkbox"]').forEach(c => c.checked = false);
    document.querySelectorAll('#dropdown-meds-menu input[type="checkbox"]').forEach(c => c.checked = false);

    // Reset labels and styling of dropdown buttons
    updateDropdownLabel('drugs');
    updateDropdownLabel('ages');
    updateDropdownLabel('substances');
    updateDropdownLabel('meds');

    // Reset search query
    const reportSearchInput = document.getElementById('rep-filter-search');
    if (reportSearchInput) {
        reportSearchInput.value = '';
    }

    document.getElementById('rep-filter-status').value = '';
    document.getElementById('rep-filter-gender').value = '';
    document.getElementById('rep-filter-marital').value = '';
    document.getElementById('rep-filter-insurance').value = '';
    document.getElementById('rep-filter-system').value = '';
    document.getElementById('rep-filter-systemReason').value = '';
    document.getElementById('rep-filter-counselor').value = '';
    if (document.getElementById('rep-filter-camp')) document.getElementById('rep-filter-camp').value = '';

    // Reset sort order to default (کد پرونده)
    const sortSelect = document.getElementById('rep-sort-by');
    if (sortSelect) sortSelect.value = 'code';

    // Initial drug / initial dosage filter reset
    document.getElementById('rep-filter-initialDrug').value = '';
    document.getElementById('rep-filter-initialDosage').value = '';

    // Code-range filter reset
    document.getElementById('rep-filter-codeFrom').value = '';
    document.getElementById('rep-filter-codeTo').value = '';

    // Deactive reason builder reset
    document.getElementById('rep-filter-deactiveReason').value = '';

    // Dynamic columns reset (as updated in previous turns)
    document.getElementById('rep-col-nationalid').checked = true;
    document.getElementById('rep-col-birthdate').checked = false;
    document.getElementById('rep-col-phone').checked = true;
    document.getElementById('rep-col-age').checked = false;
    document.getElementById('rep-col-substance').checked = false;
    document.getElementById('rep-col-drug').checked = true;
    document.getElementById('rep-col-dosage').checked = true;
    document.getElementById('rep-col-meds').checked = false;
    document.getElementById('rep-col-status').checked = true;
    document.getElementById('rep-col-deactivereason').checked = true;
    document.getElementById('rep-col-lastvisit').checked = false;
    document.getElementById('rep-col-admissiondate').checked = false;
    document.getElementById('rep-col-medicalnotes').checked = false;
    document.getElementById('rep-col-systemreason').checked = false;
    if (document.getElementById('rep-col-camp')) document.getElementById('rep-col-camp').checked = false;

    const header = document.getElementById('report-table-header');
    header.innerHTML = '<tr><th class="p-4">جدول خالی</th></tr>';
    const body = document.getElementById('report-table-body');
    body.innerHTML = '<tr><td class="p-8 text-center text-slate-400 italic font-bold">جهت بارگذاری اطلاعات ابتدا دکمه ساخت و اعمال گزارش را بفشارید.</td></tr>';

    tableState.reports = { data: [], cols: {}, page: 1, limit: tableState.reports.limit };
    const countBadge = document.getElementById('report-result-count');
    if (countBadge) countBadge.innerText = 'تعداد نتایج یافت‌شده: ۰ مورد';
    const paginationContainer = document.getElementById('reports-pagination-ui');
    if (paginationContainer) paginationContainer.innerHTML = '';
}

function getCheckedValuesFromGroup(containerId) {
    const arr = [];
    document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`).forEach(c => {
        arr.push(c.value);
    });
    return arr;
}

function toggleDropdown(menuId) {
    const dropdownMenus = ['dropdown-drugs-menu', 'dropdown-ages-menu', 'dropdown-substances-menu', 'dropdown-meds-menu', 'dropdown-review-new-deficiency-menu', 'dropdown-rep-review-deficiency-menu'];
    dropdownMenus.forEach(id => {
        if (id !== menuId) {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
            const icon = document.getElementById(id.replace('-menu', '-icon'));
            if (icon) icon.classList.remove('rotate-180');
        }
    });

    const menu = document.getElementById(menuId);
    const icon = document.getElementById(menuId.replace('-menu', '-icon'));
    if (menu) {
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
            menu.classList.remove('hidden');
            if (icon) icon.classList.add('rotate-180');
        } else {
            menu.classList.add('hidden');
            if (icon) icon.classList.remove('rotate-180');
        }
    }
}

function updateDropdownLabel(type) {
    let selector, labelId, defaultText;
    if (type === 'drugs') {
        selector = '#dropdown-drugs-menu input[type="checkbox"]:checked';
        labelId = 'dropdown-drugs-label';
        defaultText = 'همه داروها';
    } else if (type === 'ages') {
        selector = '#dropdown-ages-menu input[type="checkbox"]:checked';
        labelId = 'dropdown-ages-label';
        defaultText = 'همه رده‌های سنی';
    } else if (type === 'substances') {
        selector = '#dropdown-substances-menu input[type="checkbox"]:checked';
        labelId = 'dropdown-substances-label';
        defaultText = 'همه مواد مصرفی';
    } else if (type === 'meds') {
        selector = '#dropdown-meds-menu input[type="checkbox"]:checked';
        labelId = 'dropdown-meds-label';
        defaultText = 'همه بیماری‌ها';
    } else if (type === 'reviewNewDeficiency') {
        selector = '#dropdown-review-new-deficiency-menu input[type="checkbox"]:checked';
        labelId = 'dropdown-review-new-deficiency-label';
        defaultText = 'انتخاب موارد نقص...';
    } else if (type === 'repReviewDeficiency') {
        selector = '#dropdown-rep-review-deficiency-menu input[type="checkbox"]:checked';
        labelId = 'dropdown-rep-review-deficiency-label';
        defaultText = 'همه موارد';
    }

    const checkedCount = document.querySelectorAll(selector).length;
    const labelEl = document.getElementById(labelId);
    if (labelEl) {
        if (checkedCount === 0) {
            labelEl.innerText = defaultText;
            labelEl.className = "text-slate-500 font-semibold";
        } else {
            labelEl.innerText = `${checkedCount} مورد انتخاب شده`;
            labelEl.className = "text-teal-brand font-black";
        }
    }
}

// Close dropdowns when clicking outside
window.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown-container')) {
        const dropdownMenus = ['dropdown-drugs-menu', 'dropdown-ages-menu', 'dropdown-substances-menu', 'dropdown-meds-menu', 'dropdown-review-new-deficiency-menu', 'dropdown-rep-review-deficiency-menu'];
        dropdownMenus.forEach(id => {
            const menu = document.getElementById(id);
            if (menu) menu.classList.add('hidden');
            const icon = document.getElementById(id.replace('-menu', '-icon'));
            if (icon) icon.classList.remove('rotate-180');
        });
    }
});

// مرتب‌سازی درجا (in-place) لیست گزارش: 'code' = کد پرونده صعودی، 'name' = الفبایی نام و نام خانوادگی
function sortReportPatients(list, mode) {
    const byCode = (a, b) => Number(a.code) - Number(b.code);
    if (mode === 'name') {
        // یکسان‌سازی حروف عربی/فارسی (ي/ی و ك/ک) تا ترتیب الفبایی درست باشد
        const norm = p => String(p.fullName || ((p.name || '') + ' ' + (p.lastname || '')))
            .replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
        list.sort((a, b) => norm(a).localeCompare(norm(b), 'fa') || byCode(a, b));
    } else {
        list.sort(byCode);
    }
    return list;
}

// تغییر ترتیب گزارشِ فعلی بدون اعمال دوباره‌ی فیلترها و ستون‌ها
function applyReportSort() {
    const state = tableState.reports;
    if (!state || !state.data || !state.data.length) return;
    const mode = document.getElementById('rep-sort-by').value;
    renderReportBuilderTable(sortReportPatients([...state.data], mode), state.cols);
}

function buildCustomReport() {
    const drugs = getCheckedValuesFromGroup('dropdown-drugs-menu');
    const ages = getCheckedValuesFromGroup('dropdown-ages-menu');
    const substances = getCheckedValuesFromGroup('dropdown-substances-menu');
    const meds = getCheckedValuesFromGroup('dropdown-meds-menu');

    const status = document.getElementById('rep-filter-status').value;
    const gender = document.getElementById('rep-filter-gender').value;
    const marital = document.getElementById('rep-filter-marital').value;
    const insurance = document.getElementById('rep-filter-insurance').value;
    const systemReg = document.getElementById('rep-filter-system').value;
    const systemReasonFilterVal = document.getElementById('rep-filter-systemReason').value;
    const counselorFilterVal = document.getElementById('rep-filter-counselor').value;
    const campFilterVal = (document.getElementById('rep-filter-camp') || {}).value || '';

    // Gather initial drug / initial dosage filter values
    const initialDrugFilterVal = document.getElementById('rep-filter-initialDrug').value;
    const initialDosageFilterRaw = document.getElementById('rep-filter-initialDosage').value.trim();
    const initialDosageFilterVal = initialDosageFilterRaw === '' ? null : parseFloat(initialDosageFilterRaw);

    // Patient-code range filter: blank = no bound on that side
    const codeFromRaw = document.getElementById('rep-filter-codeFrom').value.trim();
    const codeToRaw = document.getElementById('rep-filter-codeTo').value.trim();
    const codeFromVal = codeFromRaw === '' ? null : parseInt(codeFromRaw, 10);
    const codeToVal = codeToRaw === '' ? null : parseInt(codeToRaw, 10);

    // Gather deactive Reason filter value
    const deactiveReasonFilterVal = document.getElementById('rep-filter-deactiveReason').value;

    // Gather search query value
    const searchQuery = document.getElementById('rep-filter-search').value.trim().toLowerCase();

    // Apply Multi-Filter Configuration
    const filtered = window.patients.filter(p => {
        let drugMatch = !drugs.length || drugs.includes(p.currentDrug);
        if (drugs.includes('داروی نامعلوم')) {
            if (!p.currentDrug || !['روان درمانی', 'ش متادون', 'ق متادون', 'بوپرنورفین', 'اپیوم'].includes(p.currentDrug)) {
                drugMatch = true;
            }
        }

        const substanceMatch = !substances.length || substances.includes(p.substance);
        const statusMatch = status === '' || p.status === status;
        const genderMatch = gender === '' || p.gender === gender;
        const maritalMatch = marital === '' || p.marital === marital;
        const insuranceMatch = insurance === '' || p.insurance === insurance;
        const systemMatch = systemReg === '' || (p.systemRegistered || 'خیر') === systemReg;
        // علت عدم ثبت فقط برای مراجعینی معتبر است که هم‌اکنون «ثبت در سامانه = خیر» هستند
        // (همسو با منطق ستون «علت عدم ثبت در سامانه» در جدول گزارش)
        const systemReasonMatch = systemReasonFilterVal === '' || ((p.systemRegistered || 'خیر') === 'خیر' && p.systemNotRegisteredReason === systemReasonFilterVal);
        const counselorMatch = counselorFilterVal === '' || p.counselor === counselorFilterVal;

        // سابقه اقامت در کمپ
        let campMatch = true;
        if (campFilterVal) {
            const cs = campSummary(p);
            if (campFilterVal === 'has') campMatch = cs.has;
            else if (campFilterVal === 'multi') campMatch = cs.count >= 2;
            else if (campFilterVal === 'recent') campMatch = campWithinDays(p, 365);
            else if (campFilterVal === 'none') campMatch = cs.recorded && !cs.has;
            else if (campFilterVal === 'unknown') campMatch = !cs.recorded;
        }

        // Initial drug / initial dosage match (dosage compared against the raw numeric
        // value stored in the system, so unit — mg vs cc — never causes a mismatch)
        const initialDrugMatch = initialDrugFilterVal === '' || p.initialDrug === initialDrugFilterVal;
        const initialDosageMatch = initialDosageFilterVal === null || parseFloat(p.initialDosage) === initialDosageFilterVal;

        // Code-range match: patient code must fall within [from, to] where each side is provided
        const codeMatch = (codeFromVal === null || Number(p.code) >= codeFromVal) && (codeToVal === null || Number(p.code) <= codeToVal);

        // Reason filter logic
        const deactiveReasonMatch = deactiveReasonFilterVal === '' || p.deactiveReason === deactiveReasonFilterVal;

        // Search logic
        const patName = p.fullName || (p.name + ' ' + p.lastname);
        const searchMatch = !searchQuery || 
                            patName.toLowerCase().includes(searchQuery) || 
                            p.code.toString().includes(searchQuery) || 
                            (p.nationalId || '').includes(searchQuery);

        // Age group match
        let ageMatch = true;
        if (ages.length) {
            ageMatch = false;
            ages.forEach(range => {
                if (range === '15-20' && p.age >= 15 && p.age <= 20) ageMatch = true;
                if (range === '20-30' && p.age >= 20 && p.age <= 30) ageMatch = true;
                if (range === '30-40' && p.age >= 30 && p.age <= 40) ageMatch = true;
                if (range === '40-50' && p.age >= 40 && p.age <= 50) ageMatch = true;
                if (range === '50-60' && p.age >= 50 && p.age <= 60) ageMatch = true;
                if (range === '60-70' && p.age >= 60 && p.age <= 70) ageMatch = true;
                if (range === '70-80' && p.age >= 70 && p.age <= 80) ageMatch = true;
                if (range === '80+' && p.age >= 80) ageMatch = true;
            });
        }

        // Med categories match
        let medMatch = true;
        if (meds.length && p.medHistory) {
            medMatch = false;
            p.medHistory.forEach(disease => {
                if (meds.includes(disease)) medMatch = true;
            });
        }

        return drugMatch && substanceMatch && statusMatch && genderMatch && maritalMatch && insuranceMatch && systemMatch && systemReasonMatch && counselorMatch && campMatch && ageMatch && medMatch && deactiveReasonMatch && searchMatch && initialDrugMatch && initialDosageMatch && codeMatch;
    });

    // مرتب‌سازی صعودی: از کد کمتر در بالا به کد بیشتر در پایین
    sortReportPatients(filtered, document.getElementById('rep-sort-by').value);

    // Map out Selected Dynamic Columns
    const cols = {
        code: true, // Required
        name: true, // Required
        nationalId: document.getElementById('rep-col-nationalid').checked,
        birthdate: document.getElementById('rep-col-birthdate').checked,
        phone: document.getElementById('rep-col-phone').checked,
        age: document.getElementById('rep-col-age').checked,
        substance: document.getElementById('rep-col-substance').checked,
        drug: document.getElementById('rep-col-drug').checked,
        dosage: document.getElementById('rep-col-dosage').checked,
        meds: document.getElementById('rep-col-meds').checked,
        status: document.getElementById('rep-col-status').checked,

        // Dynamic column checked binding
        deactiveReason: document.getElementById('rep-col-deactivereason').checked,

        lastVisit: document.getElementById('rep-col-lastvisit').checked,
        admissionDate: document.getElementById('rep-col-admissiondate').checked,
        medicalNotes: document.getElementById('rep-col-medicalnotes').checked,
        systemReason: document.getElementById('rep-col-systemreason').checked,
        camp: !!(document.getElementById('rep-col-camp') || {}).checked
    };

    renderReportBuilderTable(filtered, cols);
}

// Builds the <td> cells for a single report row. Shared between the on-screen paginated
// table and the full (unpaginated) printable report, so both stay pixel-for-pixel identical.
function buildReportRowHTML(p, cols, firstVisitByPatient) {
    const lastVisit = firstVisitByPatient.get(p.id);
    const lastVisitDate = lastVisit ? lastVisit.date : p.admissionDate;

    let rowHTML = `
        <td class="p-4 font-bold text-teal-brand font-yekan">${toPersianDigits(p.code)}</td>
        <td class="p-4 font-bold text-slate-800">${escapeHTML(p.fullName || (p.name + ' ' + p.lastname))}</td>
    `;

    if (cols.nationalId) rowHTML += `<td class="p-4 font-yekan tracking-widest text-slate-700">${toPersianDigits(p.nationalId)}</td>`;
    if (cols.birthdate) rowHTML += `<td class="p-4 font-yekan text-slate-700">${p.birthdate ? toPersianDigits(p.birthdate) : '-'}</td>`;
    if (cols.phone) rowHTML += `<td class="p-4 font-yekan tracking-widest text-slate-700" dir="ltr">${toPersianDigits(p.phone)}</td>`;
    if (cols.age) rowHTML += `<td class="p-4"><span class="font-yekan font-bold text-slate-700">${toPersianDigits(p.age)}</span> سال | ${escapeHTML(p.marital)}</td>`;
    if (cols.substance) rowHTML += `<td class="p-4">${escapeHTML(p.substance)}</td>`;
    if (cols.drug) rowHTML += `<td class="p-4">${escapeHTML(p.currentDrug)}${(p.currentDrug === 'اپیوم' && p.currentPriority) ? `<span class="text-slate-400 font-normal mx-0.5">/</span>${escapeHTML(p.currentPriority)}` : ''}</td>`;
    if (cols.dosage) rowHTML += `<td class="p-4 font-yekan font-bold text-indigo-600">${formatDosageHTML(p.currentDrug, p.currentDosage)}</td>`;
    if (cols.meds) rowHTML += `<td class="p-4">${p.medHistory && p.medHistory.length ? escapeHTML(p.medHistory.join('، ')) : 'بدون سابقه'}</td>`;
    if (cols.status) rowHTML += `<td class="p-4 font-bold">${escapeHTML(p.status)}</td>`;

    // Reason and description values inside custom report row
    if (cols.deactiveReason) {
        rowHTML += `
            <td class="p-4 text-rose-700 font-bold">
                ${p.status === 'غیرفعال' ? `${escapeHTML(p.deactiveReason) || 'علت نامشخص'} ${p.deactiveNotes ? `<span class="text-[10px] text-slate-400 block font-normal">${escapeHTML(p.deactiveNotes)}</span>` : ''}` : '-'}
            </td>
        `;
    }

    if (cols.lastVisit) rowHTML += `<td class="p-4 font-yekan text-slate-700">${toPersianDigits(lastVisitDate)}</td>`;
    if (cols.admissionDate) rowHTML += `<td class="p-4 font-yekan text-slate-700">${p.admissionDate ? toPersianDigits(p.admissionDate) : '-'}</td>`;

    // Small font per spec, since clinical notes can be lengthy free text.
    if (cols.medicalNotes) rowHTML += `<td class="p-4 text-[10px] text-slate-500 max-w-[220px] align-top">${p.medicalNotes ? escapeHTML(p.medicalNotes) : '-'}</td>`;

    // Only shown when the CURRENT status is actually "خیر" — a reason left over from a
    // past "خیر" period must not appear once the patient has since been marked "بله".
    if (cols.systemReason) {
        const isCurrentlyUnregistered = (p.systemRegistered || 'خیر') === 'خیر';
        let reasonText = '-';
        if (isCurrentlyUnregistered && p.systemNotRegisteredReason) {
            reasonText = escapeHTML(p.systemNotRegisteredReason);
            if (p.systemNotRegisteredReason === 'ثبت در مرکز دیگر' && p.systemOtherCenterName) {
                reasonText += ` (${escapeHTML(p.systemOtherCenterName)})`;
            }
        }
        rowHTML += `<td class="p-4 text-amber-700 font-bold">${reasonText}</td>`;
    }
    if (cols.camp) {
        const cs = campSummary(p);
        const txt = campSummaryText(p);
        rowHTML += `<td class="p-4 text-[11px] font-yekan ${cs.has ? 'text-amber-800 font-bold' : 'text-slate-400'}">${escapeHTML(txt)}</td>`;
    }

    return rowHTML;
}

function renderReportBuilderTable(dataset, cols) {
    const header = document.getElementById('report-table-header');
    const body = document.getElementById('report-table-body');
    const countBadge = document.getElementById('report-result-count');
    const paginationContainer = document.getElementById('reports-pagination-ui');

    header.innerHTML = '';
    body.innerHTML = '';

    // Store the FULL (unpaginated) matched result set — this is the single source of
    // truth for the result count, the printable report, and the on-screen pagination.
    tableState.reports.data = dataset;
    tableState.reports.cols = cols;
    tableState.reports.page = 1;

    if (countBadge) countBadge.innerText = `تعداد نتایج یافت‌شده: ${toPersianDigits(dataset.length)} مورد`;

    const printReportCount = document.querySelector('#printable-report-area #print-report-count');
    const printCurrentDate = document.querySelector('#printable-report-area #print-current-date');
    const printableHead = document.querySelector('#printable-report-area #printable-table-header');
    const printableBody = document.querySelector('#printable-report-area #printable-table-body');
    if (printCurrentDate) printCurrentDate.innerText = toPersianDigits(new Date().toLocaleDateString('fa-IR'));

    if (!dataset.length) {
        body.innerHTML = '<tr><td class="p-8 text-center text-red-500 font-bold">هیچ رکوردی منطبق بر فیلترهای بالا یافت نشد.</td></tr>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        if (printReportCount) printReportCount.innerText = toPersianDigits(0);
        if (printableBody) printableBody.innerHTML = '';
        if (printableHead) printableHead.innerHTML = '';
        return;
    }

    // Build Header Row (shared by the on-screen table and the printable report)
    const trHead = document.createElement('tr');
    trHead.innerHTML += `<th class="p-4">کد</th>`;
    trHead.innerHTML += `<th class="p-4">نام و نام خانوادگی</th>`;
    if (cols.nationalId) trHead.innerHTML += `<th class="p-4">کد ملی</th>`;
    if (cols.birthdate) trHead.innerHTML += `<th class="p-4">تاریخ تولد</th>`;
    if (cols.phone) trHead.innerHTML += `<th class="p-4">شماره تماس</th>`;
    if (cols.age) trHead.innerHTML += `<th class="p-4">سن و تاهل</th>`;
    if (cols.substance) trHead.innerHTML += `<th class="p-4">ماده اصلی</th>`;
    if (cols.drug) trHead.innerHTML += `<th class="p-4">درمان فعلی</th>`;
    if (cols.dosage) trHead.innerHTML += `<th class="p-4">دوز فعلی</th>`;
    if (cols.meds) trHead.innerHTML += `<th class="p-4">بیماری زمینه‌ای</th>`;
    if (cols.status) trHead.innerHTML += `<th class="p-4">وضعیت</th>`;

    // Table header cell for reason of inactivity
    if (cols.deactiveReason) trHead.innerHTML += `<th class="p-4 text-rose-600 font-bold">علت غیرفعال‌سازی / توضیحات</th>`;

    if (cols.lastVisit) trHead.innerHTML += `<th class="p-4">آخرین مراجعه</th>`;
    if (cols.admissionDate) trHead.innerHTML += `<th class="p-4">تاریخ پذیرش</th>`;
    if (cols.medicalNotes) trHead.innerHTML += `<th class="p-4 text-[10px]">یادداشت بالینی</th>`;
    if (cols.systemReason) trHead.innerHTML += `<th class="p-4 text-amber-600 font-bold">علت عدم ثبت در سامانه</th>`;
    if (cols.camp) trHead.innerHTML += `<th class="p-4 text-amber-700 font-bold">سابقه اقامت در کمپ</th>`;
    header.appendChild(trHead);

    // PERFORMANCE: build the patientId -> visit lookup once for this render.
    const firstVisitByPatient = buildFirstVisitMap(window.visits);

    // Printable report ALWAYS includes every matching record — pagination is purely an
    // on-screen browsing aid and must never shrink what actually gets printed/exported.
    let fullBodyHTML = '';
    dataset.forEach(p => {
        fullBodyHTML += `<tr class="text-xs">${buildReportRowHTML(p, cols, firstVisitByPatient)}</tr>`;
    });
    if (printReportCount) printReportCount.innerText = toPersianDigits(dataset.length);
    if (printableHead) printableHead.innerHTML = header.innerHTML;
    if (printableBody) printableBody.innerHTML = fullBodyHTML;

    // On-screen table shows only the current page — rendered (and re-rendered on every
    // page/limit change) by renderPaginatedReportTable().
    renderPaginatedReportTable();
}

// Renders just the current page of tableState.reports.data into the on-screen table and
// refreshes the pagination controls. Called on initial report build and on every page/limit
// change — never touches the printable report, which always holds the full result set.
function renderPaginatedReportTable() {
    const body = document.getElementById('report-table-body');
    if (!body) return;

    const state = tableState.reports;
    const dataset = state.data || [];
    const cols = state.cols || {};

    if (!dataset.length) return; // empty-state already handled in renderReportBuilderTable

    const limit = state.limit;
    const total = dataset.length;
    const start = limit === 'all' ? 0 : (state.page - 1) * limit;
    const end = limit === 'all' ? total : start + limit;
    const pageData = dataset.slice(start, end);

    const firstVisitByPatient = buildFirstVisitMap(window.visits);
    const fragment = document.createDocumentFragment();
    pageData.forEach(p => {
        const trRow = document.createElement('tr');
        trRow.className = "hover:bg-slate-50 transition border-b border-gray-100 text-xs";
        trRow.innerHTML = buildReportRowHTML(p, cols, firstVisitByPatient);
        fragment.appendChild(trRow);
    });

    body.innerHTML = '';
    body.appendChild(fragment);

    renderPaginationControls('reports');
}
