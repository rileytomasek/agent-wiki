# QMD snapshot for Agent Wiki

`@rileytomasek/qmd-snapshot` is an unofficial prebuilt distribution of
[Tobi Lutke's QMD](https://github.com/tobi/qmd), maintained only to make Agent
Wiki's metadata-capable QMD dependency installable through npm and Bun.

Version `2.8.3-snapshot.04e4dbd.0` contains upstream commit
[`04e4dbd8245c527a88f1a8f0bda547aef9ca81fb`](https://github.com/tobi/qmd/tree/04e4dbd8245c527a88f1a8f0bda547aef9ca81fb).
The official npm `@tobilu/qmd@2.8.3` release predates this commit's metadata API.
The runtime implementation is unchanged. The source archive checksum and full
commit are recorded in `UPSTREAM.json` inside the package.

The snapshot ships compiled JavaScript, declarations, runtime resources, and
QMD's CLI. It preserves upstream runtime dependencies and MIT license. Native
dependencies install for the consumer's platform; models are downloaded when
needed. It does not bundle a machine's `node_modules`, models, indexes, or data.

Packaging removes source-build scripts, development dependencies, and the
build-only TypeScript peer dependency. The CLI build stamp identifies the
verified source commit. The snapshot is built from the checksum-verified source
archive using upstream's frozen Bun lockfile and TypeScript toolchain.

Agent Wiki uses an exact npm alias to this package internally. Applications
should install `@rileytomasek/agent-wiki`. This snapshot is a temporary bridge:
Agent Wiki will return to an official QMD release after its metadata API and
supported runtimes pass the integration checks.
