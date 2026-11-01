// نسیم رهایی — راه‌اندازی برنامه، تنظیمات ظاهری، ناوبری تب‌ها و اعتبارسنجی‌ها
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

// --- NEW PURE MATH ALGORITHM FOR JALALI CALENDAR (Issue #7 Fix) ---
// Completely independent of OS/Browser Locale Settings
function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + parseInt((gy2 + 3) / 4) - parseInt((gy2 + 99) / 100) + parseInt((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * parseInt(days / 12053);
    days %= 12053;
    jy += 4 * parseInt(days / 1461);
    days %= 1461;
    jy += parseInt((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    const jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
}

function getShamsiToday() {
    try {
        const now = new Date();
        const gy = now.getFullYear();
        const gm = now.getMonth() + 1; // Month is 0-indexed
        const gd = now.getDate();

        const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

        // Pad with zeros to ensure strict YYYY/MM/DD format
        const mm = jm < 10 ? '0' + jm : jm;
        const dd = jd < 10 ? '0' + jd : jd;

        return `${jy}/${mm}/${dd}`;
    } catch (e) {
        console.error("Date computation error:", e);
        return "1405/01/01"; // Ultimate safe fallback
    }
}

// Generates a filename-safe Jalali timestamp: YYYYMMDD_HHMMSS
function getBackupTimestampString() {
    try {
        const now = new Date();
        const gy = now.getFullYear();
        const gm = now.getMonth() + 1;
        const gd = now.getDate();

        const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

        const mm = jm < 10 ? '0' + jm : jm;
        const dd = jd < 10 ? '0' + jd : jd;

        const hh = now.getHours() < 10 ? '0' + now.getHours() : now.getHours();
        const min = now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes();
        const sec = now.getSeconds() < 10 ? '0' + now.getSeconds() : now.getSeconds();

        return `${jy}${mm}${dd}_${hh}${min}${sec}`;
    } catch (e) {
        console.error("Backup timestamp computation error:", e);
        return `${Date.now()}`; // Safe fallback
    }
}

// App start-up: called by src/main.js once the SQLite database is open and every app script is loaded
window.__nrBoot = async () => {
    try {
        await initIndexedDB();
    } catch (err) {
        console.error('Fatal: failed to initialize the local database', err);
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;font-family:sans-serif;direction:rtl;">
                <div>
                    <h1 style="color:#e11d48;font-size:20px;margin-bottom:8px;">خطا در بارگذاری پایگاه داده</h1>
                    <p style="color:#334155;font-size:14px;max-width:480px;">خواندن اطلاعات از دیتابیس ناموفق بود. داده‌های شما دست‌نخورده باقی مانده‌اند؛ برنامه را ببندید و دوباره باز کنید. اگر مشکل ادامه داشت، متن خطای زیر را برای پشتیبانی بفرستید.</p>
                    <pre dir="ltr" style="color:#e11d48;font-size:11px;background:#fff1f2;border-radius:8px;padding:10px;max-width:480px;white-space:pre-wrap;">${escapeHTML(String(err && err.message ? err.message : err))}</pre>
                </div>
            </div>`;
        return;
    }
    applySettings();
    setSidebarBackupStatus(needsBackup); // نمایش وضعیت اولیه بکاپ (سبز چون در ابتدا تغییری وجود ندارد)
    const autoSyncToggleEl = document.getElementById('autosync-toggle');
    if (autoSyncToggleEl) autoSyncToggleEl.checked = !!(window.settings && window.settings.autoSyncEnabled);
    initAutoSyncOnStartup();
    bindDigitConverters(); // اتصال رویدادها در زمان لود اولیه
    renderReportReviewDeficiencyOptions(); // ساخت مالتی‌سلکت موارد نقص در فیلتر گزارش بررسی پرونده‌ها

    // Dynamically set right-aligned Shamsi date in header
    try {
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const shamsiDateStr = new Date().toLocaleDateString('fa-IR-u-ca-persian', dateOptions);
        const dateEl = document.getElementById('header-shamsi-date');
        if (dateEl) {
            dateEl.innerText = shamsiDateStr;
        }
    } catch (e) {
        console.error("Error setting header Shamsi date", e);
    }

    // Set default admission date in form to today's Shamsi date
    const admissionDateInput = document.getElementById('p-admissionDate');
    if (admissionDateInput && !admissionDateInput.value) {
        admissionDateInput.value = getShamsiToday();
    }

    if (typeof jalaliDatepicker !== 'undefined') {
        jalaliDatepicker.startWatch({
            minDate: "attr",
            maxDate: "attr",
            minYear: 1320,
            maxYear: 1420,
            showTodayBtn: true,
            separator: "/"
        });
    }

    // Real-time Age calculation from Birthdate Selection inside admission form
    const birthdateInput = document.getElementById('p-birthdate');
    if (birthdateInput) {
        const updateMainAge = () => {
            const dob = birthdateInput.value;
            const calculatedAge = calculateShamsiAge(dob);
            if (calculatedAge !== '') {
                document.getElementById('p-age').value = calculatedAge;
            }
        };
        // Listen to Jalali Datepicker select, manual input changes, and typing events
        birthdateInput.addEventListener('jdp:change', updateMainAge);
        birthdateInput.addEventListener('change', updateMainAge);
        birthdateInput.addEventListener('input', updateMainAge);
    }

    // Manage treatment unit based on drug selection at load
    handleDrugDosageUnits('p-drug', 'p-dosage-container', 'p-dosage-unit');
    togglePriorityField('p-drug', 'p-priority-container');

    // Switch to Dashboard Initial view
    switchTab('dashboard');
};

    // Toggle Drug Units & Layouts
    function handleDrugDosageUnits(selectId, containerId, unitSpanId) {
        const selectEl = document.getElementById(selectId);
        const containerEl = document.getElementById(containerId);
        const unitSpan = document.getElementById(unitSpanId);

        if (!selectEl || !containerEl || !unitSpan) return;

        const selected = selectEl.value;
        if (selected === 'روان درمانی' || selected === 'بدون دارو (فقط روان‌درمانی)') {
            containerEl.classList.add('hidden');
            const dosageInput = document.getElementById(selectId === 'p-drug' ? 'p-dosage' : (selectId === 'm-p-drug' ? 'm-p-dosage' : (selectId === 'm-p-initialDrug' ? 'm-p-initialDosage' : 'visit-dosage')));
            if (dosageInput) dosageInput.removeAttribute('required');
        } else {
            containerEl.classList.remove('hidden');
            const dosageInput = document.getElementById(selectId === 'p-drug' ? 'p-dosage' : (selectId === 'm-p-drug' ? 'm-p-dosage' : (selectId === 'm-p-initialDrug' ? 'm-p-initialDosage' : 'visit-dosage')));
            if (dosageInput) dosageInput.setAttribute('required', 'required');

            unitSpan.innerText = getDoseUnitLabel(selected);
        }
    }

    // NEW: Toggle the "اولویت اپیوم" (Opium priority A1/A2/B1/B2/B3) field.
    // Shown only when the paired drug <select> is currently set to اپیوم — used on the
    // admission form (p-drug/p-priority-container) and the patient quick-edit modal
    // (m-p-drug/m-priority-container). The visit modal handles this separately in
    // updateVisitPriorityField() because there the effective drug depends on the special
    // "بدون تغییر" (no change) option, not just the raw <select> value.
    function togglePriorityField(selectId, containerId) {
        const selectEl = document.getElementById(selectId);
        const containerEl = document.getElementById(containerId);
        if (!selectEl || !containerEl) return;

        const priorityInputId = selectId === 'p-drug' ? 'p-priority' : (selectId === 'm-p-initialDrug' ? 'm-p-initialPriority' : 'm-p-priority');
        const priorityInput = document.getElementById(priorityInputId);

        if (selectEl.value === 'اپیوم') {
            containerEl.classList.remove('hidden');
            // Opium priority is shown whenever the drug is اپیوم, in every context
            // (admission form, quick-edit modal), but is always optional — never blocks saving.
        } else {
            containerEl.classList.add('hidden');
            if (priorityInput) {
                priorityInput.removeAttribute('required');
                priorityInput.value = ''; // Priority only applies to اپیوم — clear it for any other drug
            }
        }
    }

    // Sync clinic settings to main header elements & print layouts
    function applySettings() {
        // Update Site Head and Title
        document.title = window.settings.displayTitle || "سامانه مدیریت کلینیک ترک اعتیاد";
        document.getElementById('header-title').innerText = window.settings.displayTitle || "سامانه مدیریت کلینیک ترک اعتیاد";

        // دریافت نام مدیر و پزشک از تنظیمات (با مقدار پیش‌فرض در صورت خالی بودن)
        const managerName = window.settings.managerName || "مدیر کلینیک";
        const doctorName = window.settings.chiefDoctorName || window.staff.doctors[0] || "پزشک معالج";

        // به‌روزرسانی زیرنویس هدر
        document.getElementById('header-sub').innerText = `طراحی و توسعه : ${managerName} | نسخه هوشمند CRM لوکال و آفلاین`;

        // به‌روزرسانی نمایش نام‌ها در سمت چپ هدر
        document.getElementById('header-manager-name').innerText = managerName;
        document.getElementById('header-doctor-name').innerText = doctorName;


        // Update Print Header (using scoped selectors to avoid duplicate ID lookup issues)
        const printClinicName = document.querySelector('#printable-report-area #print-clinic-name');
        if (printClinicName) {
            printClinicName.innerText = window.settings.clinicName || "کلینیک تخصصی ترک اعتیاد";
        }
        const printClinicSub = document.querySelector('#printable-report-area #print-clinic-sub');
        if (printClinicSub) {
            printClinicSub.innerText = `مؤسس: ${managerName} | پزشک ارشد: ${doctorName} | گزارش رسمی وضعیت مراجعین`;
        }

        // Update Dropdown/Selections across screens
        populateStaffSelects();
    }

    function populateStaffSelects() {
        // Counselors Dropdown inside Admission
        const counselSelect = document.getElementById('p-counselor');
        counselSelect.innerHTML = `<option value="" disabled selected>لطفاً مشاور را انتخاب کنید</option>`;
        window.staff.psychologists.forEach(p => {
            counselSelect.innerHTML += `<option value="${p}">${p}</option>`;
        });

        // Doctors Dropdown inside Visit Dialog
        const docSelect = document.getElementById('visit-doctor');
        docSelect.innerHTML = ``;
        window.staff.doctors.forEach(d => {
            docSelect.innerHTML += `<option value="${d}">${d}</option>`;
        });

        // "مشاور" Filter Dropdown inside Custom Report Builder
        const repCounselorFilter = document.getElementById('rep-filter-counselor');
        if (repCounselorFilter) {
            const currentVal = repCounselorFilter.value;
            let optionsHTML = `<option value="">همه مشاوران</option>`;
            window.staff.psychologists.forEach(p => {
                optionsHTML += `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`;
            });
            repCounselorFilter.innerHTML = optionsHTML;
            repCounselorFilter.value = currentVal || '';
        }
    }

    function toggleSubstanceOtherField() {
        const substanceSelect = document.getElementById('p-substance');
        const otherContainer = document.getElementById('other-substance-container');
        const otherInput = document.getElementById('p-substanceOther');

        if (substanceSelect.value === 'سایر مواد روانگردان') {
            otherContainer.classList.remove('hidden');
            otherInput.setAttribute('required', 'required');
        } else {
            otherContainer.classList.add('hidden');
            otherInput.removeAttribute('required');
            otherInput.value = '';
        }
    }

    function toggleDeactiveReasonField() {
        const statusSelect = document.getElementById('p-status');
        const reasonContainer = document.getElementById('deactive-reason-container');
        const reasonSelect = document.getElementById('p-deactiveReason');

        if (statusSelect.value === 'غیرفعال') {
            reasonContainer.classList.remove('hidden');
            reasonSelect.setAttribute('required', 'required');
        } else {
            reasonContainer.classList.add('hidden');
            reasonSelect.removeAttribute('required');
            reasonSelect.value = '';
        }
    }

    // Toggle Modal Deactivation fields in Details Base edit mode
    function toggleModalDeactiveReasonField() {
        const statusVal = document.getElementById('m-p-status').value;
        const container = document.getElementById('m-deactive-reason-container');
        const reasonSelect = document.getElementById('m-p-deactiveReason');
        if (statusVal === 'غیرفعال') {
            container.classList.remove('hidden');
            reasonSelect.setAttribute('required', 'required');
        } else {
            container.classList.add('hidden');
            reasonSelect.removeAttribute('required');
            reasonSelect.value = '';
        }
    }

    // Navigation Tab Switching Controller
    function switchTab(tabId) {
        document.getElementById('tab-dashboard').classList.add('hidden');
        document.getElementById('tab-add-patient').classList.add('hidden');
        document.getElementById('tab-patients-list').classList.add('hidden');
        document.getElementById('tab-follow-ups').classList.add('hidden');
        document.getElementById('tab-dispense').classList.add('hidden');
        document.getElementById('tab-opium').classList.add('hidden');
        document.getElementById('tab-reports-analytics').classList.add('hidden');
        document.getElementById('tab-settings').classList.add('hidden');

        document.getElementById('tab-' + tabId).classList.remove('hidden');

        document.getElementById('btn-dashboard').classList.remove('sidebar-active');
        document.getElementById('btn-add-patient').classList.remove('sidebar-active');
        document.getElementById('btn-patients-list').classList.remove('sidebar-active');
        document.getElementById('btn-follow-ups').classList.remove('sidebar-active');
        document.getElementById('btn-dispense').classList.remove('sidebar-active');
        document.getElementById('btn-opium').classList.remove('sidebar-active');
        document.getElementById('btn-reports-analytics').classList.remove('sidebar-active');
        document.getElementById('btn-settings').classList.remove('sidebar-active');

        document.getElementById('btn-' + tabId).classList.add('sidebar-active');

        if (tabId === 'add-patient' && !document.getElementById('form-edit-id').value) {
            document.getElementById('btn-submit-form').innerText = "ثبت";
            updateLastPatientCodeHint();
        }

        if (tabId === 'dashboard') {
            renderDashboard();
        } else if (tabId === 'patients-list') {
            renderPatientsList();
        } else if (tabId === 'follow-ups') {
            renderVisitsList();
        } else if (tabId === 'dispense') {
            renderDispenseList();
        } else if (tabId === 'opium') {
            // ورود تازه به منوی مدیریت اپیوم همیشه با تب «فهرست بیماران» باز می‌شود؛
            // اما جابه‌جایی داخلی بین دو تب (switchOpiumSubTab) هرگز این مقدار را از اینجا بازنشانی نمی‌کند.
            if (typeof opiumUI !== 'undefined') opiumUI.subTab = 'list';
            renderOpiumPage();
        } else if (tabId === 'reports-analytics') {
            resetReportBuilder();
        } else if (tabId === 'settings') {
            renderSettings();
            switchSettingsSubTab('clinic');
        }
    }

    function switchSettingsSubTab(subTabId) {
        const clinicTab = document.getElementById('settings-sub-tab-clinic');
        const staffTab = document.getElementById('settings-sub-tab-staff');
        const dataTab = document.getElementById('settings-sub-tab-data');
        const aboutTab = document.getElementById('settings-sub-tab-about');

        if (clinicTab) clinicTab.classList.add('hidden');
        if (staffTab) staffTab.classList.add('hidden');
        if (dataTab) dataTab.classList.add('hidden');
        if (aboutTab) aboutTab.classList.add('hidden');

        const activeTab = document.getElementById(`settings-sub-tab-${subTabId}`);
        if (activeTab) activeTab.classList.remove('hidden');

        const clinicBtn = document.getElementById('btn-settings-sub-clinic');
        const staffBtn = document.getElementById('btn-settings-sub-staff');
        const dataBtn = document.getElementById('btn-settings-sub-data');
        const aboutBtn = document.getElementById('btn-settings-sub-about');

        [clinicBtn, staffBtn, dataBtn, aboutBtn].forEach(btn => {
            if (btn) {
                btn.className = "px-5 py-2.5 text-xs font-bold text-slate-500 border-b-2 border-transparent transition rounded-xl flex items-center gap-1.5";
            }
        });

        const activeBtn = document.getElementById(`btn-settings-sub-${subTabId}`);
        if (activeBtn) {
            activeBtn.className = "px-5 py-2.5 text-xs font-bold border-b-2 border-teal-brand text-teal-brand bg-teal-50/50 transition rounded-xl flex items-center gap-1.5";
        }

        if (subTabId === 'data') {
            renderBackupHistoryList();
        }
    }

    // Reports Section Sub-Tab Switching Controller (گزارش‌ساز سفارشی / گزارش بررسی پرونده‌ها)
    function switchReportsSubTab(subTabId) {
        const builderTab = document.getElementById('reports-sub-tab-builder');
        const reviewsTab = document.getElementById('reports-sub-tab-reviews');

        if (builderTab) builderTab.classList.add('hidden');
        if (reviewsTab) reviewsTab.classList.add('hidden');

        const activeTab = document.getElementById(`reports-sub-tab-${subTabId}`);
        if (activeTab) activeTab.classList.remove('hidden');

        const builderBtn = document.getElementById('btn-reports-sub-builder');
        const reviewsBtn = document.getElementById('btn-reports-sub-reviews');

        [builderBtn, reviewsBtn].forEach(btn => {
            if (btn) {
                btn.className = "px-5 py-2.5 text-xs font-bold text-slate-500 border-b-2 border-transparent transition rounded-xl flex items-center gap-1.5";
            }
        });

        const activeBtn = document.getElementById(`btn-reports-sub-${subTabId}`);
        if (activeBtn) {
            activeBtn.className = "px-5 py-2.5 text-xs font-bold border-b-2 border-teal-brand text-teal-brand bg-teal-50/50 transition rounded-xl flex items-center gap-1.5";
        }

        if (subTabId === 'reviews') {
            populateReviewReportFilterOptions();
        }
    }

    // Opium Management Sub-Tab Switching Controller (فهرست بیماران / گزارش تفصیلی مصرف)
    // جابه‌جایی بین این دو تب فقط نمایش را عوض می‌کند و هیچ فیلتر یا داده‌ای را پاک نمی‌کند؛
    // محتوای هر دو تب همواره توسط renderOpiumPage به‌روز نگه داشته می‌شود.
    function switchOpiumSubTab(subTabId) {
        opiumUI.subTab = subTabId;
        const listTab = document.getElementById('opium-sub-tab-list');
        const reportTab = document.getElementById('opium-sub-tab-report');
        if (listTab) listTab.classList.toggle('hidden', subTabId !== 'list');
        if (reportTab) reportTab.classList.toggle('hidden', subTabId !== 'report');

        const listBtn = document.getElementById('btn-opium-sub-list');
        const reportBtn = document.getElementById('btn-opium-sub-report');
        [listBtn, reportBtn].forEach(btn => {
            if (btn) btn.className = "px-5 py-2.5 text-xs font-bold text-slate-500 border-b-2 border-transparent transition rounded-xl flex items-center gap-1.5";
        });
        const activeBtn = document.getElementById(`btn-opium-sub-${subTabId}`);
        if (activeBtn) activeBtn.className = "px-5 py-2.5 text-xs font-bold border-b-2 border-teal-brand text-teal-brand bg-teal-50/50 transition rounded-xl flex items-center gap-1.5";
    }

    // Populate the "بررسی‌کننده" filter select with unique reviewer names found in patientReviews + registered doctors
    function populateReviewReportFilterOptions() {
        const select = document.getElementById('rep-review-filter-reviewer');
        if (!select) return;
        const currentVal = select.value;

        const names = new Set();
        (window.staff.doctors || []).forEach(d => names.add(d));
        (window.patientReviews || []).forEach(r => { if (r.reviewer) names.add(r.reviewer); });

        let optionsHTML = `<option value="">همه</option>`;
        names.forEach(name => {
            optionsHTML += `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`;
        });
        select.innerHTML = optionsHTML;
        select.value = currentVal || '';
    }

    // Populate the deficiency multi-select in the review report filter from the single source of truth array
    function renderReportReviewDeficiencyOptions() {
        const menu = document.getElementById('dropdown-rep-review-deficiency-menu');
        if (!menu) return;
        let itemsHTML = '';
        REVIEW_DEFICIENCY_OPTIONS.forEach(item => {
            itemsHTML += `<label class="flex items-center space-x-2 space-x-reverse cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition"><input type="checkbox" name="rep-review-deficiency-item" value="${escapeHTML(item)}" onchange="updateDropdownLabel('repReviewDeficiency')" class="rounded text-teal-brand w-4 h-4"> <span class="pr-2">${escapeHTML(item)}</span></label>`;
        });
        menu.innerHTML = itemsHTML;
    }

    // Reset all filters in the patient reviews (quality control) report
    function resetPatientReviewsReport() {
        const fromInput = document.getElementById('rep-review-filter-from');
        const toInput = document.getElementById('rep-review-filter-to');
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';

        const reviewerSelect = document.getElementById('rep-review-filter-reviewer');
        if (reviewerSelect) reviewerSelect.value = '';

        const statusSelect = document.getElementById('rep-review-filter-status');
        if (statusSelect) statusSelect.value = '';

        document.querySelectorAll('#dropdown-rep-review-deficiency-menu input[type="checkbox"]').forEach(c => c.checked = false);
        updateDropdownLabel('repReviewDeficiency');

        buildPatientReviewsReport();
    }

    // Build and render the patient reviews (quality control) report based on the active filters
    function buildPatientReviewsReport() {
        const fromDate = document.getElementById('rep-review-filter-from').value;
        const toDate = document.getElementById('rep-review-filter-to').value;
        const reviewerFilter = document.getElementById('rep-review-filter-reviewer').value;
        const statusFilter = document.getElementById('rep-review-filter-status').value;

        const deficiencyFilter = [];
        document.querySelectorAll('#dropdown-rep-review-deficiency-menu input[type="checkbox"]:checked').forEach(c => {
            deficiencyFilter.push(c.value);
        });

        let filtered = (window.patientReviews || []).slice();

        if (fromDate) filtered = filtered.filter(r => r.date >= fromDate);
        if (toDate) filtered = filtered.filter(r => r.date <= toDate);
        if (reviewerFilter) filtered = filtered.filter(r => r.reviewer === reviewerFilter);
        if (statusFilter === 'complete') filtered = filtered.filter(r => r.isComplete);
        if (statusFilter === 'incomplete') filtered = filtered.filter(r => !r.isComplete);
        if (deficiencyFilter.length) {
            filtered = filtered.filter(r => r.deficiencies && r.deficiencies.some(d => deficiencyFilter.includes(d)));
        }

        filtered.sort((a, b) => b.id.localeCompare(a.id));

        // --- Summary Stats ---
        const total = filtered.length;
        const completeCount = filtered.filter(r => r.isComplete).length;
        const incompleteCount = total - completeCount;
        const completePct = total ? Math.round((completeCount / total) * 100) : 0;
        const incompletePct = total ? Math.round((incompleteCount / total) * 100) : 0;

        document.getElementById('rep-review-stat-total').innerText = toPersianDigits(total);
        document.getElementById('rep-review-stat-complete').innerText = toPersianDigits(completeCount);
        document.getElementById('rep-review-stat-incomplete').innerText = toPersianDigits(incompleteCount);
        document.getElementById('rep-review-stat-complete-pct').innerText = '٪' + toPersianDigits(completePct);
        document.getElementById('rep-review-stat-incomplete-pct').innerText = '٪' + toPersianDigits(incompletePct);

        // --- Deficiency Frequency Breakdown ---
        const deficiencyCounts = {};
        REVIEW_DEFICIENCY_OPTIONS.forEach(opt => deficiencyCounts[opt] = 0);
        filtered.forEach(r => {
            (r.deficiencies || []).forEach(d => {
                deficiencyCounts[d] = (deficiencyCounts[d] || 0) + 1;
            });
        });

        const breakdownEl = document.getElementById('rep-review-deficiency-breakdown');
        const hasAnyDeficiency = Object.values(deficiencyCounts).some(c => c > 0);
        if (!hasAnyDeficiency) {
            breakdownEl.innerHTML = `<span class="text-slate-400 italic">در محدوده انتخاب‌شده، نقصی ثبت نشده است.</span>`;
        } else {
            let breakdownHTML = '';
            Object.keys(deficiencyCounts).forEach(key => {
                if (deficiencyCounts[key] > 0) {
                    breakdownHTML += `<span class="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold">${escapeHTML(key)}: ${toPersianDigits(deficiencyCounts[key])} مورد</span>`;
                }
            });
            breakdownEl.innerHTML = breakdownHTML;
        }

        // --- Output Table ---
        const tbody = document.getElementById('rep-review-table-body');
        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 italic">هیچ رکوردی مطابق فیلترهای انتخاب‌شده یافت نشد.</td></tr>`;
            return;
        }

        let rowsHTML = '';
        filtered.forEach(r => {
            const patient = window.patients.find(p => p.id === r.patientId);
            const patientName = r.patientName || (patient ? (patient.fullName || (patient.name + ' ' + patient.lastname)) : '-');
            const patientCode = patient ? toPersianDigits(patient.code) : '-';

            rowsHTML += `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-bold">${escapeHTML(patientName)}</td>
                    <td class="p-3 font-yekan font-bold text-teal-700">${patientCode}</td>
                    <td class="p-3 font-yekan font-bold whitespace-nowrap">${toPersianDigits(r.date)}</td>
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
        tbody.innerHTML = rowsHTML;
    }

    // =====================================================================
    // انتخاب تصادفی پرونده‌ها (گزارش بررسی پرونده‌ها)
    // جامعه‌ی آماری: «تمام» پرونده‌های سیستم (مستقل از فیلترها/صفحه‌بندی)؛
    // به‌صورت پیش‌فرض فقط پرونده‌های فعال، و در صورت تیک گزینه‌ی مربوطه فعال + غیرفعال.
    // =====================================================================
    let __randomSample = null; // { ids: [...], includeInactive: bool, poolSize: n, date: 'yyyy/mm/dd' }

    function isPatientActiveForSampling(p) {
        // وضعیت «فعال» و مقدار قدیمی «فعال می‌باشد (…)» هر دو فعال محسوب می‌شوند
        return p.status === 'فعال' || (typeof p.status === 'string' && p.status.indexOf('فعال می‌باشد') === 0);
    }

    function getRandomSamplePool(includeInactive) {
        const all = window.patients || [];
        if (includeInactive) return all.slice();
        return all.filter(isPatientActiveForSampling);
    }

    // عدد تصادفی صحیح در بازه‌ی [0, max) با crypto و بدون سوگیری (rejection sampling)
    function secureRandomInt(max) {
        if (max <= 1) return 0;
        const cryptoObj = window.crypto || window.msCrypto;
        if (!cryptoObj || !cryptoObj.getRandomValues) return Math.floor(Math.random() * max);
        const limit = Math.floor(4294967296 / max) * max;
        const buf = new Uint32Array(1);
        let x;
        do { cryptoObj.getRandomValues(buf); x = buf[0]; } while (x >= limit);
        return x % max;
    }

    // Fisher–Yates جزئی: n عضو یکتا از آرایه
    function pickRandomUnique(list, n) {
        const arr = list.slice();
        const out = [];
        for (let i = 0; i < n; i++) {
            const j = i + secureRandomInt(arr.length - i);
            const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
            out.push(arr[i]);
        }
        return out;
    }

    function updateRandomSamplePool() {
        const include = document.getElementById('random-sample-include-inactive').checked;
        document.getElementById('random-sample-pool-label').innerText = include
            ? 'تعداد کل پرونده‌ها (فعال و غیرفعال):'
            : 'تعداد پرونده‌های فعال:';
        document.getElementById('random-sample-pool-count').innerText = toPersianDigits(getRandomSamplePool(include).length);
        clearRandomSampleError();
    }

    function clearRandomSampleError() {
        const el = document.getElementById('random-sample-error');
        if (el) { el.classList.add('hidden'); el.innerText = ''; }
    }

    function showRandomSampleError(msg) {
        const el = document.getElementById('random-sample-error');
        el.innerText = msg;
        el.classList.remove('hidden');
    }

    function openRandomSampleModal() {
        document.getElementById('random-sample-count').value = '';
        document.getElementById('random-sample-include-inactive').checked = false;
        updateRandomSamplePool();
        document.getElementById('random-sample-modal').classList.remove('hidden');
        lockBackgroundScroll();
        setTimeout(() => document.getElementById('random-sample-count').focus(), 50);
    }

    function closeRandomSampleModal() {
        document.getElementById('random-sample-modal').classList.add('hidden');
        unlockBackgroundScroll();
    }

    function runRandomSample() {
        const include = document.getElementById('random-sample-include-inactive').checked;
        const pool = getRandomSamplePool(include);
        const raw = toEnglishDigits(String(document.getElementById('random-sample-count').value).trim());
        const count = Number(raw);

        if (raw === '' || !isFinite(count)) { showRandomSampleError('لطفاً تعداد پرونده‌های موردنظر را به‌صورت عدد وارد کنید.'); return; }
        if (!Number.isInteger(count)) { showRandomSampleError('تعداد باید یک عدد صحیح باشد.'); return; }
        if (count <= 0) { showRandomSampleError('تعداد باید بزرگ‌تر از صفر باشد.'); return; }
        if (pool.length === 0) { showRandomSampleError(include ? 'هیچ پرونده‌ای در سیستم وجود ندارد.' : 'هیچ پرونده‌ی فعالی در سیستم وجود ندارد.'); return; }
        if (count > pool.length) {
            showRandomSampleError('تعداد واردشده (' + toPersianDigits(count) + ') بیشتر از تعداد پرونده‌های قابل انتخاب (' + toPersianDigits(pool.length) + ') است.');
            return;
        }

        const picked = pickRandomUnique(pool, count);
        __randomSample = {
            ids: picked.map(p => p.id),
            includeInactive: include,
            poolSize: pool.length,
            date: getShamsiToday()
        };
        closeRandomSampleModal();
        renderRandomSampleResults();

        const card = document.getElementById('random-sample-results');
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeRandomSampleResults() {
        __randomSample = null;
        document.getElementById('random-sample-results').classList.add('hidden');
        document.getElementById('random-sample-table-body').innerHTML = '';
    }

    // ردیف‌های داده‌ی نمونه (مرتب‌شده بر اساس کد پرونده برای پیدا کردن راحت‌تر؛ مرتب‌سازی روی «انتخاب» تأثیری ندارد)
    function getRandomSampleRows() {
        if (!__randomSample) return [];
        const idSet = new Set(__randomSample.ids);
        const rows = (window.patients || []).filter(p => idSet.has(p.id));
        rows.sort((a, b) => Number(a.code) - Number(b.code));
        return rows.map((p, idx) => {
            const reviews = (window.patientReviews || []).filter(r => r.patientId === p.id);
            reviews.sort((a, b) => String(b.id).localeCompare(String(a.id)));
            const last = reviews[0];
            return {
                index: idx + 1,
                code: p.code,
                name: p.fullName || ((p.name || '') + ' ' + (p.lastname || '')).trim() || '-',
                nationalId: p.nationalId || '',
                admissionDate: p.admissionDate || '',
                active: isPatientActiveForSampling(p),
                statusText: isPatientActiveForSampling(p) ? 'فعال' : (p.status || '-'),
                lastReview: last ? { date: last.date, isComplete: !!last.isComplete } : null
            };
        });
    }

    function getRandomSampleSummaryText(rows) {
        const n = toPersianDigits(rows.length);
        const m = toPersianDigits(__randomSample.poolSize);
        return __randomSample.includeInactive
            ? n + ' پرونده از ' + m + ' پرونده (فعال و غیرفعال) انتخاب شده است.'
            : n + ' پرونده از ' + m + ' پرونده فعال انتخاب شده است.';
    }

    function renderRandomSampleResults() {
        if (!__randomSample) return;
        const rows = getRandomSampleRows();
        document.getElementById('random-sample-summary').innerText = getRandomSampleSummaryText(rows);

        document.getElementById('random-sample-table-body').innerHTML = rows.map(r => `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 font-yekan text-slate-400 font-bold">${toPersianDigits(r.index)}</td>
                <td class="p-3 font-yekan font-bold text-teal-700">${toPersianDigits(r.code)}</td>
                <td class="p-3 font-bold">${escapeHTML(r.name)}</td>
                <td class="p-3 font-yekan">${r.nationalId ? toPersianDigits(r.nationalId) : '-'}</td>
                <td class="p-3 font-yekan whitespace-nowrap">${r.admissionDate ? toPersianDigits(r.admissionDate) : '-'}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded font-bold border text-[10px] ${r.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}">${escapeHTML(r.statusText)}</span>
                </td>
                <td class="p-3 whitespace-nowrap">${r.lastReview
                    ? `<span class="font-yekan">${toPersianDigits(r.lastReview.date)}</span> <span class="px-2 py-0.5 rounded font-bold border text-[10px] ${r.lastReview.isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}">${r.lastReview.isComplete ? 'کامل' : 'ناقص'}</span>`
                    : '<span class="text-slate-400">بررسی نشده</span>'}</td>
            </tr>
        `).join('');

        document.getElementById('random-sample-results').classList.remove('hidden');
    }

    function generateRandomSamplePrintHTML(rows) {
        const bodyHTML = rows.map(r => `
            <tr>
                <td style="text-align:center;">${toPersianDigits(r.index)}</td>
                <td style="text-align:center; font-weight:bold;">${toPersianDigits(r.code)}</td>
                <td>${escapeHTML(r.name)}</td>
                <td style="text-align:center;">${r.nationalId ? toPersianDigits(r.nationalId) : '-'}</td>
                <td style="text-align:center;">${r.admissionDate ? toPersianDigits(r.admissionDate) : '-'}</td>
                <td style="text-align:center;">${escapeHTML(r.statusText)}</td>
                <td style="text-align:center;">${r.lastReview ? toPersianDigits(r.lastReview.date) + ' (' + (r.lastReview.isComplete ? 'کامل' : 'ناقص') + ')' : 'بررسی نشده'}</td>
            </tr>
        `).join('');

        return `
        <div dir="rtl">
            <div class="flex justify-between items-center border-b-2 border-slate-800 pb-3 mb-4 print-avoid-break">
                <div>
                    <h2 class="text-xl font-black">${escapeHTML(window.settings.clinicName || 'کلینیک ترک اعتیاد')}</h2>
                    <p class="text-xs font-bold text-slate-600 mt-1">لیست پرونده‌های انتخاب‌شده به‌صورت تصادفی برای بررسی</p>
                </div>
                <div class="text-left text-xs font-bold space-y-1.5">
                    <p>تاریخ تهیه گزارش: <span class="font-yekan text-sm">${toPersianDigits(__randomSample.date)}</span></p>
                    <p class="bg-slate-50 text-slate-800 px-2 py-1 rounded border border-slate-200">تعداد پرونده‌های انتخاب‌شده: <span class="text-base font-black font-yekan ml-1">${toPersianDigits(rows.length)}</span></p>
                </div>
            </div>
            <p class="text-[11px] font-bold text-slate-600 mb-3">${escapeHTML(getRandomSampleSummaryText(rows))}</p>
            <table class="print-table" style="width:100%; border-collapse:collapse; font-size:11px;">
                <thead>
                    <tr>
                        <th>ردیف</th>
                        <th>کد پرونده</th>
                        <th>نام و نام خانوادگی</th>
                        <th>کد ملی</th>
                        <th>تاریخ پذیرش</th>
                        <th>وضعیت پرونده</th>
                        <th>آخرین بررسی</th>
                    </tr>
                </thead>
                <tbody>${bodyHTML}</tbody>
            </table>
        </div>
        `;
    }

    function printRandomSampleList() {
        if (!__randomSample) {
            showCustomAlert("لیستی برای چاپ وجود ندارد", "ابتدا با دکمه «انتخاب تصادفی پرونده‌ها» یک نمونه انتخاب کنید.");
            return;
        }
        const rows = getRandomSampleRows();
        deactivateAllPrintAreas();
        const listArea = document.getElementById('printable-list-area');
        listArea.classList.add('print-active');
        listArea.innerHTML = generateRandomSamplePrintHTML(rows);

        document.getElementById('print-preview-content').innerHTML = listArea.innerHTML;
        document.getElementById('print-preview-modal').classList.remove('hidden');
        lockBackgroundScroll();
    }

    // Print the currently rendered patient reviews report using the app's shared print-preview modal
    function printPatientReviewsReport() {
        const tbody = document.getElementById('rep-review-table-body');
        if (!tbody || tbody.querySelector('td[colspan]')) {
            showCustomAlert("گزارش خالی است", "پیش از چاپ، ابتدا گزارش را با دکمه «ساخت و اعمال گزارش» تولید کنید.");
            return;
        }

        const printHeaderHTML = `
            <tr>
                <th class="p-3">نام بیمار</th>
                <th class="p-3">کد پرونده</th>
                <th class="p-3">تاریخ بررسی</th>
                <th class="p-3">نتیجه بررسی</th>
                <th class="p-3">موارد نقص</th>
                <th class="p-3">توضیحات</th>
            </tr>
        `;

        const printArea = document.getElementById('printable-report-area');
        deactivateAllPrintAreas();
        printArea.classList.add('print-active');

        printArea.innerHTML = `
            <h2 class="text-lg font-black text-center mb-1">${escapeHTML(window.settings.displayTitle || window.settings.clinicName || '')}</h2>
            <h3 class="text-sm font-bold text-center mb-4 text-slate-600">گزارش بررسی پرونده‌ها (کنترل کیفیت) - تاریخ چاپ: ${toPersianDigits(getShamsiToday())}</h3>
            <table class="w-full text-right border-collapse text-xs">
                <thead class="bg-slate-50 text-slate-600 font-bold border-b border-gray-200">${printHeaderHTML}</thead>
                <tbody class="divide-y divide-gray-100 text-slate-700">${tbody.innerHTML}</tbody>
            </table>
        `;

        const previewContent = document.getElementById('print-preview-content');
        previewContent.innerHTML = printArea.innerHTML;
        document.getElementById('print-preview-modal').classList.remove('hidden');
        lockBackgroundScroll();
    }

    // Validate Iranian National ID using the official checksum algorithm (10 digits, weighted mod-11 check digit)
    // NOTE: this function was previously called from two places (handleFormSubmit, saveModalInlineChanges)
    // but was never defined anywhere in the file, so every attempt to add or edit a patient threw an
    // uncaught ReferenceError and silently aborted. Restored here.
    function validateIranianNationalId(id) {
        if (typeof id !== 'string') id = String(id || '');
        if (!/^\d{10}$/.test(id)) return false;
        // Reject known-invalid sequences of repeated digits (e.g. 0000000000, 1111111111)
        if (/^(\d)\1{9}$/.test(id)) return false;

        const digits = id.split('').map(Number);
        const checkDigit = digits[9];
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
        const remainder = sum % 11;

        return (remainder < 2 && checkDigit === remainder) || (remainder >= 2 && checkDigit === 11 - remainder);
    }

    // Live validation of the national ID field on the admission form.
    // Restored alongside validateIranianNationalId (see note above) — wires up the
    // #national-id-err / #national-id-dup-err hints that already existed in the markup.
    function validateNationalIdField(input) {
        // Keep the field digits-only as the user types.
        // IMPORTANT: convert Persian/Arabic digits to English FIRST — otherwise this runs
        // before the global digit-converter (bindDigitConverters) gets a chance to act, and
        // the \D strip below would just delete Persian digits instead of converting them.
        input.value = toEnglishDigits(input.value).replace(/\D/g, '').slice(0, 10);

        const formatErr = document.getElementById('national-id-err');
        const dupErr = document.getElementById('national-id-dup-err');
        const val = input.value;

        if (val.length < 10) {
            if (formatErr) formatErr.classList.add('hidden');
            if (dupErr) dupErr.classList.add('hidden');
            return;
        }

        const isValidFormat = validateIranianNationalId(val);
        if (formatErr) formatErr.classList.toggle('hidden', isValidFormat);

        if (isValidFormat) {
            const editId = document.getElementById('form-edit-id')?.value;
            const isDuplicate = (window.patients || []).some(p => p.nationalId === val && p.id !== editId);
            if (dupErr) dupErr.classList.toggle('hidden', !isDuplicate);
        } else if (dupErr) {
            dupErr.classList.add('hidden');
        }
    }

    // Validate Unique Patient Code
    function validateCodeField(input) {
        const dupSpan = document.getElementById('p-code-dup-err');
        const editId = document.getElementById('form-edit-id').value;

        if (isNaN(parseInt(input.value))) {
            dupSpan.classList.add('hidden');
            return;
        }

        const isDuplicate = isPatientCodeTaken(input.value, editId);
        dupSpan.classList.toggle('hidden', !isDuplicate);
    }

    // Core, reusable duplicate-code check — used by every entry point that can create or
    // change a patient's "کد پرونده" (admission form, quick-edit modal, full-edit form,
    // Excel import). Excluding the record currently being edited (by its own id) is what
    // prevents a false "duplicate" error when the user doesn't actually change the code.
    function isPatientCodeTaken(code, excludeId) {
        const numericCode = parseInt(code, 10);
        if (isNaN(numericCode)) return false;
        return window.patients.some(p => p.code === numericCode && p.id !== excludeId);
    }

    // نمایش راهنمای کوچک کنار فیلد «کد پرونده» در فرم پذیرش مراجع جدید: آخرین کد پرونده‌ی
    // ثبت‌شده در سامانه، کاملاً Dynamic و از روی window.patients محاسبه می‌شود (بدون Hard-code).
    function updateLastPatientCodeHint() {
        const hintSpan = document.getElementById('p-code-last-hint');
        if (!hintSpan) return;
        const numericCodes = (window.patients || [])
            .map(p => Number(p.code))
            .filter(c => Number.isFinite(c));
        if (numericCodes.length === 0) {
            hintSpan.innerText = '';
        } else {
            const lastCode = Math.max(...numericCodes);
            hintSpan.innerText = `(آخرین کد ثبت‌شده: ${toPersianDigits(lastCode)})`;
        }
    }

    // Live duplicate-code check inside the quick-edit modal ("پرونده پزشکی → ویرایش سریع")
    function validateQuickEditCodeField(input) {
        const dupSpan = document.getElementById('m-p-code-dup-err');
        const patientId = input.dataset.patientId;
        if (isNaN(parseInt(input.value))) {
            if (dupSpan) dupSpan.classList.add('hidden');
            return;
        }
        const isDuplicate = isPatientCodeTaken(input.value, patientId);
        if (dupSpan) dupSpan.classList.toggle('hidden', !isDuplicate);
    }
