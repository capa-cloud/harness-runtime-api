import { ExecutionAbortedError, type HarnessProvider } from '@harness-runtime/core'
import {
  PROTOCOL_VERSION,
  type ProviderManifest,
  StandardCapability,
} from '@harness-runtime/protocol'

const manifest: ProviderManifest = {
  id: 'mock',
  name: 'Deterministic Mock Provider',
  version: '0.1.0',
  protocolVersion: PROTOCOL_VERSION,
  topologies: ['embedded'],
  capabilities: {
    [StandardCapability.actionApproval]: 'native',
    [StandardCapability.actionInput]: 'native',
    [StandardCapability.artifacts]: 'emulated',
    [StandardCapability.cancellation]: 'native',
    [StandardCapability.conversationContinuity]: 'emulated',
    [StandardCapability.eventReplay]: 'native',
    [StandardCapability.eventStreaming]: 'native',
  },
}

export class MockProvider implements HarnessProvider {
  readonly manifest = manifest

  async run(context: Parameters<HarnessProvider['run']>[0]): Promise<{ finalOutput: string }> {
    const prefix = stringConfig(context.config.prefix) ?? 'Echo: '
    const delayMs = numberConfig(context.config.delayMs) ?? 2
    let suffix = ''

    if (context.config.requireApproval === true) {
      const response = await context.requestAction({
        kind: 'approval',
        title: 'Approve mock execution',
        description: 'Synthetic approval used by the reference provider.',
      })
      if (response.approved !== true) throw new Error('Mock execution was not approved')
    }

    if (context.config.requestInput === true) {
      const response = await context.requestAction({
        kind: 'input',
        title: 'Provide mock input',
      })
      if (typeof response.value === 'string') suffix = ` ${response.value}`
    }

    const output = `${prefix}${context.input}${suffix}`
    for (const chunk of chunks(output)) {
      await sleep(delayMs, context.signal)
      context.emit('output.text.delta', { text: chunk })
    }

    const artifactName = stringConfig(context.config.artifactName)
    if (artifactName) {
      context.emit('artifact.created', {
        id: `artifact-${context.executionId}`,
        name: artifactName,
        mediaType: 'text/plain',
      })
    }

    return { finalOutput: output }
  }
}

function chunks(value: string): string[] {
  return value.match(/\S+\s*/g) ?? (value === '' ? [] : [value])
}

function stringConfig(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberConfig(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ExecutionAbortedError())
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new ExecutionAbortedError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
