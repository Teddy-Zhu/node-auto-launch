# @teddyzhu/auto-launch

[![npm](https://img.shields.io/npm/v/@teddyzhu/auto-launch)](https://www.npmjs.com/package/@teddyzhu/auto-launch)
[![CI](https://github.com/Teddy-Zhu/node-auto-launch/actions/workflows/ci.yaml/badge.svg)](https://github.com/Teddy-Zhu/node-auto-launch/actions/workflows/ci.yaml)

Launch applications at user login on Windows, macOS, Linux and FreeBSD. This registers a user login startup entry; it does not install a system boot service.

Requires **Node.js 22.14.0 or later**, including the Node.js runtime embedded in Electron or NW.js.

## Installation

```sh
npm install @teddyzhu/auto-launch
```

## Usage

```js
import AutoLaunch from '@teddyzhu/auto-launch';

const launcher = new AutoLaunch({
  name: 'My App',
  path: '/absolute/path/to/my-app',
  options: {
    launchInBackground: true,
    extraArguments: ['--profile', 'work profile'],
    mac: { useLaunchAgent: true },
    linux: { icon: 'my-app' }
  }
});

if (!await launcher.isEnabled()) {
  await launcher.enable();
}

// await launcher.disable();
```

CommonJS is also supported, with the same constructor and Promise-based methods:

```js
const AutoLaunch = require('@teddyzhu/auto-launch');
```

## API

`new AutoLaunch({ name, path, options })` validates its arguments synchronously.

| Property | Type | Behavior |
| --- | --- | --- |
| `name` | string | Required, nonblank name. Path separators and control characters are not allowed. |
| `path` | string | Absolute application or executable path. Defaults to `process.execPath` only in Electron or NW.js. |
| `options.launchInBackground` | boolean or string | Defaults to `false`. `true` passes `--hidden`; a string specifies a custom argument. AppleScript Login Items use only the hidden flag. |
| `options.extraArguments` | string[] | Additional arguments, preserved as separate arguments. Defaults to `[]`. `options.extraArgs` is also accepted. |
| `options.mac.useLaunchAgent` | boolean | Defaults to `false` (AppleScript Login Item). Set to `true` to use a Launch Agent and pass extra arguments. |
| `options.linux.icon` | string | Desktop icon name or absolute icon path. Defaults to `name`. |

`enable()`, `disable()` and `isEnabled()` return Promises. `isEnabled()` resolves to a boolean indicating whether the registration exists. The operating system or desktop environment may independently restrict startup execution. Errors from registration operations reject their Promises.

## Platform behavior

### Linux / FreeBSD

Writes a `.desktop` file under `$XDG_CONFIG_HOME/autostart`, or `~/.config/autostart` when that variable is unset or is not absolute. Paths and arguments are escaped according to the [Desktop Entry specification](https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html). AppImage applications use the `APPIMAGE` environment variable to avoid persisting a temporary mount path. Requires a desktop session that implements XDG autostart.

### macOS

By default, AppleScript asks System Events to manage a Login Item. macOS may request Automation permission. Login Items cannot carry extra arguments; use `options.mac.useLaunchAgent` when arguments are needed.

Launch Agents use `~/Library/LaunchAgents/<name>.plist`. Pass an executable path to launch it directly; `.app` bundles are launched with `/usr/bin/open`. Registration takes effect at the next login. These mechanisms are not a sandboxed Mac App Store integration. Native applications requiring modern macOS service management should use [SMAppService](https://developer.apple.com/documentation/servicemanagement/smappservice) or their framework's corresponding API.

The supplied `name` is now used consistently on all platforms. Older versions derived macOS registration names from the executable filename. Disable those entries with the previous version before upgrading, if applicable.

### Windows

Stores a command under `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`. Electron applications installed using Squirrel.Windows use the adjacent `Update.exe` so startup follows application updates.

For Microsoft Store applications (`process.windowsStore`), pass the application identity, such as `DEV_ID.APP_ID!PACKAGE_NAME`, as `path`. It is launched through `explorer.exe` and `shell:AppsFolder`.

Uninstallers should call `disable()` to remove the startup registration.

## Development and releases

See [CONTRIBUTING.md](CONTRIBUTING.md) for build outputs, validation and GitHub Actions / npm Trusted Publisher setup.
