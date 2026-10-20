import AutoLaunchAPILinux from './autoLaunchAPI/autoLaunchAPILinux.js';
import AutoLaunchAPIMac from './autoLaunchAPI/autoLaunchAPIMac.js';
import AutoLaunchAPIWindows from './autoLaunchAPI/autoLaunchAPIWindows.js';

export default function autoLaunchHandler(options) {
  switch (process.platform) {
    case 'win32':
      return new AutoLaunchAPIWindows(options);
    case 'darwin':
      return new AutoLaunchAPIMac(options);
    case 'linux':
    case 'freebsd':
      return new AutoLaunchAPILinux(options);
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
