import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultSchemaPath = path.resolve(__dirname, '../docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');

/**
 * Parses PRISMA_SCHEMA_DRAFT.prisma directly as the single source of truth
 * and returns the exact inventory of models (with @@map table names) and enums (with values).
 */
export function extractPrismaInventory(schemaPath = defaultSchemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf8');

  const enums = [];
  const enumRegex = /^enum\s+([A-Za-z0-9_]+)\s+\{([\s\S]*?)^\}/gm;
  for (const match of content.matchAll(enumRegex)) {
    const name = match[1];
    const values = match[2]
      .split('\n')
      .map(line => line.replace(/\/\/.*$/, '').trim())
      .filter(Boolean);
    enums.push({ name, values });
  }

  const models = [];
  const modelRegex = /^model\s+([A-Za-z0-9_]+)\s+\{([\s\S]*?)^\}/gm;
  for (const match of content.matchAll(modelRegex)) {
    const name = match[1];
    const body = match[2];
    const tableMapMatch = body.match(/@@map\("([a-z0-9_]+)"\)/);
    const tableName = tableMapMatch ? tableMapMatch[1] : name;
    models.push({ name, tableName });
  }

  return {
    modelCount: models.length,
    enumCount: enums.length,
    models,
    enums,
    modelNames: models.map(m => m.name),
    enumNames: enums.map(e => e.name),
  };
}
