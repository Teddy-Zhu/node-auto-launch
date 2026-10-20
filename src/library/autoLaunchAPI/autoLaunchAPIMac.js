import applescript from 'applescript';
import { homedir } from 'node:os';
import path from 'node:path';
import * as fileBasedUtilities from '../fileBasedUtilities.js';
import AutoLaunchAPI from './autoLaunchAPI.js';

function escapeXML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character]);
}

function quoteAppleScript(value) {
  return `"${value.replace(/[\\"\n\r\t]/g, (character) => ({
    '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t'
  })[character])}"`;
}

export default class AutoLaunchAPIMac extends AutoLaunchAPI {
  constructor(init) {
    super(init);
    // Login Items use the outer bundle; Launch Agents need the actual executable.
    if (!this.options.mac.useLaunchAgent) {
      this.appPath = this.appPath.replace(/(\.app)\/Contents\/.*$/, '$1');
    }
  }

  enable() {
    if (this.options.mac.useLaunchAgent) {
      const programArguments = this.appPath.endsWith('.app')
        ? ['/usr/bin/open', '-a', this.appPath, '--args', ...this.launchArguments]
        : [this.appPath, ...this.launchArguments];
      const plistData = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>Label</key>
<string>${escapeXML(this.appName)}</string>
<key>ProgramArguments</key>
<array>
${programArguments.map((argument) => `    <string>${escapeXML(argument)}</string>`).join('\n')}
</array>
<key>RunAtLoad</key>
<true/>
</dict>
</plist>
`;
      return fileBasedUtilities.createFile({
        directory: this.#getLaunchAgentsDirectory(),
        filePath: this.#getPlistFilePath(),
        data: plistData
      });
    }

    if (this.options.extraArguments.length) {
      return Promise.reject(new Error('Login Items do not support extraArguments; use mac.useLaunchAgent'));
    }
    const properties = `{path:${quoteAppleScript(this.appPath)}, `
      + `hidden:${Boolean(this.options.launchInBackground)}, name:${quoteAppleScript(this.appName)}}`;
    return this.#execApplescriptCommand(`make login item at end with properties ${properties}`);
  }

  disable() {
    if (this.options.mac.useLaunchAgent) {
      return fileBasedUtilities.removeFile(this.#getPlistFilePath());
    }
    return this.#execApplescriptCommand(`delete (every login item whose name is ${quoteAppleScript(this.appName)})`);
  }

  isEnabled() {
    if (this.options.mac.useLaunchAgent) {
      return fileBasedUtilities.fileExists(this.#getPlistFilePath());
    }
    return this.#execApplescriptCommand(`exists login item ${quoteAppleScript(this.appName)}`);
  }

  #execApplescriptCommand(commandSuffix) {
    return new Promise((resolve, reject) => {
      applescript.execString(`tell application "System Events" to ${commandSuffix}`, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  #getLaunchAgentsDirectory() {
    return path.join(homedir(), 'Library', 'LaunchAgents');
  }

  #getPlistFilePath() {
    return path.join(this.#getLaunchAgentsDirectory(), `${this.appName}.plist`);
  }
}
