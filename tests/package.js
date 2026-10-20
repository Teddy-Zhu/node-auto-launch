import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (!process.env.npm_execpath) throw new Error('Run this check with npm run test:package');
const directory = await mkdtemp(path.join(tmpdir(), 'auto-launch-package-'));

function npm(args, cwd = root) {
  return execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: 'utf8' });
}

try {
  // The build is checked as-is; packing must not rebuild and hide a missing output.
  const [packed] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory]));
  assert.deepEqual(packed.files.map((file) => file.path).sort(), [
    'LICENSE.md', 'README.md', 'package.json',
    'dist/index.js', 'dist/index.js.map', 'dist/index.cjs', 'dist/index.cjs.map'
  ].sort());
  assert.equal(packed.version, manifest.version);
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-package-lock', '--no-audit', '--no-fund',
    path.join(directory, packed.filename)], directory);

  const assertions = `
    assert.equal(typeof AutoLaunch, 'function');
    assert.throws(() => new AutoLaunch({}), /name/);
    const launcher = new AutoLaunch({
      name: 'Package Check', path: process.execPath, options: { extraArguments: ['two words'] }
    });
    assert.deepEqual(launcher.api.options.extraArguments, ['two words']);
    for (const method of ['enable', 'disable', 'isEnabled']) assert.equal(typeof launcher[method], 'function');
  `;
  for (const [format, source] of [
    ['module', `import assert from 'node:assert/strict'; import AutoLaunch from '${manifest.name}';`],
    ['commonjs', `const assert = require('node:assert/strict'); const AutoLaunch = require('${manifest.name}');
      assert.equal(AutoLaunch.default, AutoLaunch);`]
  ]) {
    execFileSync(process.execPath, [`--input-type=${format}`, '-e', source + assertions], {
      cwd: directory, stdio: 'pipe'
    });
  }
  console.log(`Package verified: ${packed.filename}, ${packed.files.length} files, ${packed.size} bytes; ESM and CommonJS load correctly.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
