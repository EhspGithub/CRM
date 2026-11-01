// نسیم رهایی — چاپ و خروجی PDF
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

// 8. PRINT & EXPORT DOCUMENT MECHANICS
// فقط «یک» ناحیه‌ی چاپی باید در هر لحظه فعال (print-active) باشد؛
// وگرنه محتوای چاپ قبلی (مثلاً لیست کدهای خالی) همراه چاپ بعدی هم در PDF/چاپ می‌آید.
function deactivateAllPrintAreas() {
    ['printable-report-area', 'printable-patient-area', 'printable-dashboard-area', 'printable-list-area'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('print-active');
    });
}

function openPrintPreview() {
    deactivateAllPrintAreas();
    document.getElementById('printable-report-area').classList.add('print-active');

    const previewBody = document.getElementById('print-preview-content');
    previewBody.innerHTML = document.getElementById('printable-report-area').innerHTML;
    document.getElementById('print-preview-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

// Patients with a truly empty national ID (same filter as the dashboard card's count),
// sorted by patient code ascending. Shared by both the on-screen modal and the print output
// so the two can never fall out of sync.
function getPatientsMissingNationalId() {
    return window.patients
        .filter(p => p.nationalId === undefined || p.nationalId === null || String(p.nationalId).trim() === '')
        .slice()
        .sort((a, b) => (a.code || 0) - (b.code || 0));
}

function openNoNationalIdModal() {
    const list = getPatientsMissingNationalId();

    document.getElementById('no-nid-modal-count').innerText = toPersianDigits(list.length);

    document.getElementById('no-nid-modal-body').innerHTML = list.length ? list.map(p => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-2.5 font-bold text-amber-700 font-yekan">${toPersianDigits(p.code)}</td>
            <td class="p-2.5 font-bold text-slate-800">${escapeHTML(p.fullName || (p.name + ' ' + p.lastname))}</td>
            <td class="p-2.5 font-yekan text-slate-600" dir="ltr">${toPersianDigits(p.phone)}</td>
            <td class="p-2.5 font-yekan text-slate-600">${toPersianDigits(p.admissionDate)}</td>
            <td class="p-2.5 font-bold">${escapeHTML(p.status)}</td>
        </tr>
    `).join('') : `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">در حال حاضر هیچ پرونده‌ی بدون کد ملی وجود ندارد.</td></tr>`;

    document.getElementById('no-nationalid-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function closeNoNationalIdModal() {
    document.getElementById('no-nationalid-modal').classList.add('hidden');
    unlockBackgroundScroll();
}

function generateNoNationalIdPrintHTML() {
    const list = getPatientsMissingNationalId();

    const rowsHTML = list.length ? list.map(p => `
        <tr>
            <td>${toPersianDigits(p.code)}</td>
            <td>${escapeHTML(p.fullName || (p.name + ' ' + p.lastname))}</td>
            <td dir="ltr">${toPersianDigits(p.phone)}</td>
            <td>${toPersianDigits(p.admissionDate)}</td>
            <td>${escapeHTML(p.status)}</td>
        </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center; padding:20px;">هیچ پرونده‌ی بدون کد ملی وجود ندارد.</td></tr>`;

    return `
    <div dir="rtl">
        <div class="flex justify-between items-center border-b-2 border-slate-800 pb-3 mb-4 print-avoid-break">
            <div>
                <h2 class="text-xl font-black">${escapeHTML(window.settings.clinicName || 'کلینیک ترک اعتیاد')}</h2>
                <p class="text-xs font-bold text-slate-600 mt-1">گزارش پرونده‌های فاقد کد ملی</p>
            </div>
            <div class="text-left text-xs font-bold space-y-1.5">
                <p>تاریخ چاپ: <span class="font-yekan text-sm">${toPersianDigits(getShamsiToday())}</span></p>
                <p class="bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200">تعداد کل: <span class="text-base font-black font-yekan ml-1">${toPersianDigits(list.length)}</span></p>
            </div>
        </div>
        <table class="print-table" style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
                <tr>
                    <th>کد پرونده</th>
                    <th>نام و نام خانوادگی</th>
                    <th>شماره تماس</th>
                    <th>تاریخ پذیرش</th>
                    <th>وضعیت</th>
                </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
        </table>
    </div>
    `;
}

// --- چاپ لیست «کد پرونده‌های خالی» ---
// همان منطق کارت داشبورد: کدهای بین کوچک‌ترین و بزرگ‌ترین کد موجود که پرونده‌ای ندارند.
function getEmptyPatientCodes() {
    const numericCodes = window.patients
        .map(p => parseInt(p.code, 10))
        .filter(c => !isNaN(c));
    if (numericCodes.length === 0) return [];
    const firstCode = Math.min(...numericCodes);
    const lastCode = Math.max(...numericCodes);
    const usedCodesSet = new Set(numericCodes);
    const emptyCodes = [];
    for (let code = firstCode; code <= lastCode; code++) {
        if (!usedCodesSet.has(code)) emptyCodes.push(code);
    }
    return emptyCodes;
}

function generateEmptyCodesPrintHTML(emptyCodes) {
    const rowsHTML = emptyCodes.map(code => `
        <tr>
            <td style="height:30px; text-align:center; font-weight:bold;">${toPersianDigits(code)}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    `).join('');

    return `
    <div dir="rtl">
        <div class="flex justify-between items-center border-b-2 border-slate-800 pb-3 mb-4 print-avoid-break">
            <div>
                <h2 class="text-xl font-black">${escapeHTML(window.settings.clinicName || 'کلینیک ترک اعتیاد')}</h2>
                <p class="text-xs font-bold text-slate-600 mt-1">لیست کد پرونده‌های خالی</p>
            </div>
            <div class="text-left text-xs font-bold space-y-1.5">
                <p>تاریخ چاپ: <span class="font-yekan text-sm">${toPersianDigits(getShamsiToday())}</span></p>
                <p class="bg-slate-50 text-slate-800 px-2 py-1 rounded border border-slate-200">تعداد کل: <span class="text-base font-black font-yekan ml-1">${toPersianDigits(emptyCodes.length)}</span></p>
            </div>
        </div>
        <table class="print-table" style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px;">
            <colgroup>
                <col style="width:9%;">
                <col style="width:20%;">
                <col style="width:20%;">
                <col style="width:13%;">
                <col style="width:8%;">
                <col style="width:10%;">
                <col style="width:20%;">
            </colgroup>
            <thead>
                <tr>
                    <th>کد پرونده</th>
                    <th>نام و نام خانوادگی</th>
                    <th>کد ملی</th>
                    <th>داروی مصرفی فعلی</th>
                    <th>دوز دارو</th>
                    <th>تاریخ تولد</th>
                    <th>شماره تماس</th>
                </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
        </table>
    </div>
    `;
}

function printEmptyCodesList() {
    const emptyCodes = getEmptyPatientCodes();
    if (emptyCodes.length === 0) {
        showCustomAlert("لیست خالی است", "در حال حاضر هیچ کد پرونده‌ی خالی‌ای برای چاپ وجود ندارد.");
        return;
    }

    deactivateAllPrintAreas();

    const listArea = document.getElementById('printable-list-area');
    listArea.classList.add('print-active');
    listArea.innerHTML = generateEmptyCodesPrintHTML(emptyCodes);

    document.getElementById('print-preview-content').innerHTML = listArea.innerHTML;
    document.getElementById('print-preview-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function printNoNationalIdList() {
    deactivateAllPrintAreas();

    const listArea = document.getElementById('printable-list-area');
    listArea.classList.add('print-active');
    listArea.innerHTML = generateNoNationalIdPrintHTML();

    const previewBody = document.getElementById('print-preview-content');
    previewBody.innerHTML = listArea.innerHTML;

    document.getElementById('print-preview-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

let __printSectionsPatientId = null;

function openPrintSectionsModal(patientId) {
    __printSectionsPatientId = patientId;

    // Reset to the spec's default state every time: only "اطلاعات پایه" pre-checked.
    document.getElementById('print-sec-base').checked = true;
    document.getElementById('print-sec-visits').checked = false;
    document.getElementById('print-sec-dispense').checked = false;
    document.getElementById('print-sec-calls').checked = false;
    document.getElementById('print-sec-history').checked = false;
    document.getElementById('print-sec-reviews').checked = false;

    document.getElementById('print-sections-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function closePrintSectionsModal() {
    document.getElementById('print-sections-modal').classList.add('hidden');
    unlockBackgroundScroll();
    __printSectionsPatientId = null;
}

function confirmPatientPrintSections() {
    const sections = {
        base: document.getElementById('print-sec-base').checked,
        visits: document.getElementById('print-sec-visits').checked,
        dispense: document.getElementById('print-sec-dispense').checked,
        calls: document.getElementById('print-sec-calls').checked,
        history: document.getElementById('print-sec-history').checked,
        reviews: document.getElementById('print-sec-reviews').checked
    };

    if (!Object.values(sections).some(Boolean)) {
        showCustomAlert("انتخاب ناقص", "لطفاً حداقل یک بخش را برای چاپ انتخاب کنید.");
        return;
    }

    const patientId = __printSectionsPatientId;
    document.getElementById('print-sections-modal').classList.add('hidden');
    __printSectionsPatientId = null;
    // قفل اسکرول از روی مودال‌های باز محاسبه می‌شود (syncBackgroundScrollLock)،
    // پس نیازی به unlock دستی اینجا نیست.

    openPatientPrintPreview(patientId, sections);
}

function openPatientPrintPreview(patientId, sections) {
    const p = window.patients.find(pat => pat.id === patientId);
    if (!p) return;

    sections = sections || { base: true, visits: false, dispense: false, calls: false, history: false, reviews: false };

    deactivateAllPrintAreas();

    const patientArea = document.getElementById('printable-patient-area');
    patientArea.classList.add('print-active');

    patientArea.innerHTML = generatePatientPrintHTML(p, sections);

    const previewBody = document.getElementById('print-preview-content');
    previewBody.innerHTML = patientArea.innerHTML;

    document.getElementById('print-preview-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

// --- چاپ داشبورد آماری ---
// به‌جای بازسازی دستی و تکراری تک‌تک کارت‌ها و نمودارها (که با هر تغییر آینده در
// داشبورد از هم‌خوانی خارج می‌شود)، کل تب داشبورد همان لحظه Clone می‌شود؛ تنها کاری
// که انجام می‌شود جایگزینی هر نمودار Chart.js (canvas) با یک تصویر PNG از خودش است،
// چون canvas معمولاً در چاپ/PDF مرورگرها به‌درستی رندر نمی‌شود.
function openDashboardPrintPreview() {
    deactivateAllPrintAreas();

    const dashboardArea = document.getElementById('printable-dashboard-area');
    dashboardArea.classList.add('print-active');
    dashboardArea.innerHTML = generateDashboardPrintHTML();

    const previewBody = document.getElementById('print-preview-content');
    previewBody.innerHTML = dashboardArea.innerHTML;

    document.getElementById('print-preview-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

function generateDashboardPrintHTML() {
    const liveDashboard = document.getElementById('tab-dashboard');
    if (!liveDashboard) return '';

    const clone = liveDashboard.cloneNode(true);

    // ردیف کارت‌های آماری داخل مودال پیش‌نمایش باریک است؛ شش‌ستونه نشود
    const statGrid = clone.querySelector('#dashboard-stat-cards');
    if (statGrid) { statGrid.classList.remove('xl:grid-cols-6'); statGrid.classList.add('xl:grid-cols-3'); }

    // نوار عنوان/دکمه چاپ در نسخه چاپی لازم نیست؛ خودمان سربرگ رسمی جداگانه می‌سازیم
    const toolbar = clone.querySelector('#dashboard-toolbar');
    if (toolbar) toolbar.remove();

    // هر نمودار Chart.js را در همان لحظه به تصویر PNG تبدیل و جایگزین canvas می‌کنیم
    const liveCanvases = liveDashboard.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    liveCanvases.forEach((liveCanvas, i) => {
        const clonedCanvas = clonedCanvases[i];
        if (!clonedCanvas) return;
        let imgSrc = '';
        try {
            if (liveCanvas.width && liveCanvas.height) {
                imgSrc = liveCanvas.toDataURL('image/png', 1.0);
            }
        } catch (e) {
            console.error('خطا در تبدیل نمودار به تصویر برای چاپ:', e);
        }
        if (!imgSrc) return; // اگر نموداری داده‌ای نداشت (مثلاً کانواس خالی)، همان‌طور نادیده گرفته می‌شود
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '230px';
        img.style.margin = '0 auto';
        img.style.display = 'block';
        clonedCanvas.replaceWith(img);
    });

    // جلوگیری از برش هر بخش اصلی داشبورد (کارت آمار، نمودار و ...) بین دو صفحه چاپ
    Array.from(clone.children).forEach(section => section.classList.add('print-avoid-break'));

    const dateStr = toPersianDigits(getShamsiToday());
    const clinicName = (window.settings && window.settings.clinicName) || 'کلینیک تخصصی ترک اعتیاد و درمان';

    return `
        <div class="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6 print-avoid-break">
            <div>
                <h1 class="text-xl font-black text-slate-950">${escapeHTML(clinicName)}</h1>
                <p class="text-xs text-slate-700 mt-1">گزارش آماری و تحلیلی داشبورد مدیریتی</p>
            </div>
            <div class="text-left text-xs text-slate-800 leading-relaxed">
                <div><strong>تاریخ چاپ:</strong> ${dateStr}</div>
                <div><strong>نوع سند:</strong> آمار و ارقام کلی سامانه</div>
                <div><strong>دسترسی:</strong> محرمانه / مدیریت کلینیک</div>
            </div>
        </div>
        <div class="space-y-4">${clone.innerHTML}</div>
        <div class="mt-10 flex justify-between items-center text-xs text-slate-800 print-avoid-break">
            <div>
                <p class="font-bold">مهر و امضای مسئول فنی / مدیر کلینیک:</p>
                <div class="h-16 w-32 border border-dashed border-slate-800 mt-2 rounded-lg flex items-center justify-center text-slate-400">محل مهر کلینیک</div>
            </div>
            <div class="text-left">
                <p>سامانه مدیریت کلینیک - نسخه آفلاین و هوشمند</p>
                <p class="text-[9px] text-slate-600 mt-1">تولید شده به صورت خودکار از پایگاه داده لپ‌تاپ در تاریخ ${dateStr}</p>
            </div>
        </div>
    `;
}

function generatePatientPrintHTML(p, sections) {
    sections = sections || { base: true, visits: false, dispense: false, calls: false, history: false, reviews: false };

    // --- سوابق ویزیت و درمان: کل تاریخچه (بدون سقف ۵ مورد سابق)، دقیقاً هم‌راستا با تب زنده ---
    let visitsHtml = '';
    if (sections.visits) {
        const pVisits = window.visits
            .filter(v => v.patientId === p.id)
            .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

        visitsHtml = `
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">سوابق ویزیت و درمان (تاریخچه کامل)</h3>
            ${pVisits.length ? `
            <table class="w-full text-right border-collapse border border-slate-300 text-xs font-semibold">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                        <th class="p-1.5 border-l border-slate-300">تاریخ</th>
                        <th class="p-1.5 border-l border-slate-300">درمان/دوز</th>
                        <th class="p-1.5 border-l border-slate-300">وضعیت</th>
                        <th class="p-1.5">یادداشت پزشک</th>
                    </tr>
                </thead>
                <tbody>
                    ${pVisits.map(v => `
                        <tr class="border-b border-slate-300 print-avoid-break">
                            <td class="p-1.5 border-l border-slate-300 font-yekan">${toPersianDigits(v.date)}</td>
                            <td class="p-1.5 border-l border-slate-300 text-indigo-700">${escapeHTML(v.newDrug)} (${formatDosageHTML(v.newDrug, v.newDosage)})</td>
                            <td class="p-1.5 border-l border-slate-300">${escapeHTML(v.status)}</td>
                            <td class="p-1.5 text-[10px]">${escapeHTML(v.notes)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>` : `<p class="text-xs text-slate-400 italic">تاکنون هیچ ویزیتی برای این مراجع ثبت نشده است.</p>`}
        </div>`;
    }

    // --- تاریخچه دارو ---
    let dispenseHtml = '';
    if (sections.dispense) {
        const pDispense = p.dispenseHistory || [];
        dispenseHtml = `
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">تاریخچه دارو (سوابق تحویل دارو)</h3>
            ${pDispense.length ? `
            <table class="w-full text-right border-collapse border border-slate-300 text-xs font-semibold">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                        <th class="p-1.5 border-l border-slate-300">تاریخ تحویل</th>
                        <th class="p-1.5 border-l border-slate-300">دارو</th>
                        <th class="p-1.5 border-l border-slate-300">مقدار</th>
                        <th class="p-1.5 border-l border-slate-300">مراجعه بعدی</th>
                        <th class="p-1.5 border-l border-slate-300">تحویل‌گیرنده</th>
                        <th class="p-1.5">ثبت‌کننده</th>
                    </tr>
                </thead>
                <tbody>
                    ${pDispense.map(d => {
                        const unit = (d.drug.includes('قرص') || d.drug.includes('ق ') || d.drug.includes('بوپرنورفین')) ? 'میلی‌گرم' : 'سی‌سی';
                        return `
                        <tr class="border-b border-slate-300 print-avoid-break">
                            <td class="p-1.5 border-l border-slate-300 font-yekan">${toPersianDigits(d.date)}</td>
                            <td class="p-1.5 border-l border-slate-300 text-indigo-700">${escapeHTML(d.drug)}</td>
                            <td class="p-1.5 border-l border-slate-300 font-yekan">${toPersianDigits(d.quantity)} ${unit}</td>
                            <td class="p-1.5 border-l border-slate-300 font-yekan">${toPersianDigits(d.nextVisit)}</td>
                            <td class="p-1.5 border-l border-slate-300">${escapeHTML(d.recipient === 'خودش' ? 'خود بیمار' : 'همراه (' + (d.companion || '') + ')')}</td>
                            <td class="p-1.5 text-[10px]">${escapeHTML(d.recordedBy || 'سیستم')}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>` : `<p class="text-xs text-slate-400 italic">تاکنون هیچ سابقه ارائه دارویی ثبت نشده است.</p>`}
        </div>`;
    }

    // --- تاریخچه تماس‌ها ---
    let callsHtml = '';
    if (sections.calls) {
        const pCalls = window.contactLogs
            .filter(c => c.patientId === p.id)
            .sort((a, b) => b.id.localeCompare(a.id));

        callsHtml = `
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">تاریخچه تماس‌ها</h3>
            ${pCalls.length ? `
            <table class="w-full text-right border-collapse border border-slate-300 text-xs font-semibold">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                        <th class="p-1.5 border-l border-slate-300">تاریخ</th>
                        <th class="p-1.5 border-l border-slate-300">نتیجه تماس</th>
                        <th class="p-1.5 border-l border-slate-300">شرح مکالمه</th>
                        <th class="p-1.5 border-l border-slate-300">اقدام بعدی</th>
                        <th class="p-1.5">ثبت‌کننده</th>
                    </tr>
                </thead>
                <tbody>
                    ${pCalls.map(c => `
                        <tr class="border-b border-slate-300 print-avoid-break">
                            <td class="p-1.5 border-l border-slate-300 font-yekan">${toPersianDigits(c.date)}</td>
                            <td class="p-1.5 border-l border-slate-300">${escapeHTML(c.result)}</td>
                            <td class="p-1.5 border-l border-slate-300 text-[10px]">${escapeHTML(c.notes)}</td>
                            <td class="p-1.5 border-l border-slate-300 text-[10px]">${c.nextAction ? escapeHTML(c.nextAction) : '-'}</td>
                            <td class="p-1.5 text-[10px]">${escapeHTML(c.recordedBy)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>` : `<p class="text-xs text-slate-400 italic">تاکنون هیچ تماسی برای این مراجع ثبت نشده است.</p>`}
        </div>`;
    }

    // --- تغییرات پرونده (Audit Trail) ---
    let historyHtml = '';
    if (sections.history) {
        const pAudits = window.auditLogs
            .filter(a => a.patientId === p.id)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        historyHtml = `
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">تغییرات پرونده (Audit Trail)</h3>
            ${pAudits.length ? `
            <table class="w-full text-right border-collapse border border-slate-300 text-xs font-semibold">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                        <th class="p-1.5 border-l border-slate-300">فیلد تغییر داده شده</th>
                        <th class="p-1.5 border-l border-slate-300">تغییر</th>
                        <th class="p-1.5">تاریخ و ساعت</th>
                    </tr>
                </thead>
                <tbody>
                    ${pAudits.map(a => `
                        <tr class="border-b border-slate-300 print-avoid-break">
                            <td class="p-1.5 border-l border-slate-300">${escapeHTML(a.fieldName)}</td>
                            <td class="p-1.5 border-l border-slate-300 text-[10px]">${escapeHTML(a.oldValue)} ← ${escapeHTML(a.newValue)}</td>
                            <td class="p-1.5 font-yekan text-[10px]">${toPersianDigits(a.date)} - ${toPersianDigits(a.time)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>` : `<p class="text-xs text-slate-400 italic">تاکنون تغییری در اطلاعات پایه این پرونده ثبت نشده است.</p>`}
        </div>`;
    }

    // --- بررسی پرونده (کنترل کیفیت) ---
    let reviewsHtml = '';
    if (sections.reviews) {
        const pReviews = window.patientReviews
            .filter(r => r.patientId === p.id)
            .sort((a, b) => b.id.localeCompare(a.id));

        reviewsHtml = `
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">بررسی پرونده (کنترل کیفیت)</h3>
            ${pReviews.length ? `
            <table class="w-full text-right border-collapse border border-slate-300 text-xs font-semibold">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                        <th class="p-1.5 border-l border-slate-300">تاریخ</th>
                        <th class="p-1.5 border-l border-slate-300">بررسی‌کننده</th>
                        <th class="p-1.5 border-l border-slate-300">نتیجه</th>
                        <th class="p-1.5 border-l border-slate-300">موارد نقص</th>
                        <th class="p-1.5">توضیحات</th>
                    </tr>
                </thead>
                <tbody>
                    ${pReviews.map(r => `
                        <tr class="border-b border-slate-300 print-avoid-break">
                            <td class="p-1.5 border-l border-slate-300 font-yekan">${toPersianDigits(r.date)}</td>
                            <td class="p-1.5 border-l border-slate-300">${escapeHTML(r.reviewer)}</td>
                            <td class="p-1.5 border-l border-slate-300">${r.isComplete ? 'کامل' : 'ناقص'}</td>
                            <td class="p-1.5 border-l border-slate-300 text-[10px]">${r.deficiencies && r.deficiencies.length ? escapeHTML(r.deficiencies.join('، ')) : '-'}</td>
                            <td class="p-1.5 text-[10px]">${r.notes ? escapeHTML(r.notes) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>` : `<p class="text-xs text-slate-400 italic">تاکنون هیچ بررسی کنترل کیفیتی برای این پرونده ثبت نشده است.</p>`}
        </div>`;
    }

    // --- اطلاعات پایه (مشخصات هویتی، سوابق مصرف و پزشکی، وضعیت درمانی فعلی) ---
    let baseHtml = '';
    if (sections.base) {
        baseHtml = `
        <!-- Demographics: ۸ فیلد در دو ردیف ۴تایی -->
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">مشخصات هویتی و پذیرش</h3>
            <div class="grid grid-cols-4 gap-2 text-xs font-semibold">
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">نام و نام خانوادگی</span><span class="text-sm font-bold">${escapeHTML(p.fullName)}</span></div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">کد ملی</span><span class="font-yekan font-bold text-xs tracking-widest">${toPersianDigits(p.nationalId)}</span></div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">سن</span><span class="font-yekan font-bold">${toPersianDigits(p.age)}</span> سال</div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">تاریخ تولد</span><span class="font-yekan font-bold">${toPersianDigits(p.birthdate)}</span></div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">تلفن تماس</span><span class="font-yekan font-bold tracking-widest" dir="ltr">${toPersianDigits(p.phone)}</span></div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">وضعیت تاهل</span>${escapeHTML(p.marital)}</div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">شغل</span>${escapeHTML(p.employment)} ${p.job ? `(${escapeHTML(p.job)})` : ''}</div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">تاریخ پذیرش در مرکز</span><span class="font-yekan font-bold">${toPersianDigits(p.admissionDate)}</span></div>
            </div>
        </div>

        <!-- Medical & Substance: افزوده شدن فیلد «توضیحات» از یادداشت بالینی/روانپزشکی فرم پذیرش -->
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">سوابق مصرف و پزشکی</h3>
            <div class="grid grid-cols-5 gap-2 text-xs font-semibold mb-2">
                <div class="border border-slate-300 p-1.5 rounded-lg bg-amber-50/50 col-span-2"><span class="block text-[9px] text-slate-500 mb-0.5">ماده مصرفی اصلی</span><span class="text-amber-800 font-bold">${escapeHTML(p.substance)} ${p.substanceOther ? `(${escapeHTML(p.substanceOther)})` : ''}</span></div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50 col-span-1"><span class="block text-[9px] text-slate-500 mb-0.5">مدت مصرف</span><span class="font-yekan font-bold">${toPersianDigits(p.duration)}</span> سال</div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-red-50/30 col-span-2">
                    <span class="block text-[9px] text-red-800 font-bold mb-0.5">بیماری‌های زمینه‌ای</span>
                    ${p.medHistory && p.medHistory.length ? escapeHTML(p.medHistory.join(' - ')) : 'فاقد سابقه بیماری'}
                </div>
            </div>
            <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50 text-xs font-semibold">
                <span class="block text-[9px] text-slate-500 mb-0.5">توضیحات (یادداشت‌های بالینی و روان‌پزشکی)</span>
                <span class="font-normal leading-relaxed whitespace-pre-wrap">${p.medicalNotes ? escapeHTML(p.medicalNotes) : 'ثبت نشده است.'}</span>
            </div>
        </div>

        <!-- Treatment -->
        <div class="mb-4 print-avoid-break">
            <h3 class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 text-sm font-bold mb-2">وضعیت درمانی فعلی</h3>
            <div class="grid grid-cols-3 gap-2 text-xs font-semibold">
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">درمان بدو ورود</span>${escapeHTML(p.initialDrug)} <span class="font-yekan font-bold">(${formatDosageHTML(p.initialDrug, p.initialDosage)})</span></div>
                <div class="border border-emerald-300 p-1.5 rounded-lg bg-emerald-50"><span class="block text-[9px] text-emerald-800 mb-0.5">درمان فعلی</span><span class="text-emerald-900 font-bold">${escapeHTML(p.currentDrug)}</span> <span class="font-black font-yekan text-emerald-900 text-sm">(${formatDosageHTML(p.currentDrug, p.currentDosage)})</span></div>
                <div class="border border-slate-300 p-1.5 rounded-lg bg-slate-50/50"><span class="block text-[9px] text-slate-500 mb-0.5">وضعیت پرونده و حضور</span>${escapeHTML(p.status)} / ${escapeHTML(p.attendance)}</div>
            </div>
            ${p.status === 'غیرفعال' ? `
            <div class="border border-rose-300 p-1.5 rounded-lg bg-rose-50 text-xs font-bold text-rose-800 mt-2">
                <span class="block text-[9px] mb-0.5 opacity-80">علت غیرفعال‌سازی پرونده</span>
                ${escapeHTML(p.deactiveReason)} ${p.deactiveNotes ? ` - <span class="font-normal">${escapeHTML(p.deactiveNotes)}</span>` : ''}
            </div>` : ''}
        </div>`;
    }

    return `
    <div class="border-2 border-slate-800 p-6 rounded-2xl bg-white text-slate-900 font-sans mx-auto w-full max-w-4xl" dir="rtl">
        <div class="flex justify-between items-center border-b-2 border-slate-800 pb-3 mb-4 print-avoid-break">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center border border-slate-300">
                    <i class="fa-solid fa-file-medical text-2xl text-slate-700"></i>
                </div>
                <div>
                    <h2 class="text-xl font-black">${escapeHTML(window.settings.clinicName || 'کلینیک ترک اعتیاد')}</h2>
                    <p class="text-xs font-bold text-slate-600 mt-1">خلاصه پرونده بالینی مراجع</p>
                </div>
            </div>
            <div class="text-left text-xs font-bold space-y-1.5">
                <p>تاریخ چاپ: <span class="font-yekan text-sm">${toPersianDigits(getShamsiToday())}</span></p>
                <p class="bg-teal-50 text-teal-800 px-2 py-1 rounded border border-teal-200">شماره پرونده: <span class="text-base font-black font-yekan ml-1">${toPersianDigits(p.code)}</span></p>
            </div>
        </div>

        ${baseHtml}
        ${visitsHtml}
        ${dispenseHtml}
        ${callsHtml}
        ${historyHtml}
        ${reviewsHtml}

        <!-- Footer Signatures -->
        <div class="mt-8 flex justify-between items-end border-t-2 border-slate-800 pt-4 print-avoid-break">
            <div class="text-xs font-bold text-slate-800 text-center">
                <p>امضا و مهر پزشک معالج</p>
                <p class="mt-10 border-t border-slate-400 w-40 mx-auto pt-1">${escapeHTML(window.staff?.doctors?.[0] || 'دکتر معالج')}</p>
            </div>
            <div class="text-[10px] text-slate-400 font-semibold text-left">
                <p>سیستم مدیریت هوشمند درمان اعتیاد</p>
                <p class="font-yekan">Printed at: ${toPersianDigits(new Date().toLocaleTimeString('fa-IR'))}</p>
            </div>
        </div>
    </div>
    `;
}

function closePrintPreview() {
    document.getElementById('print-preview-modal').classList.add('hidden');
    unlockBackgroundScroll();
    deactivateAllPrintAreas();
    // CRITICAL: Clear the print-preview-content innerHTML to completely eliminate cloned duplicate ID elements from DOM tree!
    const previewContent = document.getElementById('print-preview-content');
    if (previewContent) {
        previewContent.innerHTML = '';
    }
}

function standalonePrintReport() {
    window.focus();
    window.print();
}
