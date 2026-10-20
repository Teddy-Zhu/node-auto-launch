import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import applescript from 'applescript';
import AutoLaunch from '../src/index.js';
import LinuxAPI from '../src/library/autoLaunchAPI/autoLaunchAPILinux.js';
import MacAPI from '../src/library/autoLaunchAPI/autoLaunchAPIMac.js';
import WindowsAPI from '../src/library/autoLaunchAPI/autoLaunchAPIWindows.js';
import { fileExists, removeFile } from '../src/library/fileBasedUtilities.js';

const require = createRequire(import.meta.url);
let directory;
let restorations;

function setProperty(target, key, value) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  restorations.push(() => {
    if (original) Object.defineProperty(target, key, original);
    else delete target[key];
  });
}

function setEnvironment(key, value) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  restorations.push(() => {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  });
}

function init({ appName = 'My App', appPath = process.execPath, options = {} } = {}) {
  return {
    appName,
    appPath,
    options: { launchInBackground: false, extraArguments: [], mac: {}, linux: {}, ...options }
  };
}

beforeEach(async () => {
  restorations = [];
  directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'auto-launch-'));
  mock.method(os, 'homedir', () => directory);
  syncBuiltinESMExports();
  setEnvironment('XDG_CONFIG_HOME', path.join(directory, 'config'));
  setEnvironment('APPIMAGE', undefined);
});

afterEach(async () => {
  mock.restoreAll();
  syncBuiltinESMExports();
  for (const restore of restorations.reverse()) restore();
  await fsp.rm(directory, { recursive: true, force: true });
});

describe('Public API', () => {
  it('rejects missing, blank and unsafe names synchronously through both source entries', () => {
    const CommonJS = require('../src/index.cjs');
    for (const Constructor of [AutoLaunch, CommonJS]) {
      assert.throws(() => new Constructor(), /name/);
      for (const name of ['', '  ', null, '../outside', 'app\\outside', 'app\nInjected=true']) {
        assert.throws(() => new Constructor({ name, path: process.execPath }), /name/);
      }
    }
  });

  it('rejects invalid paths and option values before registration', () => {
    for (const appPath of ['', 42, 'relative/app', `${process.execPath}\0`]) {
      assert.throws(() => new AutoLaunch({ name: 'App', path: appPath }), /path/);
    }
    for (const options of [null, [], { extraArguments: 'abc' }, { extraArguments: [1] },
      { launchInBackground: 1 }, { mac: 'invalid' }, { mac: { useLaunchAgent: 'yes' } },
      { linux: { icon: 1 } }]) {
      assert.throws(() => new AutoLaunch({ name: 'App', path: process.execPath, options }), TypeError);
    }
  });

  it('requires an explicit path outside Electron and NW.js, and detects it inside Electron', () => {
    assert.throws(() => new AutoLaunch({ name: 'App' }), /give a path/);
    setProperty(process.versions, 'electron', 'test');
    const launcher = new AutoLaunch({ name: 'App' });
    assert.equal(launcher.api.appPath, process.execPath);
  });

  it('preserves caller names and copies extra arguments from either option spelling', () => {
    const extraArguments = ['--profile', 'two words'];
    const launcher = new AutoLaunch({ name: 'Chosen Name', path: process.execPath, options: { extraArguments } });
    extraArguments.push('later mutation');
    assert.equal(launcher.api.appName, 'Chosen Name');
    assert.deepEqual(launcher.api.options.extraArguments, ['--profile', 'two words']);
    const alias = new AutoLaunch({ name: 'App', path: process.execPath, options: { extraArgs: ['--flag'] } });
    assert.deepEqual(alias.api.options.extraArguments, ['--flag']);
  });

  it('returns platform results and propagates registration failures', async () => {
    const launcher = new AutoLaunch({ name: 'App', path: process.execPath });
    const failure = new Error('registration denied');
    launcher.api = { isEnabled: async () => true, enable: async () => 'enabled', disable: async () => { throw failure; } };
    assert.equal(await launcher.isEnabled(), true);
    assert.equal(await launcher.enable(), 'enabled');
    await assert.rejects(launcher.disable(), (error) => error === failure);
  });
});

describe('Linux / FreeBSD registrations', () => {
  it('creates and removes the entry in XDG_CONFIG_HOME without requiring an executable fixture', async () => {
    const api = new LinuxAPI(init());
    const entry = path.join(process.env.XDG_CONFIG_HOME, 'autostart', 'My App.desktop');
    assert.equal(await api.isEnabled(), false);
    await api.enable();
    assert.equal(await api.isEnabled(), true);
    assert.equal((await fsp.stat(entry)).isFile(), true);
    await api.disable();
    await api.disable();
    assert.equal(await api.isEnabled(), false);
  });

  it('quotes executable paths, individual arguments and literal field codes', async () => {
    const api = new LinuxAPI(init({
      appPath: '/Applications/My App$%/app',
      options: {
        launchInBackground: true,
        extraArguments: ['two words', '--label="quoted"', '%f', ''],
        linux: { icon: 'icon\nName=Injected' }
      }
    }));
    await api.enable();
    const desktop = await fsp.readFile(path.join(process.env.XDG_CONFIG_HOME, 'autostart', 'My App.desktop'), 'utf8');
    assert.equal(desktop.split('\n').find((line) => line.startsWith('Exec=')),
      String.raw`Exec="/Applications/My App\\$%%/app" "--hidden" "two words" "--label=\\"quoted\\"" "%%f" ""`);
    assert.ok(desktop.includes('Icon=icon\\nName=Injected\n'));
    assert.ok(!desktop.includes('\nName=Injected\n'));
  });

  it('ignores relative XDG_CONFIG_HOME and persists the original AppImage path', async () => {
    setEnvironment('XDG_CONFIG_HOME', 'relative/config');
    setEnvironment('APPIMAGE', '/opt/My App.AppImage');
    const api = new LinuxAPI(init({ appPath: '/tmp/mount/app' }));
    await api.enable();
    const desktop = await fsp.readFile(path.join(directory, '.config', 'autostart', 'My App.desktop'), 'utf8');
    assert.ok(desktop.includes('Exec="/opt/My App.AppImage"\n'));
  });

  it('distinguishes missing files, directories and real filesystem errors', async () => {
    assert.equal(await fileExists(directory), false);
    assert.equal(await fileExists(path.join(directory, 'missing')), false);
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    mock.method(fsp, 'stat', async () => { throw denied; });
    mock.method(fsp, 'unlink', async () => { throw denied; });
    syncBuiltinESMExports();
    await assert.rejects(fileExists('/denied'), (error) => error === denied);
    await assert.rejects(removeFile('/denied'), (error) => error === denied);
  });
});

describe('macOS registrations', () => {
  it('keeps the inner executable for Launch Agents and escapes each plist argument', async () => {
    const appPath = '/Applications/My & App.app/Contents/MacOS/Electron';
    const api = new MacAPI(init({
      appName: 'My & App', appPath,
      options: { mac: { useLaunchAgent: true }, launchInBackground: true, extraArguments: ['<one>', 'a&b', 'two words'] }
    }));
    await api.enable();
    const plist = await fsp.readFile(path.join(directory, 'Library', 'LaunchAgents', 'My & App.plist'), 'utf8');
    assert.ok(plist.includes('<string>My &amp; App</string>'));
    assert.ok(plist.includes('<string>/Applications/My &amp; App.app/Contents/MacOS/Electron</string>'));
    assert.ok(plist.includes('<string>--hidden</string>'));
    assert.ok(plist.includes('<string>&lt;one&gt;</string>\n    <string>a&amp;b</string>\n    <string>two words</string>'));
    assert.equal(api.appPath, appPath);
    assert.equal(await api.isEnabled(), true);
    await api.disable();
    assert.equal(await api.isEnabled(), false);
  });

  it('launches app bundles through open rather than executing the directory', async () => {
    const api = new MacAPI(init({ appPath: '/Applications/My App.app', options: { mac: { useLaunchAgent: true } } }));
    await api.enable();
    const plist = await fsp.readFile(path.join(directory, 'Library', 'LaunchAgents', 'My App.plist'), 'utf8');
    assert.ok(plist.includes('<string>/usr/bin/open</string>\n    <string>-a</string>\n'
      + '    <string>/Applications/My App.app</string>\n    <string>--args</string>'));
  });

  it('quotes AppleScript strings, uses the outer bundle and removes missing items idempotently', async () => {
    const commands = [];
    mock.method(applescript, 'execString', (command, callback) => {
      commands.push(command);
      callback(null, true);
    });
    const api = new MacAPI(init({
      appName: 'App "quoted"', appPath: '/Applications/My App.app/Contents/MacOS/Electron',
      options: { launchInBackground: true }
    }));
    await api.enable();
    assert.ok(commands[0].includes('path:"/Applications/My App.app", hidden:true, name:"App \\"quoted\\""'));
    assert.equal(await api.isEnabled(), true);
    await api.disable();
    assert.ok(commands[2].includes('delete (every login item whose name is "App \\"quoted\\"")'));
  });

  it('rejects unsupported Login Item arguments and propagates AppleScript failures', async () => {
    const failure = new Error('Automation permission denied');
    mock.method(applescript, 'execString', (command, callback) => callback(failure));
    await assert.rejects(new MacAPI(init({ options: { extraArguments: ['--flag'] } })).enable(), /useLaunchAgent/);
    const api = new MacAPI(init());
    await assert.rejects(api.enable(), (error) => error === failure);
    await assert.rejects(api.isEnabled(), (error) => error === failure);
    await assert.rejects(api.disable(), (error) => error === failure);
  });
});

describe('Windows registrations', () => {
  function captureCommand(api) {
    const registration = {};
    mock.method(api.regKey, 'set', (name, type, value, callback) => {
      Object.assign(registration, { name, type, value });
      callback(null);
    });
    return registration;
  }

  it('quotes the executable once and preserves spaces, quotes and trailing backslashes in arguments', async () => {
    const api = new WindowsAPI(init({
      appPath: 'C:\\Program Files\\App\\app.exe',
      options: { launchInBackground: true, extraArguments: ['two words', '--quote="yes"', 'C:\\folder\\'] }
    }));
    const registration = captureCommand(api);
    await api.enable();
    assert.equal(registration.value,
      String.raw`"C:\Program Files\App\app.exe" "--hidden" "two words" "--quote=\"yes\"" "C:\folder\\"`);
    assert.equal(registration.name, 'My App');
    assert.equal(registration.type, 'REG_SZ');
  });

  it('passes Squirrel application arguments as one nested command line', async () => {
    setProperty(process.versions, 'electron', 'test');
    mock.method(fs, 'existsSync', (filePath) => filePath === 'C:\\App\\Update.exe');
    const api = new WindowsAPI(init({
      appPath: 'C:\\App\\app-1.0\\app.exe', options: { launchInBackground: true, extraArguments: ['two words'] }
    }));
    const registration = captureCommand(api);
    await api.enable();
    assert.equal(registration.value,
      String.raw`"C:\App\Update.exe" --processStart "app.exe" --process-start-args "\"--hidden\" \"two words\""`);
    api.options.extraArguments = [];
    api.options.launchInBackground = false;
    await api.enable();
    assert.equal(registration.value, String.raw`"C:\App\Update.exe" --processStart "app.exe"`);
  });

  it('registers a Microsoft Store application through AppsFolder', async () => {
    setProperty(process, 'windowsStore', true);
    const api = new WindowsAPI(init({ appPath: 'DEV.APP!PACKAGE' }));
    const registration = captureCommand(api);
    await api.enable();
    assert.equal(registration.value, String.raw`"explorer.exe" "shell:AppsFolder\DEV.APP!PACKAGE"`);
  });

  it('resolves absent values without deleting and propagates registry failures', async () => {
    const api = new WindowsAPI(init());
    mock.method(api.regKey, 'valueExists', (name, callback) => callback(null, false));
    const remove = mock.method(api.regKey, 'remove', () => assert.fail('must not delete an absent entry'));
    assert.equal(await api.isEnabled(), false);
    await api.disable();
    assert.equal(remove.mock.callCount(), 0);
    const denied = new Error('registry access denied');
    mock.method(api.regKey, 'valueExists', (name, callback) => callback(denied));
    mock.method(api.regKey, 'set', (name, type, value, callback) => callback(denied));
    await assert.rejects(api.isEnabled(), (error) => error === denied);
    await assert.rejects(api.disable(), (error) => error === denied);
    await assert.rejects(api.enable(), (error) => error === denied);
    mock.method(api.regKey, 'valueExists', (name, callback) => callback(null, true));
    mock.method(api.regKey, 'remove', (name, callback) => callback(denied));
    await assert.rejects(api.disable(), (error) => error === denied);
  });
});

describe('Release metadata', () => {
  it('uses the release tag for manual and tag triggers and rejects mismatches', async () => {
    const manifest = JSON.parse(await fsp.readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const output = path.join(directory, 'github-output');
    const script = fileURLToPath(new URL('../scripts/release-metadata.js', import.meta.url));
    const env = { ...process.env, RELEASE_TAG: `v${manifest.version}`, GITHUB_OUTPUT: output };
    for (const ref of [
      { GITHUB_REF_TYPE: 'branch', GITHUB_REF_NAME: 'main' },
      { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: env.RELEASE_TAG }
    ]) {
      execFileSync(process.execPath, [script], { env: { ...env, ...ref }, stdio: 'pipe' });
    }
    const result = await fsp.readFile(output, 'utf8');
    assert.ok(result.includes(`tag=${env.RELEASE_TAG}\n`));
    assert.ok(result.includes(`version=${manifest.version}\n`));
    assert.ok(result.includes(`npm_tag=${manifest.version.includes('-') ? 'next' : 'latest'}\n`));
    assert.throws(() => execFileSync(process.execPath, [script], {
      env: { ...env, RELEASE_TAG: 'v0.0.0-invalid' }, stdio: 'pipe'
    }), /Release tag must match/);
    assert.throws(() => execFileSync(process.execPath, [script], {
      env: { ...env, RELEASE_TAG: '' }, stdio: 'pipe'
    }), /Release tag must match/);
  });
});
