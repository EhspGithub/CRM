import { defineConfig } from "vite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Tauri expects a fixed dev port and must not clear its own Rust build output.
const host = process.env.TAURI_DEV_HOST;

// Online demo build (`npm run build:demo`): relative paths for GitHub Pages and a neutral clinic name.
const DEMO_TEXT = [
  ["سامانه نسیم رهایی - تحت مدیریت بالینی دکتر حسن‌پور", "سامانه مدیریت کلینیک - نسخه نمایشی"],
  ["سامانه مدیریت کلینیک ترک اعتیاد نسیم رهایی", "سامانه مدیریت کلینیک ترک اعتیاد — نسخه نمایشی"],
  ["کلینیک ترک اعتیاد «نسیم رهایی»", "کلینیک ترک اعتیاد"],
  ["سامانه هوشمند Clinical CRM نسیم رهایی", "سامانه هوشمند Clinical CRM کلینیک"],
  ["سامانه نسیم رهایی", "سامانه مدیریت کلینیک"],
  ["«نسیم رهایی»", "«کلینیک نمونه»"],
  ["نسیم رهایی", "کلینیک نمونه"],
];
const demoHtml = {
  name: "nr-demo-html",
  transformIndexHtml(html) {
    for (const [a, b] of DEMO_TEXT) html = html.split(a).join(b);
    return html.replace("<head>", '<head>\n    <meta name="robots" content="noindex">');
  },
  // public/app/*.js are copied verbatim: minify them (drops source comments) and neutralise the name
  writeBundle(opts) {
    const dir = join(opts.dir, "app");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".js"))) {
      let code = readFileSync(join(dir, f), "utf8");
      code = transformSync(code, { loader: "js", minify: true, target: "chrome105", legalComments: "none" }).code;
      for (const [a, b] of [["نسیم کمالی", "نگار کمالی"], ...DEMO_TEXT]) code = code.split(a).join(b);
      writeFileSync(join(dir, f), code);
    }
    const assets = join(opts.dir, "assets");
    for (const f of readdirSync(assets).filter((n) => n.endsWith(".js"))) {
      const code = readFileSync(join(assets, f), "utf8");
      let out = code;
      for (const [a, b] of DEMO_TEXT) out = out.split(a).join(b);
      if (out !== code) writeFileSync(join(assets, f), out);
    }
  },
};

export default defineConfig(({ mode }) => ({
  clearScreen: false,
  base: mode === "demo" ? "./" : "/",
  plugins: mode === "demo" ? [demoHtml] : [],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  preview: { port: 4173, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // WebView2 (Windows) and Android System WebView are both evergreen Chromium
    target: "chrome105",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 1500,
    outDir: mode === "demo" ? "dist-demo" : "dist",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
}));
