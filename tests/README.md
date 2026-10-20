# Tests

`npm test` runs Mocha tests using Node's assertions and mocks. Tests cover option validation, platform command / file generation, registration lifecycle, error propagation and release metadata. Files are isolated in temporary directories; native AppleScript and registry operations are stubbed. No executable fixtures or real startup registrations are needed.

After `npm run build`, run `npm run test:package` to pack the existing build, check archive contents, install it into a temporary consumer project and verify both public ESM and CommonJS imports. It installs runtime dependencies from npm and cleans up the temporary project afterwards.

These checks do not verify actual login behavior on macOS, Windows or individual desktop environments.
