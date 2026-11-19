(async function () {
    const splashMsg = document.getElementById('nr-splash-msg');
    try {
        window.NRStore = await window.NRIDB.open();
    } catch (err) {
        console.error(err);
        if (splashMsg) {
            splashMsg.className = 'text-xs text-rose-300 font-bold max-w-md text-center leading-relaxed';
            splashMsg.textContent = 'باز کردن پایگاه داده (IndexedDB) ناموفق بود: ' + (err && err.message ? err.message : err);
        }
        return;
    }
    await window.__nrBoot();
    const splash = document.getElementById('nr-splash');
    if (splash) splash.remove();
})();

