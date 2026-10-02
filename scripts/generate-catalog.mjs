import { readFileSync, writeFileSync } from 'node:fs';
const spec = JSON.parse(readFileSync(new URL('../docs/bdl-openapi.json', import.meta.url), 'utf8'));
const endpoints = Object.entries(spec.paths).filter(([,v]) => v.get).map(([path, v]) => ({
  path, label: `${path.split('/')[1]} · ${v.get.summary.split('/')[0].trim()}`,
  parameters: v.get.parameters.filter(p => ['path','query'].includes(p.in) && !['format','lang'].includes(p.name)).map(p => {
    const schema = p.schema;
    const result = { name: p.name, location: p.in, type: schema.type, required: p.required ?? false };
    if (schema.type === 'array') result.itemType = schema.items.type;
    if (schema.enum || schema.items?.enum) result.values = (schema.enum || schema.items.enum).map(String);
    if (schema.default !== undefined) result.default = String(schema.default);
    return result;
  })
}));
writeFileSync(new URL('../src/catalog.ts', import.meta.url), '// Generated from docs/bdl-openapi.json by scripts/generate-catalog.mjs.\nimport type { Endpoint } from "./shared.js";\nexport const endpoints: Endpoint[] = '+JSON.stringify(endpoints,null,2)+';\n');
