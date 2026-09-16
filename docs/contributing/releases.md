# npm releases

## Packages and ownership

- `@rileytomasek/agent-wiki` contains the library and `wiki` CLI. The first
  public version is `0.1.0`, licensed under MIT.
- `@rileytomasek/qmd-snapshot` is the temporary prebuilt upstream dependency.
  Its exact prerelease version and source/checksum live in
  `scripts/qmd-release.ts`. Read the [snapshot description](qmd-snapshot.md).

Both packages are public. The GitHub repository can remain private; npm users
download built artifacts and ordinary registry dependencies. Package allowlists
exclude personal context, source corpora, indexes, models, credentials, and
development tooling. Native dependencies install for the target platform.
Agent Wiki's published manifest omits development dependencies and scripts,
including `prepare`, so packing/installing it cannot invoke repository hooks.

## Verification

```sh
mise install --locked
mise exec -- bun ci
mise exec -- bun run check
mise exec -- bun run test:tooling
mise exec -- bun run test:hooks
mise exec -- bun run test:qmd:models
```

`check` includes fresh npm and isolated Bun consumers, public declaration
compilation with `skipLibCheck: false`, all eight CLI commands, metadata filters,
and the move/index/search lifecycle. CI covers Linux/macOS and the supported
minimum/development Node versions. Bun library execution is verified with Bun
1.4.2. Model verification also runs embeddings and native hybrid search in fresh
npm and Bun consumers; the roughly 2.1 GB model cache is reusable.

To build and verify a new QMD snapshot before it exists in the registry:

```sh
mise exec -- bun run pack:qmd
mise exec -- bun run build
export QMD_SNAPSHOT="$PWD/.cache/release/qmd/rileytomasek-qmd-snapshot-2.8.3-snapshot.04e4dbd.0.tgz"
mise exec -- bun run test:package
mise exec -- bun run test:package:bun
mise exec -- bun run test:qmd:models
unset QMD_SNAPSHOT
```

The override changes only a temporary consumer tarball. `pack:release` refuses
the override so a local file dependency cannot enter a public Agent Wiki release.
The snapshot builder verifies the archive checksum before extracting/building it,
uses upstream's frozen dependencies and compiler, preserves runtime resources and
the MIT notice, and strips build-only requirements. It never packages an existing
machine's dependencies or modifies upstream runtime source.

## First publication and npm authentication

New npm packages need a first authenticated publication before trusted publisher
settings are available. Use `npm login --auth-type=web --scope=@rileytomasek` and
verify `npm whoami` is `rileytomasek`. Complete any npm security-key verification
in the browser. Do not commit credentials or create a long-lived CI write token.

Publish the verified QMD artifact first, then install its exact registry version,
regenerate `bun.lock`, and verify the complete Agent Wiki release. The first-party
snapshot alone is exempt from the repository's 48-hour dependency release age;
its upstream source remains checksum-pinned and all third-party dependencies
retain the age requirement.

```sh
npm publish .cache/release/qmd/rileytomasek-qmd-snapshot-2.8.3-snapshot.04e4dbd.0.tgz --ignore-scripts --access public --tag snapshot
mise exec -- bun install
mise exec -- bun run check
mise exec -- bun run pack:release
npm publish .cache/release/agent-wiki/rileytomasek-agent-wiki-0.1.0.tgz --ignore-scripts --access public
```

After each package exists, configure its trusted publisher with npm 11.15+:

```sh
npm trust github @rileytomasek/agent-wiki --repository rileytomasek/agent-wiki --file publish.yml --allow-publish --yes
npm trust github @rileytomasek/qmd-snapshot --repository rileytomasek/agent-wiki --file qmd-snapshot.yml --allow-publish --yes
npm trust list @rileytomasek/agent-wiki
npm trust list @rileytomasek/qmd-snapshot
```

These identities grant only the named GitHub Actions workflows permission to
publish their respective packages. GitHub-hosted jobs use short-lived OIDC
credentials. npm does not generate provenance attestations for a private source
repository, even when the package is public. See
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Subsequent releases

1. Update `package.json` and `src/version.ts` together, regenerate the lockfile,
   and complete the verification above in a PR. Follow semantic versioning;
   public API changes may need a minor version while the package is below 1.0.
2. Merge passing changes. Tag that merged commit `v<package version>` and push
   the tag. `publish.yml` reruns the shared CI matrix, checks that the tag matches
   the manifest and belongs to `master`, builds the tarball, and publishes it.
3. Verify the exact registry version with both package managers:

   ```sh
   AGENT_WIKI_PACKAGE=registry mise exec -- bun run test:package
   AGENT_WIKI_PACKAGE=registry mise exec -- bun run test:package:bun
   ```

Publication retries compare the registry's SHA-512 integrity with the local
artifact. An identical published version is a successful no-op; a different
artifact under the same version is an error requiring a new version. Registry
failures are not treated as absence. Record the release tag, package links, and
checks in the issue/PR rather than a second local status file.

The manual `qmd-snapshot.yml` workflow rebuilds the pinned snapshot and verifies
it through fresh npm/Bun Agent Wiki consumers before publishing. For a new
snapshot, publish and verify it before switching Agent Wiki's dependency/lock;
the workflow can use the previous released dependency while testing the new
snapshot through `QMD_SNAPSHOT`. Run the separate model proof for each new pin.

Once an official QMD release includes the required metadata API, follow the
[QMD integration contract](../design/references/qmd-integration.md) to replace
the alias, update the development CLI pin, and retire snapshot publishing.
