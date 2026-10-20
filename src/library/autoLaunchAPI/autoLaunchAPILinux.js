import { homedir } from 'node:os';
import path from 'node:path';
import * as fileBasedUtilities from '../fileBasedUtilities.js';
import AutoLaunchAPI from './autoLaunchAPI.js';

export default class AutoLaunchAPILinux extends AutoLaunchAPI {
  constructor(init) {
    super(init);
    // AppImage mount paths change between launches; persist the original image path.
    this.appPath = process.env.APPIMAGE || this.appPath;
  }

  enable() {
    const { escapeDesktopValue, escapeFilePath } = fileBasedUtilities;
    const desktop = [
      '[Desktop Entry]',
      'Type=Application',
      `Name=${escapeDesktopValue(this.appName)}`,
      `Comment=${escapeDesktopValue(`${this.appName} startup script`)}`,
      `Exec=${[this.appPath, ...this.launchArguments].map(escapeFilePath).join(' ')}`,
      `Icon=${escapeDesktopValue(this.options.linux.icon || this.appName)}`,
      'StartupNotify=false',
      'Terminal=false',
      ''
    ].join('\n');

    return fileBasedUtilities.createFile({
      directory: this.#getAutostartDirectory(),
      filePath: this.#getDesktopFilePath(),
      data: desktop
    });
  }

  disable() {
    return fileBasedUtilities.removeFile(this.#getDesktopFilePath());
  }

  isEnabled() {
    return fileBasedUtilities.fileExists(this.#getDesktopFilePath());
  }

  #getAutostartDirectory() {
    const configHome = process.env.XDG_CONFIG_HOME;
    const directory = configHome && path.isAbsolute(configHome) ? configHome : path.join(homedir(), '.config');
    return path.join(directory, 'autostart');
  }

  #getDesktopFilePath() {
    return path.join(this.#getAutostartDirectory(), `${this.appName}.desktop`);
  }
}
