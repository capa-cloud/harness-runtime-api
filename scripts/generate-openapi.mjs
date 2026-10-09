import { readFile, writeFile } from 'node:fs/promises'
import { parse, stringify } from 'yaml'
import { runtimeSchemas } from './openapi-schemas.mjs'

const file = new URL('../spec/openapi.yaml', import.meta.url)
const document = parse(await readFile(file, 'utf8'))
document.components.schemas = runtimeSchemas()
document.paths['/v1/conversations'].post.requestBody.content['application/json'].schema = {
  $ref: '#/components/schemas/CreateConversationRequest',
}
document.paths['/v1/executions/{id}/events'].parameters.find(
  (item) => item.name === 'after',
).schema = {
  type: 'integer',
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
  default: 0,
}
await writeFile(file, stringify(document, { lineWidth: 100 }))
console.log('OpenAPI schemas generated from the portable Zod contract')
