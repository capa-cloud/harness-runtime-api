# Releasing

This repository is pre-1.0. A release freezes both a runtime version and the current dated protocol
version.

## Preflight

1. Confirm `main` is clean and synchronized with `origin/main`.
2. Review `CHANGELOG.md`, `README.md`, `README.zh-CN.md`, and `spec/README.md`.
3. Run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm sanitize
pnpm audit --prod --audit-level high
```

4. Start the built reference server and verify runtime description, execution, SSE replay, approval,
   cancellation, capability rejection, and Artifact listing.
5. Confirm generated images and release notes contain no private identifiers or credentials.

## Versioning

- Runtime and package versions use Semantic Versioning.
- Portable schema or semantic changes update `PROTOCOL_VERSION` to the release date.
- Provider compatibility changes must update the manifest and provider guide.
- Pre-1.0 breaking changes require explicit migration notes in `CHANGELOG.md`.

## GitHub Release

After the exact tag and commit SHA are approved:

1. create an annotated `vX.Y.Z` tag at the reviewed commit;
2. push the immutable tag;
3. create a GitHub Release from the matching Changelog section;
4. read back the tag SHA, release assets, and release notes;
5. do not publish workspace packages unless package publication is separately approved and configured.

Creating a tag or GitHub Release is a separate remote write and is never implied by passing tests.
