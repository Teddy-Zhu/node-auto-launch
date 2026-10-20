import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });

const options = {
  absWorkingDir: root,
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node22.14',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info'
};

await Promise.all([
  build({ ...options, format: 'esm', outfile: 'dist/index.js' }),
  build({
    ...options,
    format: 'cjs',
    outfile: 'dist/index.cjs',
    footer: { js: 'module.exports = module.exports.default;\nmodule.exports.default = module.exports;' }
  })
]);
