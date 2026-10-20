# Project guidance

This repository provides `@teddyzhu/auto-launch`, a cross-platform Node.js library for registering applications at user login.

- Runtime: Node.js >=22.14.0. Development: Node.js 24 from `.nvmrc`.
- Source: native ESM under `src/`; two esbuild bundles are emitted to `dist/`.
- API: `src/index.js` validates options, `autoLaunchHandler.js` selects the platform, and `autoLaunchAPI/` contains each platform implementation.
- Windows uses `winreg`; macOS uses AppleScript Login Items or Launch Agent plists; Linux / FreeBSD use XDG desktop entries.
- Options such as `launchInBackground`, `extraArguments`, `mac` and `linux` are nested inside the constructor's `options` property.
- Use two-space indentation, `const` where possible, and explicit `.js` extensions for relative ESM imports.
- After implementation is integrated, validate with `npm run lint`, `npm test`, `npm run build` and `npm run test:package`.
- Tests must isolate filesystem changes and stub native registration commands; do not modify the current user's startup settings.
- `npm pack` builds via `prepack`. Never edit generated `dist/` files.
- `.github/workflows/ci.yaml` checks supported platforms and Node versions. `publish.yaml` publishes matching `v*` tags to npm through Trusted Publishing and creates a GitHub Release.
- Follow `CONTRIBUTING.md` for package layout and release configuration.
