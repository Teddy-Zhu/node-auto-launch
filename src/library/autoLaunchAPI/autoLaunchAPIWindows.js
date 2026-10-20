import fs from 'node:fs';
import path from 'node:path';
import Winreg from 'winreg';
import AutoLaunchAPI from './autoLaunchAPI.js';

function quoteArgument(argument) {
  // Windows doubles backslashes before quotes and before the closing quote.
  return `"${argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

export default class AutoLaunchAPIWindows extends AutoLaunchAPI {
  constructor(init) {
    super(init);
    this.regKey = new Winreg({
      hive: Winreg.HKCU,
      key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    });
  }

  enable() {
    const launchArguments = this.launchArguments;
    const updateDotExe = path.win32.resolve(path.win32.dirname(this.appPath), '..', 'Update.exe');
    let command;

    if (process.windowsStore) {
      command = [quoteArgument('explorer.exe'), quoteArgument(`shell:AppsFolder\\${this.appPath}`)];
      command.push(...launchArguments.map(quoteArgument));
    } else if (process.versions.electron && fs.existsSync(updateDotExe)) {
      // Squirrel must resolve the current app version through Update.exe.
      command = [quoteArgument(updateDotExe), '--processStart', quoteArgument(path.win32.basename(this.appPath))];
      if (launchArguments.length) {
        command.push('--process-start-args', quoteArgument(launchArguments.map(quoteArgument).join(' ')));
      }
    } else {
      command = [this.appPath, ...launchArguments].map(quoteArgument);
    }

    return new Promise((resolve, reject) => {
      this.regKey.set(this.appName, Winreg.REG_SZ, command.join(' '), (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async disable() {
    if (!await this.isEnabled()) return;
    await new Promise((resolve, reject) => {
      this.regKey.remove(this.appName, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  isEnabled() {
    return new Promise((resolve, reject) => {
      this.regKey.valueExists(this.appName, (error, exists) => {
        if (error) reject(error);
        else resolve(exists);
      });
    });
  }
}
