import pathTools from 'node:path';
import autoLaunchHandler from './library/autoLaunchHandler.js';

export default class AutoLaunch {
  constructor({ name, path, options = {} } = {}) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('You must specify a name');
    }
    // The name is also used as a filename on Linux and macOS.
    if (/[/\\]/.test(name)
      || [...name].some((character) => character.charCodeAt(0) < 32 || character === '\u007f')) {
      throw new TypeError('name must not contain path separators or control characters');
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('options must be an object');
    }

    const launchInBackground = options.launchInBackground ?? false;
    const extraArguments = options.extraArguments ?? options.extraArgs ?? [];
    const mac = options.mac ?? {};
    const linux = options.linux ?? {};
    if (typeof launchInBackground !== 'boolean' && typeof launchInBackground !== 'string') {
      throw new TypeError('launchInBackground must be a boolean or a string');
    }
    if (typeof launchInBackground === 'string' && launchInBackground.includes('\0')) {
      throw new TypeError('launchInBackground must not contain null bytes');
    }
    if (!Array.isArray(extraArguments)
      || extraArguments.some((argument) => typeof argument !== 'string' || argument.includes('\0'))) {
      throw new TypeError('extraArguments must be an array of strings without null bytes');
    }
    for (const [key, value] of Object.entries({ mac, linux })) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${key} options must be an object`);
      }
    }
    if (mac.useLaunchAgent != null && typeof mac.useLaunchAgent !== 'boolean') {
      throw new TypeError('mac.useLaunchAgent must be a boolean');
    }
    if (linux.icon != null && (typeof linux.icon !== 'string' || linux.icon.includes('\0'))) {
      throw new TypeError('linux.icon must be a string without null bytes');
    }

    const opts = {
      appName: name,
      options: {
        launchInBackground,
        mac: { ...mac },
        linux: { ...linux },
        extraArguments: [...extraArguments]
      }
    };

    const versions = process.versions;
    if (path != null) {
      if (typeof path !== 'string' || !path || path.includes('\0')) {
        throw new TypeError('path must be a non-empty string without null bytes');
      }
      if ((!pathTools.isAbsolute(path)) && !process.windowsStore) {
        throw new Error('path must be absolute');
      }
      opts.appPath = path;
    } else if (
      versions.nw != null || versions['node-webkit'] != null || versions.electron != null) {
      opts.appPath = process.execPath;
    } else {
      throw new Error('You must give a path (this is only auto-detected for NW.js and Electron apps)');
    }

    this.api = autoLaunchHandler(opts);
  }

  enable() {
    return this.api.enable();
  }

  disable() {
    return this.api.disable();
  }

  isEnabled() {
    return this.api.isEnabled();
  }
}
