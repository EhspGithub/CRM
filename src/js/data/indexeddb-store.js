// نسیم رهایی — لایه ذخیره‌سازی IndexedDB (جایگزین SQLite نسخه نصبی)
// همان رابط window.NRStore که بقیه برنامه استفاده می‌کند: getAll / put / putAll / replaceAll / delete / clear / counts
(function () {
    const DB_NAME = 'nasim-rahayi-crm';
    const DB_VERSION = 1;
    const STORE_NAMES = [
        'patients', 'visits', 'contactLogs', 'insuranceHistory', 'auditLogs', 'backupHistory',
        'patientReviews', 'mergeConflictLog', 'opiumMembers', 'opiumPlans', 'opiumDeliveries',
        'opiumPeriods', 'settings', 'staff', 'appHandles'
    ];

    function openDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error('این مرورگر از IndexedDB پشتیبانی نمی‌کند.'));
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                STORE_NAMES.forEach(name => {
                    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
                });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('باز کردن IndexedDB ناموفق بود.'));
            req.onblocked = () => reject(new Error('پایگاه داده توسط تب دیگری قفل شده است؛ سایر تب‌های برنامه را ببندید.'));
        });
    }

    class IdbStore {
        constructor(db) { this.db = db; }

        _check(name) {
            if (!STORE_NAMES.includes(name)) throw new Error('Unknown store: ' + name);
        }

        // Runs `fn` inside ONE readwrite transaction: everything is saved, or (on any error) nothing changes.
        _write(names, fn) {
            return new Promise((resolve, reject) => {
                let tx;
                try {
                    names.forEach(n => this._check(n));
                    tx = this.db.transaction(names, 'readwrite');
                } catch (e) { return reject(e); }
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('تراکنش IndexedDB لغو شد.'));
                try { fn(tx); } catch (e) {
                    try { tx.abort(); } catch (_) { /* already finished */ }
                    reject(e);
                }
            });
        }

        getAll(name) {
            return new Promise((resolve, reject) => {
                try {
                    this._check(name);
                    const req = this.db.transaction(name, 'readonly').objectStore(name).getAll();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                } catch (e) { reject(e); }
            });
        }

        put(name, record) {
            return this._write([name], tx => { tx.objectStore(name).put(record); });
        }

        // Replaces the whole store atomically.
        putAll(name, records) {
            return this._write([name], tx => {
                const store = tx.objectStore(name);
                store.clear();
                (records || []).forEach(r => store.put(r));
            });
        }

        // Replaces several stores in ONE transaction (full restore / smart merge).
        replaceAll(map) {
            const names = Object.keys(map);
            return this._write(names, tx => {
                names.forEach(n => {
                    const store = tx.objectStore(n);
                    store.clear();
                    (map[n] || []).forEach(r => store.put(r));
                });
            });
        }

        delete(name, id) {
            return this._write([name], tx => { tx.objectStore(name).delete(id); });
        }

        clear(name) { return this.putAll(name, []); }

        counts() {
            return Promise.all(STORE_NAMES.map(n => new Promise((resolve, reject) => {
                const req = this.db.transaction(n, 'readonly').objectStore(n).count();
                req.onsuccess = () => resolve([n, req.result]);
                req.onerror = () => reject(req.error);
            }))).then(pairs => Object.fromEntries(pairs));
        }
    }

    window.NRIDB = {
        async open() {
            const db = await openDb();
            // اگر مرورگر اجازه دهد، ذخیره‌سازی را «ماندگار» می‌کند تا هنگام کمبود فضا پاک نشود
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) { /* optional */ }
            return new IdbStore(db);
        }
    };
})();

