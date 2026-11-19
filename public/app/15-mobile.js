// نسیم رهایی — لایه موبایل: ناوبری پایین و کارت‌های جدول
// (اسکریپت کلاسیک؛ همه فایل‌های public/app به ترتیب شماره در یک دامنه سراسری اجرا می‌شوند)

// =====================================================================================
// v90: لایه موبایل — ناوبری پایین صفحه + تبدیل جدول‌های فهرستی به کارت روی گوشی
// (هیچ منطق داده‌ای تغییر نکرده؛ فقط نمایش روی صفحه‌های کوچک)
// =====================================================================================
const MOBILE_NAV_PRIMARY = ['dashboard', 'patients-list', 'add-patient', 'follow-ups'];
const isMobileViewport = () => window.matchMedia('(max-width: 767.98px)').matches;

function syncMobileNav(tab) {
    document.querySelectorAll('#mobile-bottom-nav [data-mnav]').forEach(btn => {
        const key = btn.dataset.mnav;
        const on = key === tab || (key === '__menu' && !MOBILE_NAV_PRIMARY.includes(tab));
        btn.classList.toggle('m-nav-active', on);
    });
    document.querySelectorAll('#mobile-nav-sheet [data-msheet]').forEach(btn => {
        btn.classList.toggle('m-sheet-active', btn.dataset.msheet === tab);
    });
}

function openMobileMenu() {
    const src = document.getElementById('sidebar-backup-status');
    const dst = document.getElementById('mobile-backup-status');
    if (src && dst) { dst.textContent = src.textContent; dst.className = src.className + ' mt-2 text-center'; }
    document.getElementById('mobile-nav-sheet').classList.remove('hidden');
}
function closeMobileMenu() {
    const el = document.getElementById('mobile-nav-sheet');
    if (el) el.classList.add('hidden');
}

(function wrapSwitchTabForMobile() {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function (tabId) {
        originalSwitchTab(tabId);
        syncMobileNav(tabId);
        closeMobileMenu();
        if (isMobileViewport()) {
            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.scrollTop = 0;
        }
    };
})();

// برچسب‌گذاری خودکار سلول‌ها از روی سرستون‌ها تا هر ردیف روی گوشی به‌صورت کارت «عنوان: مقدار» دیده شود
const MOBILE_CARD_TBODIES = ['directory-table-body', 'visits-table-body', 'dispense-table-body', 'opium-table-body', 'rep-review-table-body', 'random-sample-table-body', 'no-nid-modal-body'];
function labelMobileCardRows(tbody) {
    const table = tbody.closest('table');
    if (!table) return;
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim());
    tbody.querySelectorAll(':scope > tr').forEach(tr => {
        let col = 0;
        Array.from(tr.children).forEach(td => {
            const span = parseInt(td.getAttribute('colspan'), 10) || 1;
            if (span === 1 && heads[col]) td.setAttribute('data-label', heads[col]);
            col += span;
        });
    });
}
MOBILE_CARD_TBODIES.forEach(id => {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    const table = tbody.closest('table');
    if (table) table.classList.add('m-card-table');
    labelMobileCardRows(tbody);
    new MutationObserver(() => labelMobileCardRows(tbody)).observe(tbody, { childList: true });
});

// بستن منوی «بیشتر» با کلید Escape یا دکمه Back اندروید (در مرورگر)
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });
