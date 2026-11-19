// نسیم رهایی — ابزارهای عمومی: تاریخ شمسی، صفحه‌بندی، اعداد، امنیت HTML، واحد دوز، پیام‌ها
// (اسکریپت کلاسیک؛ همه فایل‌های src/js به ترتیب فهرست index.html در یک دامنه سراسری اجرا می‌شوند)

let activeModalTab = "base";
let activePatientForModal = null;
let isModalEditMode = false;
let customConfirmCallback = null;

// --- NEW UTILITY: Accurate Jalali to Gregorian Conversion (and vice versa) for math calculations ---
function jalaliToGregorian(jy, jm, jd) {
    jy = parseInt(jy);
    jm = parseInt(jm);
    jd = parseInt(jd);
    const sal_a = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let j_day_no = 365 * (jy - 979) + Math.floor((jy - 979) / 33) * 8 + Math.floor(((jy - 979) % 33 + 3) / 4);
    for (let i = 0; i < jm - 1; ++i) {
        j_day_no += (i < 6) ? 31 : 30;
    }
    j_day_no += jd - 1;
    let g_day_no = j_day_no + 79;
    let gy = 1600 + 400 * Math.floor(g_day_no / 146097);
    g_day_no %= 146097;
    let leap = true;
    if (g_day_no >= 36525) {
        g_day_no--;
        gy += 100 * Math.floor(g_day_no / 36524);
        g_day_no %= 36524;
        if (g_day_no >= 365) {
            g_day_no++;
        } else {
            leap = false;
        }
    }
    gy += 4 * Math.floor(g_day_no / 1461);
    g_day_no %= 1461;
    if (g_day_no >= 366) {
        leap = false;
        g_day_no--;
        gy += Math.floor(g_day_no / 365);
        g_day_no %= 365;
    }
    let i = 0;
    for (i = 0; g_day_no >= sal_a[i] + (i === 1 && leap ? 1 : 0); i++);
    let gd = g_day_no - sal_a[i - 1] - (i > 1 && leap ? 1 : 0) + 1;
    let gm = i;
    return [gy, gm, gd];
}

// --- NEW UTILITY: Add exact days to Jalali Date Safely ---
function addDaysToJalali(dateStr, days) {
    if (!dateStr || isNaN(days)) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;

    // Convert Jalali input to Gregorian
    const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2]);

    // Perform precise JS Date math
    const gDate = new Date(gy, gm - 1, gd);
    gDate.setDate(gDate.getDate() + days);

    // Convert Gregorian result back to Jalali
    const [jy, jm, jd] = gregorianToJalali(gDate.getFullYear(), gDate.getMonth() + 1, gDate.getDate());

    // Format back to YYYY/MM/DD
    const mm = jm < 10 ? '0' + jm : jm;
    const dd = jd < 10 ? '0' + jd : jd;
    return `${jy}/${mm}/${dd}`;
}

// Pagination State & Engine
const tableState = {
    patients: { data: [], page: 1, limit: 10 },
    visits: { data: [], page: 1, limit: 10 },
    dispense: { data: [], page: 1, limit: 10 },
    reports: { data: [], cols: {}, page: 1, limit: 20 }
};

function renderPaginationControls(type) {
    const state = tableState[type];
    const container = document.getElementById(`${type}-pagination-ui`);
    if (!container) return;

    const limit = state.limit;
    const total = state.data.length;
    const totalPages = limit === 'all' ? 1 : Math.ceil(total / limit);
    const currentPage = state.page;

    let start = limit === 'all' ? (total > 0 ? 1 : 0) : (total === 0 ? 0 : (currentPage - 1) * limit + 1);
    let end = limit === 'all' ? total : Math.min(start + limit - 1, total);

    let buttonsHtml = '';

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) { startPage = Math.max(1, endPage - 4); }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            buttonsHtml += `<button class="w-7 h-7 flex items-center justify-center rounded-lg bg-teal-brand text-white font-bold transition shadow-md">${toPersianDigits(i)}</button>`;
        } else {
            buttonsHtml += `<button onclick="changePage('${type}', ${i})" class="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-slate-500 hover:bg-slate-50 hover:text-teal-brand font-bold transition">${toPersianDigits(i)}</button>`;
        }
    }

    container.innerHTML = `
        <div class="flex flex-wrap items-center justify-between w-full gap-4 font-sans">
            <div class="flex items-center gap-3">
                <span class="text-slate-500 font-bold">تعداد در صفحه:</span>
                <select onchange="changeLimit('${type}', this.value)" class="px-2 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-teal-brand text-xs font-bold bg-white text-slate-700 shadow-sm cursor-pointer">
                    <option value="10" ${limit === 10 ? 'selected' : ''}>۱۰</option>
                    <option value="20" ${limit === 20 ? 'selected' : ''}>۲۰</option>
                    <option value="50" ${limit === 50 ? 'selected' : ''}>۵۰</option>
                    <option value="100" ${limit === 100 ? 'selected' : ''}>۱۰۰</option>
                    <option value="500" ${limit === 500 ? 'selected' : ''}>۵۰۰ (سقف ایمن)</option>
                </select>
                <span class="text-slate-500 font-bold border-r pr-3">نمایش ${toPersianDigits(start)} تا ${toPersianDigits(end)} از ${toPersianDigits(total)}</span>
            </div>
            <div class="flex items-center gap-1.5" dir="ltr">
                <button onclick="changePage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-slate-500 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"><i class="fa-solid fa-chevron-left text-[10px]"></i></button>
                ${buttonsHtml}
                <button onclick="changePage('${type}', ${currentPage + 1})" ${currentPage === totalPages || total === 0 ? 'disabled' : ''} class="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-slate-500 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"><i class="fa-solid fa-chevron-right text-[10px]"></i></button>
            </div>
        </div>
    `;
}

window.changePage = function(type, page) {
    tableState[type].page = page;
    if (type === 'patients') renderPaginatedPatients();
    if (type === 'visits') renderPaginatedVisits();
    if (type === 'dispense') renderPaginatedDispense();
    if (type === 'reports') renderPaginatedReportTable();
};

window.changeLimit = function(type, limitVal) {
    // اعمال محدودیت امن برای جلوگیری از Crash مرورگر در داده‌های حجیم
    const parsedLimit = limitVal === 'all' ? 500 : parseInt(limitVal);

    if (limitVal === 'all' || parsedLimit > 500) {
        tableState[type].limit = 500;
        showToast("برای حفظ سرعت سامانه، رندرینگ یکجا به ۵۰۰ رکورد محدود شد.");
    } else {
        tableState[type].limit = parsedLimit;
    }

    tableState[type].page = 1; // Reset to page 1
    if (type === 'patients') renderPaginatedPatients();
    if (type === 'visits') renderPaginatedVisits();
    if (type === 'dispense') renderPaginatedDispense();
    if (type === 'reports') renderPaginatedReportTable();
};

// Convert standard numbers to Persian digits for display
function toPersianDigits(num) {
    if (num === null || num === undefined) return '';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/[0-9]/g, x => persianDigits[parseInt(x)]);
}

// --- NEW UTILITY: Convert Persian/Arabic Digits to Standard English Digits (Optimized) ---
const persianArabicDigitMap = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};
function toEnglishDigits(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[۰-۹٠-٩]/g, match => persianArabicDigitMap[match]);
}

// --- PERFORMANCE: precomputed patientId -> visit lookup maps ---
// Several table renders (patients list, visits list, dispense list, report table) used to
// do `window.visits.filter(v => v.patientId === p.id)` for EVERY row, rescanning the whole
// visits array each time (O(patients × visits)). These two helpers build the lookup once
// per render (O(visits)), then each row does an O(1) Map lookup — same exact results,
// just computed once instead of once per row.

// Equivalent to `visits.filter(v => v.patientId === id)[0]` — first match in array order.
function buildFirstVisitMap(visits) {
    const map = new Map();
    visits.forEach(v => {
        if (!map.has(v.patientId)) map.set(v.patientId, v);
    });
    return map;
}

// Equivalent to `visits.filter(v => v.patientId === id).sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0]`
// — the visit with the latest date (ties broken by the lexicographically greatest id).
function buildLatestVisitMap(visits) {
    const map = new Map();
    const cmp = (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    visits.forEach(v => {
        const current = map.get(v.patientId);
        if (!current || cmp(v, current) < 0) {
            map.set(v.patientId, v);
        }
    });
    return map;
}

// --- NEW UTILITY: Normalize identifier values (National ID / Phone) to a clean,
// storage-safe, universally-pasteable format ---
// Root-cause fix for the "copy/paste rejected by other systems" issue: values were being
// displayed with Persian digits (by design, for readability) and could also contain stray
// whitespace, dashes/parentheses (phone), or invisible Unicode characters (ZWNJ/ZWSP/BOM/
// LRM/RLM) picked up from pasted/imported data. This strips all of that down to plain
// ASCII digits (0-9) — the exact format external forms/validators expect.
function normalizeIdentifierValue(val) {
    if (val === null || val === undefined) return '';
    let str = toEnglishDigits(String(val));
    // Strip zero-width / bidi / invisible characters and all whitespace
    str = str.replace(/[\u200B\u200C\u200D\uFEFF\u200E\u200F\s]/g, '');
    // National ID and phone are numeric-only in this system — drop anything else
    // (stray dashes, parentheses, etc. sometimes present in hand-typed or pasted phone numbers)
    str = str.replace(/[^0-9]/g, '');
    return str;
}

// --- NEW UTILITY: Copy the clean, normalized value to the clipboard ---
// Used by the copy buttons next to nationalId/phone in the patient record so what lands in
// the clipboard is always plain ASCII digits, independent of how the value is visually
// rendered (Persian digits) in the interface.
window.copyCleanValueToClipboard = async function(rawValue, label) {
    const clean = normalizeIdentifierValue(rawValue);
    if (!clean) return;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(clean);
        } else {
            const tempInput = document.createElement('textarea');
            tempInput.value = clean;
            tempInput.style.position = 'fixed';
            tempInput.style.opacity = '0';
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
        }
        showToast(`${label} با فرمت استاندارد (اعداد انگلیسی، بدون فاصله یا کاراکتر اضافی) کپی شد.`);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        showToast('کپی کردن با خطا مواجه شد. لطفاً به‌صورت دستی انتخاب و کپی کنید.', 'error');
    }
};

// --- NEW UTILITY: XSS Prevention (Sanitize HTML) ---
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- منطق مرکزی واحد دوز دارویی (Root-cause fix: تنها محل تعیین واحد دوز در کل برنامه) ---
// قواعد بالینی: بوپرنورفین (قرص) و ق متادون (قرص متادون) => mg | ش متادون (شربت) و اپیوم (مایع) => cc
// منطق تطبیق نام دارو دقیقاً همان منطق موجود در handleDrugDosageUnits است تا با نام‌های قدیمی/legacy هم سازگار بماند.
function getDoseUnitCode(drugName) {
    if (!drugName) return '';
    if (drugName.includes('قرص') || drugName.includes('ق ') || drugName === 'ق متادون' || drugName.includes('بوپرنورفین')) {
        return 'mg';
    }
    if (drugName.includes('شربت') || drugName.includes('ش ') || drugName === 'ش متادون' || drugName === 'اپیوم') {
        return 'cc';
    }
    return ''; // روان‌درمانی و سایر موارد بدون دارو => بدون واحد دوز
}

// برچسب کامل واحد (برای فرم‌های ثبت/ویرایش - مثل «میلی‌گرم در روز»)
function getDoseUnitLabel(drugName) {
    const code = getDoseUnitCode(drugName);
    if (code === 'mg') return 'میلی‌گرم در روز';
    if (code === 'cc') return 'سی‌سی در روز';
    return '';
}

// نمایش HTML عدد دوز + واحد کوچک و ظریف (برای جدول‌ها، کارت‌ها و گزارش‌های HTML)
// مقدار عددی دوز در دیتابیس دست‌نخورده می‌ماند؛ واحد فقط در لحظه نمایش اضافه می‌شود.
function formatDosageHTML(drugName, dosage) {
    if (!dosage) return '-';
    const unit = getDoseUnitCode(drugName);
    const unitPart = unit ? `<span class="text-[9px] font-normal opacity-70 mr-0.5">${unit}</span>` : '';
    return `<span class="font-yekan">${toPersianDigits(dosage)}</span>${unitPart}`;
}

// نمایش متنی ساده عدد دوز + واحد (برای innerText، CSV و سایر خروجی‌های بدون قابلیت استایل‌دهی)
function formatDosagePlain(drugName, dosage) {
    if (!dosage) return '-';
    const unit = getDoseUnitCode(drugName);
    return unit ? `${dosage} ${unit}` : `${dosage}`;
}

// --- NEW UTILITY: Debounce for Performance (Phase 2 - Issue #1) ---
function debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

const debouncedFilterDirectory = debounce(() => filterDirectory(), 350);
const debouncedFilterVisitsTab = debounce(() => filterVisitsTab(), 350);
const debouncedFilterDispenseTab = debounce(() => filterDispenseTab(), 350);

// --- شماره 1: بهینه‌سازی رویداد تبدیل اعداد (اتصال مستقیم به جای Event Delegation سراسری) ---
function applyDigitConversion(inputEl) {
    // جلوگیری از اتصال چندباره رویداد به یک عنصر
    if (!inputEl || inputEl.hasAttribute('data-digit-bound')) return;

    inputEl.addEventListener('input', function(e) {
        const originalVal = this.value;
        if (/[۰-۹٠-٩]/.test(originalVal)) {
            const convertedVal = toEnglishDigits(originalVal);
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = convertedVal;
            try {
                if (this.type !== 'number') { 
                    this.setSelectionRange(start, end);
                }
            } catch(err) {} 
        }
    });
    inputEl.setAttribute('data-digit-bound', 'true');
}

function bindDigitConverters() {
    // پیدا کردن دقیق فیلدهایی که نیاز به تبدیل عدد دارند
    const targetInputs = document.querySelectorAll('input[type="tel"], input[type="number"], input[data-jdp], input[id*="nationalId"], input[id*="phone"]');
    targetInputs.forEach(applyDigitConversion);
}

// Calculate Shamsi Age relative to exact current Shamsi date (Down to Year, Month and Day)
function calculateShamsiAge(birthdateStr) {
    if (!birthdateStr) return '';
    const parts = birthdateStr.split('/');
    if (parts.length !== 3) return '';

    const bYear = parseInt(parts[0]);
    const bMonth = parseInt(parts[1]);
    const bDay = parseInt(parts[2]);

    if (isNaN(bYear) || isNaN(bMonth) || isNaN(bDay)) return '';

    const todayStr = getShamsiToday(); // Current date, e.g., "1405/03/16"
    const todayParts = todayStr.split('/');
    const cYear = parseInt(todayParts[0]);
    const cMonth = parseInt(todayParts[1]);
    const cDay = parseInt(todayParts[2]);

    let age = cYear - bYear;
    // If current month is less than birth month, or months are equal but current day is less than birth day
    if (cMonth < bMonth || (cMonth === bMonth && cDay < bDay)) {
        age--;
    }
    return age >= 0 ? age : 0;
}

// --- NEW UTILITY: Background Scroll Lock for Modals (Issue #10) ---
// وضعیت قفل اسکرول دیگر با «شمارنده» نگه داشته نمی‌شود (شمارنده اگر یک بار lock/unlock
// نامتقارن می‌شد، اسکرول تا ریلود صفحه قفل می‌ماند، مثل مسیر چاپ پرونده).
// به‌جای آن، هر بار وضعیت واقعی مودال‌ها در DOM بررسی می‌شود: اگر حتی یک مودال باز باشد
// قفل می‌ماند، وگرنه اسکرول آزاد می‌شود.
function syncBackgroundScrollLock() {
    const anyModalOpen = Array.from(document.querySelectorAll('.fixed.inset-0[id$="-modal"]'))
        .some(el => !el.classList.contains('hidden'));
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    if (anyModalOpen) {
        mainEl.classList.remove('overflow-y-auto');
        mainEl.classList.add('overflow-hidden');
    } else {
        mainEl.classList.remove('overflow-hidden');
        mainEl.classList.add('overflow-y-auto');
    }
}

// نام‌های قدیمی حفظ شده‌اند تا همه‌ی فراخوانی‌های موجود بدون تغییر کار کنند.
function lockBackgroundScroll() { syncBackgroundScrollLock(); }
function unlockBackgroundScroll() { syncBackgroundScrollLock(); }

// Premium alert replacement
function showCustomAlert(title, message) {
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-message').innerText = message;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

// Handle alert close
function closeCustomAlert() {
    document.getElementById('custom-alert-modal').classList.add('hidden');
    unlockBackgroundScroll();
}

// Premium confirmation replacement
function showCustomConfirm(title, message, callback) {
    document.getElementById('custom-confirm-title').innerText = title;
    document.getElementById('custom-confirm-message').innerText = message;
    customConfirmCallback = callback;
    document.getElementById('custom-confirm-modal').classList.remove('hidden');
    lockBackgroundScroll();
}

// Handle confirm actions
function closeCustomConfirm(isConfirmed) {
    document.getElementById('custom-confirm-modal').classList.add('hidden');
    unlockBackgroundScroll();
    if (isConfirmed && customConfirmCallback) {
        customConfirmCallback();
    }
    customConfirmCallback = null;
}

