# Development

Use Node.js 24 (`nvm use`) and install the locked dependencies:

```sh
npm ci
```

Source code uses native JavaScript ES modules. No Babel, CoffeeScript or Gulp compilation is required.

`winreg` remains pinned to 1.2.4: version 1.2.5 invokes registry writes with `shell: true`, which changes command quoting and allows shell interpretation of application names and arguments. Do not update it without addressing that behavior and checking native Windows registration.

npm 12 requires approval for dependency install scripts. `allowScripts` approves the locked esbuild version; review and update that approval with `npm approve-scripts esbuild` when changing esbuild versions.

After completing changes, run the checks together:

```sh
npm run lint
npm test
npm run build
npm run test:package
```

Tests isolate file registrations in temporary directories and stub native Windows / AppleScript operations. They do not launch applications or change the real user's login settings. Native platform behavior still requires testing on the corresponding operating system.

# Build and package

`npm run build` clears `dist` and uses esbuild to produce:

- `dist/index.js`: ESM bundle.
- `dist/index.cjs`: CommonJS bundle exporting the constructor directly.
- Matching `.map` files with embedded source content for debugging.

Node built-ins and runtime dependencies remain external. Both bundles target Node.js 22.14.0. Package exports point to these files; source files, test fixtures and development configuration are excluded from the npm archive. The published package contains `dist/`, `package.json`, `README.md` and `LICENSE.md`.

`npm pack` automatically builds through `prepack`. `npm run test:package` checks the existing build, package contents and both public module entry points without rebuilding it.

# Automated releases

Run CI manually from GitHub Actions using **Run workflow**. Branch pushes and pull requests do not trigger it. It checks Linux, macOS and Windows with Node.js 22, 24 and 26. The release workflow invokes the same CI before publishing a version tag.

Configure the package's **Settings → Trusted Publisher → GitHub Actions** on npmjs.com once:

| Field | Value |
| --- | --- |
| Organization or user | `Teddy-Zhu` |
| Repository | `node-auto-launch` |
| Workflow filename | `publish.yaml` |
| Environment name | Leave empty; the workflow does not select an environment. |
| Allowed actions | Enable direct publishing with `npm publish`. |

The npm package must already exist and you must have permission to manage it. For a new package, publish the initial version manually before configuring its trusted publisher. See the [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/) for current requirements.

The workflow uses GitHub-hosted runners, Node.js 24, npm 12 and `id-token: write`. npm authenticates with OIDC and generates provenance automatically. No `NPM_TOKEN`, `NODE_AUTH_TOKEN` or `NPM_REGISTRY_KEY` secret is required. GitHub Release creation uses the workflow's `GITHUB_TOKEN`; repository policy must allow its `contents: write` permission.

To release:

1. Update `package.json` and `package-lock.json` to the intended version, for example with `npm version 6.0.0-rc.11 --no-git-tag-version`.
2. Commit the change and push it to GitHub.
3. Create and push the matching version tag, for example `git tag v6.0.0-rc.11` followed by `git push origin v6.0.0-rc.11`.

Pushing the tag starts Release automatically. To start it manually for an existing tag, open **Actions → Release → Run workflow**, select the branch containing this workflow, and enter the version tag in **tag**, for example `v6.0.1`. The tag must include the current release scripts. Validation, CI and packaging all use the tagged commit. The workflow must be pushed to the repository's default branch before the manual entry is available; see [GitHub's manual workflow documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The tag must exactly match `v` plus the manifest version; a stale lockfile or mismatched tag stops the workflow. Stable versions publish to npm's `latest` tag. Prereleases publish to `next` and create a prerelease on GitHub. After CI passes, `npm pack` builds one archive, which is saved as a workflow artifact, published to npm and attached unchanged to the GitHub Release. Creating a GitHub Release manually does not publish to npm.

If GitHub Release creation fails after npm publication, rerun only the failed release job; published npm versions cannot be overwritten.
