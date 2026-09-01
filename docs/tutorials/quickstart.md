# Quickstart

Start the reference server:

```bash
pnpm install
pnpm dev
```

Create a conversation:

```bash
conversation_id=$(curl -s -X POST http://127.0.0.1:4310/v1/conversations \
  -H 'content-type: application/json' \
  -d '{"metadata":{"source":"quickstart"}}' | node -pe \
  'JSON.parse(require("fs").readFileSync(0, "utf8")).id')
```

Start an execution:

```bash
execution_id=$(curl -s -X POST http://127.0.0.1:4310/v1/executions \
  -H 'content-type: application/json' \
  -d "{\"conversationId\":\"$conversation_id\",\"providerId\":\"mock\",\"input\":\"hello runtime\",\"idempotencyKey\":\"quickstart-1\"}" | node -pe \
  'JSON.parse(require("fs").readFileSync(0, "utf8")).id')
```

Follow the event stream:

```bash
curl -N -H 'accept: text/event-stream' \
  "http://127.0.0.1:4310/v1/executions/$execution_id/events?after=0"
```

List artifact descriptors emitted by the execution:

```bash
curl -s "http://127.0.0.1:4310/v1/executions/$execution_id/artifacts"
```

The default Mock execution emits an artifact only when its config contains `artifactName`. See the
[Artifact guide](../guides/artifacts.md) for the provider contract and content-storage boundary.

To exercise approval, add `"config":{"requireApproval":true}` to the execution request, read the
action ID from `action.required.data.id`, and respond:

```bash
curl -s -X POST \
  "http://127.0.0.1:4310/v1/executions/$execution_id/actions/$action_id:respond" \
  -H 'content-type: application/json' \
  -d '{"approved":true}'
```
