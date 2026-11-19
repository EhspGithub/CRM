// Builds the app into dist/ (used by the Windows/Tauri and Android builds and by the dev server).
//
//   src/index.html          page shell; lines like `<!-- @include partials/x.html -->` are replaced by
//                           that file's content (recursively), so dist/index.html is one complete page
//   src/js, src/styles,     copied unchanged
//   src/vendor, src/assets
//
// No bundler is involved: the JS files are classic scripts that share the global scope and run in the
// order index.html lists them, exactly like the inline <script> blocks of the original single file.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = join(ROOT, 'src');
export const DIST = join(ROOT, 'dist');
const COPY_DIRS = ['js', 'styles', 'vendor', 'assets'];
const INCLUDE = /^[ \t]*<!-- @include (\S+) -->[ \t]*$/;

export function renderPage(file = join(SRC, 'index.html'), used = new Set(), stack = []) {
    if (stack.includes(file)) throw new Error(`include cycle: ${[...stack, file].map(f => relative(SRC, f)).join(' -> ')}`);
    if (!existsSync(file)) throw new Error(`missing include: ${relative(SRC, file)} (from ${relative(SRC, stack.at(-1) || file)})`);
    used.add(file);
    const text = readFileSync(file, 'utf8');
    return text.split('\n').map(line => {
        const m = line.match(INCLUDE);
        if (!m) return line;
        return renderPage(join(SRC, m[1]), used, [...stack, file]).replace(/\n$/, '');
    }).join('\n');
}

export function build({ quiet = false } = {}) {
    const used = new Set();
    const html = renderPage(undefined, used);
    rmSync(DIST, { recursive: true, force: true });
    mkdirSync(DIST, { recursive: true });
    writeFileSync(join(DIST, 'index.html'), html);
    for (const dir of COPY_DIRS) cpSync(join(SRC, dir), join(DIST, dir), { recursive: true });
    if (!quiet) console.log(`Built dist/ (${used.size} HTML files, ${(html.length / 1024).toFixed(0)} KB index.html)`);
    return { html, used };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        build();
    } catch (err) {
        console.error(`Build failed: ${err.message}`);
        process.exit(1);
    }
}
