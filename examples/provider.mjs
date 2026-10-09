import { InMemoryHarnessRuntime } from '../packages/core/dist/index.js'
import { PROTOCOL_VERSION } from '../packages/protocol/dist/index.js'
import { runProviderConformance } from '../packages/conformance/dist/index.js'

const provider = {
  manifest: {
    id: 'synthetic-provider',
    name: 'Synthetic Provider',
    version: '1.0.0',
    protocolVersion: PROTOCOL_VERSION,
    topologies: ['embedded'],
    capabilities: { 'event.streaming': 'native', 'event.replay': 'emulated' },
  },
  async run(context) {
    context.signal.throwIfAborted()
    context.emit('output.text.delta', { text: 'synthetic result' })
    return { finalOutput: 'synthetic result' }
  },
}
const report = await runProviderConformance(provider)
if (!report.passed) throw new Error('Provider conformance failed')
const runtime = new InMemoryHarnessRuntime([provider])
const execution = runtime.startExecution({
  conversationId: runtime.createConversation().id,
  providerId: provider.manifest.id,
  input: 'synthetic prompt',
})
for await (const _event of runtime.subscribeEvents(execution.id)) {
}
console.log(
  JSON.stringify({
    conformancePassed: report.passed,
    state: runtime.getExecution(execution.id).state,
  }),
)
