import { z } from 'zod'
import * as protocol from '../packages/protocol/dist/index.js'

export function runtimeSchemas() {
  const registry = z.registry()
  for (const [name, schema] of Object.entries(protocol)) {
    if (name.endsWith('Schema')) registry.add(schema, { id: name.slice(0, -6) })
  }
  const generated = z.toJSONSchema(registry, {
    io: 'input',
    target: 'draft-2020-12',
    uri: (id) => `#/components/schemas/${id}`,
  })
  return Object.fromEntries(
    Object.entries(generated.schemas).map(([name, schema]) => {
      // Embedded OpenAPI components share the document root for their local references.
      const { $id: _id, $schema: _dialect, ...body } = schema
      return [name, body]
    }),
  )
}
