// Native-app shims, installed before the clinic UI scripts load. They make the UI's browser-style file and
// print code work inside the app's webview without rewriting every call site:
//   * <a download href="blob:..."> (Excel/CSV exports)   -> native "Save as" dialog
//   * <input type="file"> (backup restore, CSV import)   -> native "Open" dialog (works on Android too)
//   * window.print() on Android (WebView cannot print)   -> the report is saved as an .html file
import { saveTextFile, openTextFile, isAndroid } from "./index.js";

function notify(message, type) {
  if (typeof window.showToast === "function") window.showToast(message, type);
}

function interceptDownloads() {
  // keep blob URLs alive long enough for the async save below (the UI revokes them right after click())
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = (url) => setTimeout(() => revoke(url), 60000);

  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !/^blob:|^data:/.test(this.href)) return nativeClick.call(this);
    const name = this.download;
    fetch(this.href)
      .then((r) => r.text())
      .then((content) => saveTextFile({ defaultName: name, content }))
      .then((saved) => { if (saved) notify(`فایل «${name}» ذخیره شد.`); })
      .catch((err) => {
        console.error("Save failed", err);
        notify("ذخیره فایل ناموفق بود: " + (err && err.message ? err.message : err), "error");
      });
  };
}

function interceptFileInputs() {
  document.addEventListener(
    "click",
    (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      e.preventDefault();
      const extensions = (input.accept || ".json").split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean);
      openTextFile({ extensions })
        .then((picked) => {
          if (!picked) return;
          const dt = new DataTransfer();
          dt.items.add(new File([picked.content], picked.name, { type: "text/plain" }));
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        })
        .catch((err) => {
          console.error("Open failed", err);
          notify("باز کردن فایل ناموفق بود: " + (err && err.message ? err.message : err), "error");
        });
    },
    true,
  );
}

/** Android WebView has no print: save the active print area as a standalone HTML document instead. */
function androidPrint() {
  window.print = () => {
    const area = document.querySelector(".print-active");
    if (!area) return notify("چیزی برای چاپ انتخاب نشده است.", "warning");
    const css = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const r of sheet.cssRules) css.push(r.cssText);
      } catch {
        /* cross-origin sheet: skip */
      }
    }
    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${document.title}</title><style>${css.join("\n")}
.print-doc{display:block!important;padding:16px;font-family:Vazirmatn,Tahoma,sans-serif}</style></head>
<body style="height:auto;overflow:visible;background:#fff"><div class="print-doc" dir="rtl">${area.innerHTML}</div></body></html>`;
    const name = `nasim_rahayi_report_${Date.now()}.html`;
    saveTextFile({ defaultName: name, content: html, mime: "text/html" })
      .then((saved) => { if (saved) notify("گزارش به‌صورت فایل HTML ذخیره شد؛ آن را با مرورگر باز کرده و از آنجا چاپ یا ارسال کنید."); })
      .catch((err) => notify("ذخیره گزارش ناموفق بود: " + (err && err.message ? err.message : err), "error"));
  };
}

export function installNativeShims() {
  interceptDownloads();
  interceptFileInputs();
  if (isAndroid()) androidPrint();
}
