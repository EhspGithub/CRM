// Injected before the page's own scripts. Makes the browser-only features of index.html work inside
// the Android WebView: <a download> (backup .json / .csv export) and window.print().
(function () {
    if (window.__nrAndroidBridge || !window.NRAndroid) return;
    window.__nrAndroidBridge = true;

    // Keep the Blob behind every object URL: the page revokes the URL right after link.click().
    const blobs = new Map();
    const createURL = URL.createObjectURL.bind(URL);
    const revokeURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
        const url = createURL(obj);
        if (obj instanceof Blob) blobs.set(url, obj);
        return url;
    };
    URL.revokeObjectURL = function (url) {
        setTimeout(() => { blobs.delete(url); revokeURL(url); }, 60000);
    };

    function save(blob, name) {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            window.NRAndroid.saveFile(name || 'download', blob.type || 'application/octet-stream',
                dataUrl.substring(dataUrl.indexOf(',') + 1));
        };
        reader.readAsDataURL(blob);
    }

    function handleDownload(a) {
        if (!a || !a.hasAttribute('download')) return false;
        const href = a.href || '';
        const blob = blobs.get(href);
        if (blob) { save(blob, a.download); return true; }
        if (href.startsWith('data:')) {
            fetch(href).then(r => r.blob()).then(b => save(b, a.download));
            return true;
        }
        return false;
    }

    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (handleDownload(this)) return;
        return nativeClick.call(this);
    };
    document.addEventListener('click', e => {
        const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
        if (a && handleDownload(a)) e.preventDefault();
    }, true);

    window.print = function () { window.NRAndroid.print(document.title || 'Nasim Rahayi'); };
})();
