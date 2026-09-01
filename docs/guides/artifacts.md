# Artifact Descriptors

Status: current

Protocol version: `2026-09-01`

## Contract

Harness Runtime API treats an artifact as a portable descriptor, not as file content. A successful
descriptor contains:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Provider-selected identity, unique within one execution |
| `executionId` | yes | Owning portable execution, assigned by the runtime |
| `name` | yes | Human-readable artifact name |
| `mediaType` | yes | Content media type such as `text/plain` |
| `createdAt` | yes | Runtime acceptance time |
| `uri` | no | Deployment-owned content reference |
| `metadata` | yes | Portable JSON metadata; defaults to an empty object |

The runtime validates each provider emission, rejects duplicate IDs, appends one
`artifact.created` event, and exposes descriptors in creation order:

```http
GET /v1/executions/{executionId}/artifacts
```

```json
{
  "artifacts": [
    {
      "id": "artifact-example",
      "executionId": "exec-example",
      "name": "analysis.txt",
      "mediaType": "text/plain",
      "uri": "artifact://example/analysis.txt",
      "createdAt": "2026-09-01T00:00:00.000Z",
      "metadata": {}
    }
  ]
}
```

## Provider Emission

A provider emits the input portion of the descriptor. The runtime owns `executionId`, `createdAt`,
event ordering, and list storage.

```ts
context.emit('artifact.created', {
  id: `artifact-${context.executionId}`,
  name: 'analysis.txt',
  mediaType: 'text/plain',
  uri: 'artifact://example/analysis.txt',
  metadata: { kind: 'analysis' },
})
```

An invalid descriptor fails the execution as a provider error. Providers should finish writing
content before emitting the descriptor so consumers do not observe a reference to incomplete data.

## Content Boundary

![Artifact data flow: the runtime validates, records, and lists descriptors while bytes remain in a deployment-owned store.](../../assets/artifact-data-flow-en.png)

The reference runtime does not upload, download, proxy, sign, or retain artifact bytes. A deployment
owns:

- the Artifact Store and retention policy;
- URI resolution and tenant authorization;
- malware scanning, size limits, and content integrity;
- download auditing and credential redaction.

Consumers must not assume that a URI is public, permanent, or safe to fetch. Deployments may use
opaque URIs and exchange them for short-lived authorized download URLs outside this protocol.

## Provider Support

The Mock Provider advertises `artifact.list` as `emulated` and can emit a synthetic descriptor with
the `artifactName` config option. The DSH adapter advertises it as `unsupported` until its pinned SDK
compatibility range exposes a provider event that can be mapped without inventing semantics.
