// Structural checks for src/ and the dist/ build: every include resolves, every partial and script is
// used, nothing is loaded from the internet, and every JS file is valid classic-script syntax.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Script } from 'node:vm';
import { build, DIST, SRC } from '../../scripts/build.mjs';

const walk = dir => readdirSync(dir, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const isRemote = url => /^(https?:)?\/\//i.test(url);

const { html, used } = build({ quiet: true });
const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);

test('every @include is resolved', () => {
    assert.doesNotMatch(html, /<!-- @include /);
});

test('every partial is included exactly once', () => {
    const partials = walk(join(SRC, 'partials'));
    const unused = partials.filter(p => !used.has(p)).map(p => relative(SRC, p));
    assert.deepEqual(unused, []);
    const shell = readFileSync(join(SRC, 'index.html'), 'utf8') + partials.map(p => readFileSync(p, 'utf8')).join('\n');
    for (const p of partials) {
        const count = shell.split(`@include ${relative(SRC, p)} `).length - 1;
        assert.equal(count, 1, `${relative(SRC, p)} included ${count} times`);
    }
});

test('the page loads nothing from the internet and every local file exists', () => {
    for (const ref of refs) {
        if (ref.startsWith('data:')) continue;
        assert.ok(!isRemote(ref), `remote reference: ${ref}`);
        const file = join(DIST, ref);
        assert.ok(existsSync(file), `missing: ${ref}`);
        if (!ref.endsWith('.css')) continue;
        for (const [, url] of readFileSync(file, 'utf8').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
            if (url.startsWith('data:')) continue;
            assert.ok(!isRemote(url), `${ref} loads remote ${url}`);
            assert.ok(existsSync(join(dirname(file), url.split(/[?#]/)[0])), `${ref}: missing ${url}`);
        }
    }
});

test('every app script is loaded once and is valid classic-script syntax', () => {
    const scripts = refs.filter(r => r.startsWith('js/'));
    assert.equal(new Set(scripts).size, scripts.length, 'a script is listed twice');
    const files = walk(join(SRC, 'js')).map(f => relative(SRC, f).split('\\').join('/'));
    assert.deepEqual([...files].sort(), [...scripts].sort());
    for (const f of files) new Script(readFileSync(join(SRC, f), 'utf8'), { filename: f });
    assert.equal(scripts.at(-1), 'js/main.js', 'js/main.js (start-up) must be the last script');
});

test('version 93 of the app', () => {
    assert.match(html, /ورژن\s*۹۳/);
});
