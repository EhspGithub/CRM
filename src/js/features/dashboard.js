// نسیم رهایی — داشبورد آماری و نمودارها
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

// 1. DASHBOARD ANALYTICS COMPUTATIONS
// PERFORMANCE FIX: this used to call `await loadDataFromIndexedDB()` on every single
// invocation. That function performs 9 separate full-table IndexedDB reads (patients,
// visits, contactLogs, insuranceHistory, auditLogs, backupHistory, patientReviews,
// mergeConflictLog, settings, staff) plus a legacy-data migration scan over every
// patient and visit record. renderDashboard() is called from ~14 places across the app
// — after every quick status/attendance/insurance toggle, every visit/dispense/review
// save, every settings change, etc. — meaning a single click could trigger 9+ redundant
// full IndexedDB table scans for data that was already correct in memory.
// This reload is unnecessary: every write path in this app already mutates the in-memory
// window.patients/visits/... arrays directly (and persists via dbPutRecord/syncDatabase)
// *before* calling renderDashboard(), so window.* already reflects the latest state.
// The one legitimate cold-start load is handled once by initIndexedDB() -> 
// loadDataFromIndexedDB() at app boot, before the first renderDashboard() call.
async function renderDashboard() {

    const activeBimars = window.patients.filter(p => p.status === 'فعال');
    const absentBimars = window.patients.filter(p => p.attendance === 'غیبت');
    const insuredBimars = window.patients.filter(p => p.insurance === 'دارد');

    document.getElementById('stat-total').innerText = toPersianDigits(window.patients.length);
    document.getElementById('stat-active').innerText = toPersianDigits(activeBimars.length);
    document.getElementById('stat-absent').innerText = toPersianDigits(absentBimars.length);
    document.getElementById('stat-insured').innerText = toPersianDigits(insuredBimars.length);

    // Patients whose national ID is truly empty (undefined / null / blank string)
    const noNationalIdBimars = window.patients.filter(p => p.nationalId === undefined || p.nationalId === null || String(p.nationalId).trim() === '');
    // Patients registered in the national system ("ثبت در سامانه" = بله)
    const registeredBimars = window.patients.filter(p => p.systemRegistered === 'بله');
    document.getElementById('stat-no-nid').innerText = toPersianDigits(noNationalIdBimars.length);
    document.getElementById('stat-registered').innerText = toPersianDigits(registeredBimars.length);

    // Per-card breakdown of patient counts by medication (ق متادون / ش متادون / بوپرنورفین / اپیوم)
    renderStatDrugBreakdown('stat-total-breakdown', window.patients);
    renderStatDrugBreakdown('stat-active-breakdown', activeBimars);
    renderStatDrugBreakdown('stat-absent-breakdown', absentBimars);
    renderStatDrugBreakdown('stat-insured-breakdown', insuredBimars);

    // Active / inactive split for the two new cards (same file-status field as the rest of the dashboard)
    renderStatStatusBreakdown('stat-no-nid-breakdown', noNationalIdBimars);
    renderStatStatusBreakdown('stat-registered-breakdown', registeredBimars);

    document.getElementById('count-regular').innerText = toPersianDigits(window.patients.filter(p => p.attendance === 'منظم').length);
    document.getElementById('count-irregular').innerText = toPersianDigits(window.patients.filter(p => p.attendance === 'نامنظم').length);
    document.getElementById('count-missing').innerText = toPersianDigits(absentBimars.length);

    // Chart computations & initializations
    initCharts(activeBimars, window.patients);

    // Render new Average Dosages widget
    renderAverageDosages(activeBimars);

    // Render new Dosage Trend widget
    renderDosageTrends(activeBimars);

    // Render Drug Type Change widget (initial drug -> current drug)
    renderDrugTypeChanges(activeBimars);
}

// Counts how many patients in a given list are on each of the 4 tracked medications.
// Used to render the compact per-card drug breakdown on the dashboard's top stat cards.
const DASHBOARD_DRUG_ORDER = ['ق متادون', 'ش متادون', 'بوپرنورفین', 'اپیوم'];
function renderStatDrugBreakdown(containerId, patientList) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const counts = { 'ق متادون': 0, 'ش متادون': 0, 'بوپرنورفین': 0, 'اپیوم': 0 };
    (patientList || []).forEach(p => {
        const drug = p.currentDrug || p.initialDrug;
        if (Object.prototype.hasOwnProperty.call(counts, drug)) counts[drug]++;
    });

    container.innerHTML = DASHBOARD_DRUG_ORDER.map(drug => `
        <div class="flex items-center justify-between gap-1">
            <span class="truncate opacity-80">${escapeHTML(drug)}</span>
            <span class="text-slate-700">${toPersianDigits(counts[drug])}</span>
        </div>
    `).join('');
}

// Renders the active / inactive split of a patient list inside a top stat card.
// Same markup/style as renderStatDrugBreakdown so the cards stay visually consistent.
function renderStatStatusBreakdown(containerId, patientList) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = patientList || [];
    const activeCount = list.filter(p => p.status === 'فعال').length;
    const inactiveCount = list.filter(p => p.status === 'غیرفعال').length;

    container.innerHTML = [['فعال', activeCount], ['غیرفعال', inactiveCount]].map(([label, count]) => `
        <div class="flex items-center justify-between gap-1">
            <span class="truncate opacity-80">${label}</span>
            <span class="text-slate-700">${toPersianDigits(count)}</span>
        </div>
    `).join('');
}

// NEW FUNCTION: Calculate and render dosage trends compared to initial dosage
function renderDosageTrends(activeBimars) {
    const trendStats = {};

    activeBimars.forEach(p => {
        // Determine which drug to track. 
        // We track based on current drug. If they changed drug completely, we might not want to compare directly,
        // but usually clinics track the main drug. For simplicity and accuracy, let's only compare if they are on the same drug type
        // or if we just want to track the current drug's standing. Let's compare if initialDrug == currentDrug.

        if (!p.currentDrug || p.currentDrug === 'روان درمانی' || p.currentDrug === 'بدون دارو (فقط روان‌درمانی)' || p.currentDrug === 'متقاضی اپیوم') return;

        // Only compare if the drug is the same as initial, otherwise it's a "Drug Change" which is hard to quantify as increase/decrease
        if (p.initialDrug !== p.currentDrug) return;

        const initialDose = parseFloat(p.initialDosage) || 0;
        const currentDose = parseFloat(p.currentDosage) || 0;

        if (!trendStats[p.currentDrug]) {
            trendStats[p.currentDrug] = { increased: 0, decreased: 0, unchanged: 0, total: 0 };
        }

        if (currentDose > initialDose) {
            trendStats[p.currentDrug].increased += 1;
        } else if (currentDose < initialDose) {
            trendStats[p.currentDrug].decreased += 1;
        } else {
            trendStats[p.currentDrug].unchanged += 1;
        }
        trendStats[p.currentDrug].total += 1;
    });

    const container = document.getElementById('dosage-trend-container');
    if (!container) return;
    container.innerHTML = '';

    const drugKeys = Object.keys(trendStats);
    if (drugKeys.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 font-bold col-span-full py-2">داده‌ای برای محاسبه تغییرات دوز بیماران فعال موجود نیست.</p>';
        return;
    }

    // Define UI mapping for drugs (colors matching previous widget)
    const drugMeta = {
        'ش متادون': { border: 'border-amber-200', text: 'text-amber-800', bgHead: 'bg-amber-100/50' },
        'ق متادون': { border: 'border-orange-200', text: 'text-orange-800', bgHead: 'bg-orange-100/50' },
        'بوپرنورفین': { border: 'border-sky-200', text: 'text-sky-800', bgHead: 'bg-sky-100/50' },
        'اپیوم': { border: 'border-slate-200', text: 'text-slate-800', bgHead: 'bg-slate-100/50' }
    };

    drugKeys.forEach(drug => {
        const stats = trendStats[drug];
        const meta = drugMeta[drug] || { border: 'border-emerald-200', text: 'text-emerald-800', bgHead: 'bg-emerald-100/50' };

        // Calculate percentages safely
        const getPercent = (val) => stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;

        const decPct = getPercent(stats.decreased);
        const incPct = getPercent(stats.increased);
        const unchPct = getPercent(stats.unchanged);

        container.innerHTML += `
            <div class="border ${meta.border} rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow transition">
                <div class="${meta.bgHead} px-2 py-1.5 border-b ${meta.border} flex justify-between items-center">
                    <span class="text-[10px] ${meta.text} font-bold"><i class="fa-solid fa-capsules opacity-70 ml-1"></i>${escapeHTML(drug)}</span>
                    <span class="text-[9px] text-slate-500 font-semibold bg-white/60 px-1.5 rounded">${toPersianDigits(stats.total)} بیمار</span>
                </div>
                <div class="p-2 grid grid-cols-3 gap-1 bg-white flex-1 items-center">
                    <div class="flex flex-col justify-center p-1 bg-emerald-50 rounded-lg">
                        <span class="text-[8px] text-emerald-600 font-bold mb-0.5 text-center"><i class="fa-solid fa-arrow-down mr-0.5"></i>کاهش</span>
                        <div class="flex items-baseline justify-between gap-1 px-0.5">
                            <span class="text-[11px] font-black text-emerald-700 font-yekan">${toPersianDigits(stats.decreased)}</span>
                            <span class="text-[8px] text-emerald-500 font-sans">%${toPersianDigits(decPct)}</span>
                        </div>
                    </div>
                    <div class="flex flex-col justify-center p-1 bg-slate-50 rounded-lg">
                        <span class="text-[8px] text-slate-500 font-bold mb-0.5 text-center"><i class="fa-solid fa-minus mr-0.5"></i>ثابت</span>
                        <div class="flex items-baseline justify-between gap-1 px-0.5">
                            <span class="text-[11px] font-black text-slate-700 font-yekan">${toPersianDigits(stats.unchanged)}</span>
                            <span class="text-[8px] text-slate-400 font-sans">%${toPersianDigits(unchPct)}</span>
                        </div>
                    </div>
                    <div class="flex flex-col justify-center p-1 bg-rose-50 rounded-lg">
                        <span class="text-[8px] text-rose-600 font-bold mb-0.5 text-center"><i class="fa-solid fa-arrow-up mr-0.5"></i>افزایش</span>
                        <div class="flex items-baseline justify-between gap-1 px-0.5">
                            <span class="text-[11px] font-black text-rose-700 font-yekan">${toPersianDigits(stats.increased)}</span>
                            <span class="text-[8px] text-rose-500 font-sans">%${toPersianDigits(incPct)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

// NEW FUNCTION: Drug-type change matrix for active patients (initial drug -> current drug).
// Only real drug-type switches are counted (same-drug dose changes are ignored, see renderDosageTrends).
// Percent = share of active patients who started on the source drug (same denominator shown in the card badge).
function renderDrugTypeChanges(activeBimars) {
    const container = document.getElementById('drug-type-change-container');
    if (!container) return;

    const drugs = DASHBOARD_DRUG_ORDER; // ق متادون / ش متادون / بوپرنورفین / اپیوم
    const normalizeDrug = (d) => {
        if (d === 'شربت متادون') return 'ش متادون';
        if (d === 'قرص متادون') return 'ق متادون';
        return d;
    };

    // matrix[from][to] = count of active patients; initialTotals[from] = active patients who started on `from`
    const matrix = {};
    const initialTotals = {};
    drugs.forEach(from => {
        initialTotals[from] = 0;
        matrix[from] = {};
        drugs.forEach(to => { if (to !== from) matrix[from][to] = 0; });
    });

    (activeBimars || []).forEach(p => {
        const from = normalizeDrug(p.initialDrug);
        const to = normalizeDrug(p.currentDrug || p.initialDrug);
        if (!Object.prototype.hasOwnProperty.call(matrix, from)) return;
        initialTotals[from] += 1;
        if (to !== from && Object.prototype.hasOwnProperty.call(matrix[from], to)) {
            matrix[from][to] += 1;
        }
    });

    // Same palette as the dose-change widget: source drug colors the header, destination drug tints the mini cards
    const drugMeta = {
        'ش متادون': { border: 'border-amber-200', text: 'text-amber-800', bgHead: 'bg-amber-100/50', cellBg: 'bg-amber-50', cellText: 'text-amber-700', cellPct: 'text-amber-500' },
        'ق متادون': { border: 'border-orange-200', text: 'text-orange-800', bgHead: 'bg-orange-100/50', cellBg: 'bg-orange-50', cellText: 'text-orange-700', cellPct: 'text-orange-500' },
        'بوپرنورفین': { border: 'border-sky-200', text: 'text-sky-800', bgHead: 'bg-sky-100/50', cellBg: 'bg-sky-50', cellText: 'text-sky-700', cellPct: 'text-sky-500' },
        'اپیوم': { border: 'border-slate-200', text: 'text-slate-800', bgHead: 'bg-slate-100/50', cellBg: 'bg-slate-50', cellText: 'text-slate-700', cellPct: 'text-slate-400' }
    };

    container.innerHTML = drugs.map(from => {
        const meta = drugMeta[from];
        const total = initialTotals[from];
        const cells = drugs.filter(to => to !== from).map(to => {
            const val = matrix[from][to];
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            const m = drugMeta[to];
            return `
                    <div class="flex flex-col justify-center p-1 ${m.cellBg} rounded-lg">
                        <span class="text-[8px] ${m.cellText} font-bold mb-0.5 text-center leading-tight"><i class="fa-solid fa-arrow-left mr-0.5"></i>${escapeHTML(to)}</span>
                        <div class="flex items-baseline justify-between gap-1 px-0.5">
                            <span class="text-[11px] font-black ${m.cellText} font-yekan">${toPersianDigits(val)}</span>
                            <span class="text-[8px] ${m.cellPct} font-sans">%${toPersianDigits(pct)}</span>
                        </div>
                    </div>`;
        }).join('');

        return `
            <div class="border ${meta.border} rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow transition">
                <div class="${meta.bgHead} px-2 py-1.5 border-b ${meta.border} flex justify-between items-center">
                    <span class="text-[10px] ${meta.text} font-bold"><i class="fa-solid fa-capsules opacity-70 ml-1"></i>تغییر از ${escapeHTML(from)}</span>
                    <span class="text-[9px] text-slate-500 font-semibold bg-white/60 px-1.5 rounded" title="تعداد بیماران فعال با داروی اولیه ${escapeHTML(from)}">${toPersianDigits(total)} بیمار</span>
                </div>
                <div class="p-2 grid grid-cols-3 gap-1 bg-white flex-1 items-center">${cells}
                </div>
            </div>
        `;
    }).join('');
}

function renderAverageDosages(activeBimars) {
    const drugStats = {};
    activeBimars.forEach(p => {
        const drug = p.currentDrug || p.initialDrug;
        // Skip patients without medication or those only on psychotherapy
        if (!drug || drug === 'روان درمانی' || drug === 'بدون دارو (فقط روان‌درمانی)' || drug === 'متقاضی اپیوم') return;

        const dosage = parseFloat(p.currentDosage) || 0;
        if (!drugStats[drug]) {
            drugStats[drug] = { sum: 0, count: 0 };
        }
        drugStats[drug].sum += dosage;
        drugStats[drug].count += 1;
    });

    const container = document.getElementById('average-dosage-container');
    if (!container) return;
    container.innerHTML = '';

    const drugKeys = Object.keys(drugStats);
    if (drugKeys.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 font-bold col-span-full py-2">داده‌ای برای محاسبه میانگین دارویی بیماران فعال موجود نیست.</p>';
        return;
    }

    // Define UI mapping for drugs (colors, units)
    const drugMeta = {
        'ش متادون': { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', unit: 'سی‌سی' },
        'ق متادون': { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', unit: 'میلی‌گرم' },
        'بوپرنورفین': { bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-800', unit: 'میلی‌گرم' },
        'اپیوم': { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-800', unit: 'سی‌سی' }
    };

    drugKeys.forEach(drug => {
        const avg = (drugStats[drug].sum / drugStats[drug].count).toFixed(1); // 1 decimal place
        const meta = drugMeta[drug] || { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-800', unit: 'واحد' };

        container.innerHTML += `
            <div class="px-3 py-2 ${meta.bg} rounded-xl border ${meta.border} flex items-center justify-between gap-2 shadow-sm transition hover:shadow">
                <span class="text-xs font-extrabold ${meta.text} flex items-center gap-1.5 shrink-0">
                    <i class="fa-solid fa-capsules opacity-70 text-[10px]"></i> ${escapeHTML(drug)}
                </span>
                <span class="flex items-baseline gap-1 font-yekan whitespace-nowrap">
                    <span class="text-[10px] ${meta.text} opacity-70 font-semibold">میانگین:</span>
                    <span class="font-extrabold ${meta.text} text-sm">${toPersianDigits(avg)}</span>
                    <span class="text-[9px] font-bold ${meta.text} opacity-70 font-sans">${meta.unit}</span>
                </span>
                <span class="text-[9px] ${meta.text} font-semibold bg-white/50 px-2 py-0.5 rounded-md border border-white/50 whitespace-nowrap">${toPersianDigits(drugStats[drug].count)} بیمار</span>
            </div>
        `;
    });
}

function initCharts(activeBimars, allBimars) {
    // Drug Distribution polar chart data
    const drugCounts = {};
    activeBimars.forEach(p => {
        const drug = p.currentDrug || p.initialDrug;
        drugCounts[drug] = (drugCounts[drug] || 0) + 1;
    });

    const drugLabels = Object.keys(drugCounts);
    const drugData = Object.values(drugCounts);

    // بهینه‌سازی پرفورمنس: آپدیت درجا به جای تخریب نمودار (Performance & Animation fix)
    if (drugChart) {
        drugChart.data.labels = drugLabels.length ? drugLabels : ['بدون دیتا'];
        drugChart.data.datasets[0].data = drugData.length ? drugData : [0];
        drugChart.update();
    } else {
        const ctxDrug = document.getElementById('drugChart').getContext('2d');
        drugChart = new Chart(ctxDrug, {
            type: 'polarArea',
            data: {
                labels: drugLabels.length ? drugLabels : ['بدون دیتا'],
                datasets: [{
                    data: drugData.length ? drugData : [0],
                    backgroundColor: ['rgba(13, 131, 144, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(148, 163, 184, 0.7)']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Age Distribution Chart Data
    let ageGroups = { '۱۵ تا ۲۵': 0, '۲۶ تا ۳۵': 0, '۳۶ تا ۵۰': 0, 'بالای ۵۰': 0 };
    allBimars.forEach(p => {
        if (p.age < 26) ageGroups['۱۵ تا ۲۵']++;
        else if (p.age <= 35) ageGroups['۲۶ تا ۳۵']++;
        else if (p.age <= 50) ageGroups['۳۶ تا ۵۰']++;
        else ageGroups['بالای ۵۰']++;
    });

    if (ageChart) {
        ageChart.data.labels = Object.keys(ageGroups);
        ageChart.data.datasets[0].data = Object.values(ageGroups);
        ageChart.update();
    } else {
        const ctxAge = document.getElementById('ageChart').getContext('2d');
        ageChart = new Chart(ctxAge, {
            type: 'doughnut',
            data: {
                labels: Object.keys(ageGroups),
                datasets: [{
                    data: Object.values(ageGroups),
                    backgroundColor: ['#2dd4bf', '#0d8390', '#3b82f6', '#fbbf24']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Substance Usage Bar Chart Data
    const subCounts = {};
    allBimars.forEach(p => {
        subCounts[p.substance] = (subCounts[p.substance] || 0) + 1;
    });

    if (substanceChart) {
        substanceChart.data.labels = Object.keys(subCounts);
        substanceChart.data.datasets[0].data = Object.values(subCounts);
        substanceChart.update();
    } else {
        const ctxSub = document.getElementById('substanceChart').getContext('2d');
        substanceChart = new Chart(ctxSub, {
            type: 'bar',
            data: {
                labels: Object.keys(subCounts),
                datasets: [{
                    data: Object.values(subCounts),
                    backgroundColor: '#0d8390',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    // Admission Trend Chart Data — تعداد پذیرش «ماهانه» بر اساس تاریخ پذیرش (شمسی)
    const shamsiMonthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const admissionMonthCounts = {}; // کلید: yyyy*12 + (month-1)  => تعداد
    let admissionInvalidCount = 0;
    window.patients.forEach(p => {
        const parts = toEnglishDigits(String(p.admissionDate || '').trim()).split(/[\/\-\.]/).map(x => parseInt(x, 10));
        const y = parts[0], m = parts[1];
        if (parts.length >= 2 && y >= 1300 && y <= 1500 && m >= 1 && m <= 12) {
            const key = y * 12 + (m - 1);
            admissionMonthCounts[key] = (admissionMonthCounts[key] || 0) + 1;
        } else {
            admissionInvalidCount++;
        }
    });

    const admissionKeys = Object.keys(admissionMonthCounts).map(Number);
    const trendLabels = [];
    const trendValues = [];
    if (admissionKeys.length) {
        const firstKey = Math.min(...admissionKeys);
        const lastKey = Math.max(...admissionKeys);
        // ماه‌های بدون پذیرش بین اولین و آخرین ماه هم با مقدار صفر نمایش داده می‌شوند
        for (let k = firstKey; k <= lastKey; k++) {
            const yy = Math.floor(k / 12);
            const mm = k % 12;
            trendLabels.push(shamsiMonthNames[mm] + ' ' + toPersianDigits(yy));
            trendValues.push(admissionMonthCounts[k] || 0);
        }
    }

    const trendNoteEl = document.getElementById('admission-trend-note');
    if (trendNoteEl) {
        trendNoteEl.innerText = admissionInvalidCount > 0
            ? toPersianDigits(admissionInvalidCount) + ' پرونده به‌دلیل نداشتن تاریخ پذیرش معتبر در این نمودار لحاظ نشده است.'
            : '';
    }

    if (trendChart) {
        trendChart.data.labels = trendLabels.length ? trendLabels : ['بدون دیتا'];
        trendChart.data.datasets[0].data = trendValues.length ? trendValues : [0];
        trendChart.update();
    } else {
        const ctxTrend = document.getElementById('admissionTrendChart').getContext('2d');
        trendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: trendLabels.length ? trendLabels : ['بدون دیتا'],
                datasets: [{
                    label: 'پذیرش مراجع جدید',
                    data: trendValues.length ? trendValues : [0],
                    borderColor: '#0d8390',
                    backgroundColor: 'rgba(13, 131, 144, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ' ' + toPersianDigits(ctx.parsed.y) + ' پذیرش';
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { autoSkip: true, maxRotation: 60, minRotation: 0 } },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            callback: function(v) { return Number.isInteger(v) ? toPersianDigits(v) : ''; }
                        }
                    }
                }
            }
        });
    }

    // Gender Pie Chart Data
    const maleCount = allBimars.filter(p => p.gender === 'مرد').length;
    const femaleCount = allBimars.filter(p => p.gender === 'زن').length;

    if (genderChart) {
        genderChart.data.datasets[0].data = [maleCount, femaleCount];
        genderChart.update();
    } else {
        const ctxGender = document.getElementById('genderChart').getContext('2d');
        genderChart = new Chart(ctxGender, {
            type: 'pie',
            data: {
                labels: ['مرد', 'زن'],
                datasets: [{
                    data: [maleCount, femaleCount],
                    backgroundColor: ['#3b82f6', '#f43f5e']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // Inactive Causes Distribution and Statistics
    const deactiveBimars = allBimars.filter(p => p.status === 'غیرفعال');
    const reasonCounts = {
        'بهبودی کامل (ترخیص)': 0,
        'انصراف از درمان': 0,
        'انتقال به مرکز دیگر': 0,
        'فوت': 0,
        'عدم مراجعه طولانی مدت': 0,
        'مشکلات مالی': 0,
        'علت نامشخص': 0,
        'سایر': 0
    };

    deactiveBimars.forEach(p => {
        const r = p.deactiveReason || 'علت نامشخص';
        if (reasonCounts[r] !== undefined) {
            reasonCounts[r]++;
        } else {
            reasonCounts['سایر']++;
        }
    });

    // Set dynamic counts on dashboard widgets
    document.getElementById('deactive-count-behbodi').innerText = toPersianDigits(reasonCounts['بهبودی کامل (ترخیص)']);
    document.getElementById('deactive-count-anseraf').innerText = toPersianDigits(reasonCounts['انصراف از درمان']);
    document.getElementById('deactive-count-enteghal').innerText = toPersianDigits(reasonCounts['انتقال به مرکز دیگر']);
    document.getElementById('deactive-count-fot').innerText = toPersianDigits(reasonCounts['فوت']);
    document.getElementById('deactive-count-adam').innerText = toPersianDigits(reasonCounts['عدم مراجعه طولانی مدت']);
    document.getElementById('deactive-count-total').innerText = toPersianDigits(deactiveBimars.length);

    // --- کارت «کد پرونده‌های خالی»: کاملاً Dynamic و بر اساس دیتابیس واقعی ---
    (function renderEmptyPatientCodes() {
        const emptyCodesListEl = document.getElementById('empty-codes-list');
        const emptyCodesCountEl = document.getElementById('empty-codes-count');
        if (!emptyCodesListEl || !emptyCodesCountEl) return;

        const numericCodes = allBimars
            .map(p => parseInt(p.code, 10))
            .filter(c => !isNaN(c));

        if (numericCodes.length === 0) {
            emptyCodesCountEl.innerText = toPersianDigits(0);
            emptyCodesListEl.innerHTML = `<span class="text-slate-400 text-xs">هیچ پرونده‌ای برای محاسبه بازه کد وجود ندارد.</span>`;
            return;
        }

        const firstCode = Math.min(...numericCodes); // اولین کد پرونده موجود در دیتابیس
        const lastCode = Math.max(...numericCodes);  // آخرین کد پرونده، همیشه Dynamic
        const usedCodesSet = new Set(numericCodes);

        const emptyCodes = [];
        for (let code = firstCode; code <= lastCode; code++) {
            if (!usedCodesSet.has(code)) emptyCodes.push(code);
        }

        emptyCodesCountEl.innerText = toPersianDigits(emptyCodes.length);

        if (emptyCodes.length === 0) {
            emptyCodesListEl.innerHTML = `<span class="text-slate-400 text-xs">هیچ کد خالی‌ای در بازه ${toPersianDigits(firstCode)} تا ${toPersianDigits(lastCode)} وجود ندارد.</span>`;
        } else {
            emptyCodesListEl.innerHTML = emptyCodes.map(code =>
                `<span class="inline-block bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold font-yekan">${toPersianDigits(code)}</span>`
            ).join('');
        }
    })();

    if (deactiveReasonChart) {
        deactiveReasonChart.data.labels = Object.keys(reasonCounts);
        deactiveReasonChart.data.datasets[0].data = Object.values(reasonCounts);
        deactiveReasonChart.update();
    } else {
        const ctxDeactive = document.getElementById('deactiveReasonChart').getContext('2d');
        deactiveReasonChart = new Chart(ctxDeactive, {
            type: 'doughnut',
            data: {
                labels: Object.keys(reasonCounts),
                datasets: [{
                    data: Object.values(reasonCounts),
                    backgroundColor: ['#10b981', '#6366f1', '#3b82f6', '#f43f5e', '#fbbf24', '#f97316', '#94a3b8', '#a855f7']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false } // Hidden legend, raw values displayed inside list items
                }
            }
        });
    }
}

