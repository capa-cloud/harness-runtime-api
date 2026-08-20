# Mock Provider

A deterministic provider for development, examples, and conformance tests.

Supported config fields:

- `prefix`: text prepended to the echoed input
- `delayMs`: delay between text chunks
- `requireApproval`: request approval before emitting output
- `requestInput`: request a text value and append it to the output
- `artifactName`: emit one synthetic artifact descriptor
