import { readFile } from 'node:fs/promises'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { runtimeSchemas } from '../scripts/openapi-schemas.mjs'
import * as protocol from '../packages/protocol/src/index.js'
import { InMemoryHarnessRuntime } from '../packages/core/src/index.js'
import { MockProvider } from '../packages/provider-mock/src/index.js'
import { createApp } from '../packages/server/src/index.js'

const document = parse(await readFile(new URL('../spec/openapi.yaml', import.meta.url), 'utf8'))
// Format is an annotation in this dialect; generated patterns enforce timestamp input.
const validator = new Ajv2020({
  strict: false,
  strictNumbers: true,
  validateFormats: false,
  allErrors: true,
})
validator.addSchema({ $id: 'https://runtime.test/openapi', components: document.components })
const validate = (name: string) =>
  validator.compile({ $ref: `https://runtime.test/openapi#/components/schemas/${name}` })

describe('OpenAPI projection of the executable portable contract', () => {
  it('keeps every generated component synchronized with its Zod source', () => {
    expect(document.components.schemas).toEqual(runtimeSchemas())
  })

  it.each([
    {
      name: 'StartExecutionRequest',
      schema: protocol.StartExecutionRequestSchema,
      base: { conversationId: 'conv_fixture', providerId: 'mock', input: 'synthetic' },
      variants: [
        { conversationId: '' },
        { providerId: '' },
        { idempotencyKey: '' },
        { idempotencyKey: 'x'.repeat(201) },
        { requiredCapabilities: [''] },
        { config: { nested: [1, null, true] } },
      ],
    },
    {
      name: 'ProviderManifest',
      schema: protocol.ProviderManifestSchema,
      base: {
        id: 'fixture',
        name: 'Fixture',
        version: '1',
        protocolVersion: protocol.PROTOCOL_VERSION,
        topologies: ['embedded'],
        capabilities: {},
      },
      variants: [
        { id: '' },
        { topologies: [] },
        { capabilities: { '': 'native' } },
        { capabilities: { 'event.streaming': 'unknown' } },
        { protocolVersion: 'wrong-version' },
      ],
    },
    {
      name: 'RuntimeEvent',
      schema: protocol.RuntimeEventSchema,
      base: {
        id: 'exec_fixture:1',
        executionId: 'exec_fixture',
        sequence: 1,
        type: 'run.queued',
        time: '2026-10-09T00:00:00.000Z',
        data: {},
      },
      variants: [
        { id: '' },
        { sequence: 0 },
        { sequence: 1.5 },
        { sequence: Number.MAX_SAFE_INTEGER + 1 },
        { time: '2026-02-30T00:00:00Z' },
        { time: '2026-10-09T00:00:00+08:00' },
        { time: '2026-10-09T00:00Z' },
        { type: 'unknown' },
        { data: { invalid: Number.POSITIVE_INFINITY } },
      ],
    },
    {
      name: 'CancelExecutionRequest',
      schema: protocol.CancelExecutionRequestSchema,
      base: {},
      variants: [
        { reason: '' },
        { reason: 'x'.repeat(501) },
        { reason: 42 },
        { reason: 'synthetic reason' },
      ],
    },
  ])(
    'matches independent JSON Schema validation for $name boundary samples',
    ({ name, schema, base, variants }) => {
      const check = validate(name)
      for (const sample of [base, ...variants.map((variant) => ({ ...base, ...variant }))]) {
        expect(check(sample)).toBe(schema.safeParse(sample).success)
      }
    },
  )

  it('validates actual HTTP response payloads against the published schemas', async () => {
    const app = createApp(new InMemoryHarnessRuntime([new MockProvider()]))
    const conversation = await (await app.request('/v1/conversations', { method: 'POST' })).json()
    const execution = await (
      await app.request('/v1/executions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          providerId: 'mock',
          input: 'synthetic parity',
          config: { artifactName: 'synthetic.txt' },
        }),
      })
    ).json()
    const stream = await app.request(`/v1/executions/${execution.id}/events`, {
      headers: { accept: 'text/event-stream' },
    })
    const reader = stream.body?.getReader()
    if (!reader) throw new Error('Expected an event stream')
    try {
      while (!(await reader.read()).done) {}
    } finally {
      reader.releaseLock()
    }
    for (const [name, path] of [
      ['RuntimeDescription', '/v1/runtime'],
      ['Conversation', `/v1/conversations/${conversation.id}`],
      ['Execution', `/v1/executions/${execution.id}`],
      ['EventList', `/v1/executions/${execution.id}/events`],
      ['ArtifactList', `/v1/executions/${execution.id}/artifacts`],
    ]) {
      const payload = await (await app.request(path as string)).json()
      expect(validate(name as string)(payload)).toBe(true)
    }
  })
})
