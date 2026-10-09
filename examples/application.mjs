import assert from 'node:assert/strict'
import { HarnessRuntimeClient } from '../packages/sdk-typescript/dist/index.js'

const client = new HarnessRuntimeClient({
  baseUrl: process.env.RUNTIME_URL ?? 'http://127.0.0.1:4310',
})
const conversation = await client.createConversation({
  metadata: { source: 'application-example' },
})
const execution = await client.startExecution({
  conversationId: conversation.id,
  providerId: 'mock',
  input: 'synthetic example',
  idempotencyKey: 'application-example',
  requiredCapabilities: ['action.approval', 'artifact.list'],
  config: { requireApproval: true, artifactName: 'example.txt' },
})
let cursor = 0
for await (const event of client.streamEvents(execution.id, {
  signal: AbortSignal.timeout(5_000),
})) {
  cursor = event.sequence
  if (event.type === 'action.required') {
    await client.respondAction(execution.id, String(event.data.id), { approved: true })
  }
}
const final = await client.waitForTerminal(execution.id, AbortSignal.timeout(5_000))
const artifacts = await client.listArtifacts(execution.id)
const replay = await client.listEvents(execution.id, cursor - 1)
assert.equal(final.state, 'succeeded')
assert.equal(artifacts.artifacts.length, 1)
assert.equal(replay.events.at(-1)?.type, 'run.completed')
console.log(
  JSON.stringify({
    state: final.state,
    eventCount: cursor,
    artifactCount: artifacts.artifacts.length,
  }),
)
