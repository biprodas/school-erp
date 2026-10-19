import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES_GLOBS } from '../src/tenancy/tenant.datasource';

const TABLES = process.argv.slice(2);
function colType(c: any): string {
  const t = c.type as string;
  if (t === 'varchar')
    return c.length ? `character varying(${c.length})` : 'character varying';
  if (t === 'char') return `character(${c.length})`;
  if (t === 'int') return 'integer';
  if (t === 'smallint') return 'smallint';
  if (t === 'bigint') return 'bigint';
  if (t === 'timestamptz') return 'TIMESTAMP WITH TIME ZONE';
  if (t === 'timestamp') return 'TIMESTAMP';
  if (
    t === 'jsonb' ||
    t === 'uuid' ||
    t === 'text' ||
    t === 'boolean' ||
    t === 'date'
  )
    return t;
  if (t === (String as any) || t === 'String') return 'character varying';
  throw new Error('type ' + t);
}
async function main() {
  const ds = new DataSource({ type: 'postgres', entities: ALL_ENTITIES_GLOBS });
  await (ds as any).buildMetadatas();
  for (const name of TABLES) {
    const m = ds.entityMetadatas.find((e) => e.tableName === name)!;
    const cols = m.columns.map((c) => {
      let s = `"${c.databaseName}" ${colType(c)} ${c.isNullable ? '' : 'NOT NULL '}`;
      if (c.isGenerated && c.generationStrategy === 'uuid')
        s += 'DEFAULT uuid_generate_v4() ';
      else if (c.isCreateDate || c.isUpdateDate) s += 'DEFAULT now() ';
      else if (c.default !== undefined)
        s += `DEFAULT ${typeof c.default === 'number' ? `'${c.default}'` : typeof c.default === 'boolean' ? c.default : `'${c.default}'`} `;
      return s.trim();
    });
    const pk = m.primaryColumns.map((c) => c.databaseName);
    const pkName = ds.namingStrategy.primaryKeyName(m.tableName, pk);
    console.log(
      `CREATE TABLE "${name}" (${cols.join(', ')}, CONSTRAINT "${pkName}" PRIMARY KEY (${pk.map((p) => `"${p}"`).join(', ')}))`,
    );
    for (const i of m.indices) {
      console.log(
        `CREATE ${i.isUnique ? 'UNIQUE ' : ''}INDEX "${i.name}" ON "${name}" (${i.columns.map((c) => `"${c.databaseName}"`).join(', ')}) ${i.where ? 'WHERE ' + i.where : ''}`,
      );
    }
    for (const fk of m.foreignKeys) {
      console.log(
        `ALTER TABLE "${name}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columnNames.map((c) => `"${c}"`).join(', ')}) REFERENCES "${fk.referencedTablePath}"(${fk.referencedColumnNames.map((c) => `"${c}"`).join(', ')}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
      );
    }
    for (const fk of m.foreignKeys)
      console.log(`--DROP ALTER TABLE "${name}" DROP CONSTRAINT "${fk.name}"`);
    for (const i of m.indices)
      console.log(`--DROP DROP INDEX "public"."${i.name}"`);
  }
}
main();
