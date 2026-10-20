import { appendFileSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const tag = process.env.RELEASE_TAG;

if (tag !== `v${manifest.version}`) {
  throw new Error(`Release tag must match package.json: v${manifest.version}`);
}
if (lock.version !== manifest.version || lock.packages[''].version !== manifest.version) {
  throw new Error('package-lock.json version must match package.json');
}
if (!process.env.GITHUB_OUTPUT) {
  throw new Error('GITHUB_OUTPUT is required');
}

const prerelease = manifest.version.includes('-');
appendFileSync(process.env.GITHUB_OUTPUT, [
  `tag=${tag}`,
  `version=${manifest.version}`,
  `npm_tag=${prerelease ? 'next' : 'latest'}`,
  `prerelease=${prerelease}`,
  ''
].join('\n'));
