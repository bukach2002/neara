import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import * as readline from 'node:readline/promises';

const prisma = new PrismaClient();

// Migrations must survive, otherwise Prisma thinks the schema was never applied.
const PRESERVED_TABLES = ['_prisma_migrations'];

const CONFIRMATION_PHRASE = 'DELETE ALL DATA';

type TableInfo = { tableName: string; rowCount: number };

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function describeTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return 'unknown database (DATABASE_URL is not set)';

  try {
    const url = new URL(raw);
    const database = url.pathname.replace(/^\//, '');
    return `${url.hostname}:${url.port || '5432'}/${database}`;
  } catch {
    return 'unknown database (DATABASE_URL could not be parsed)';
  }
}

/** Application tables in the current schema, excluding migrations and extension tables (PostGIS, pg_trgm). */
async function listApplicationTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN (${Prisma.join(PRESERVED_TABLES)})
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype = 'e'
      )
    ORDER BY c.relname;
  `;

  return rows.map((row) => row.tablename);
}

async function countRows(tables: string[]): Promise<TableInfo[]> {
  const result: TableInfo[] = [];

  for (const tableName of tables) {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) AS count FROM ${quoteIdent(tableName)};`,
    );
    result.push({ tableName, rowCount: Number(rows[0]?.count ?? 0) });
  }

  return result;
}

async function confirm(): Promise<boolean> {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;

  if (!process.stdin.isTTY) {
    console.error('\nRefusing to wipe data without confirmation.');
    console.error('Re-run with --yes in a non-interactive environment.');
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `\nType "${CONFIRMATION_PHRASE}" to permanently delete all data: `,
    );
    return answer.trim() === CONFIRMATION_PHRASE;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const target = describeTarget();
  const tables = await listApplicationTables();

  if (tables.length === 0) {
    console.log(`No application tables found in ${target}. Nothing to clean up.`);
    return;
  }

  const counts = await countRows(tables);
  const totalRows = counts.reduce((sum, entry) => sum + entry.rowCount, 0);

  console.log(`\nTarget: ${target}`);
  console.log(`${tables.length} tables, ${totalRows} rows to delete:\n`);
  for (const { tableName, rowCount } of counts) {
    console.log(`  ${tableName.padEnd(32)} ${rowCount}`);
  }
  console.log(`\nPreserved: ${PRESERVED_TABLES.join(', ')} (schema stays intact)`);

  if (totalRows === 0) {
    console.log('\nDatabase is already blank. Nothing to do.');
    return;
  }

  if (!(await confirm())) {
    console.log('\nAborted. No data was deleted.');
    process.exitCode = 1;
    return;
  }

  const tableList = tables.map(quoteIdent).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);

  const remaining = await countRows(tables);
  const remainingRows = remaining.reduce((sum, entry) => sum + entry.rowCount, 0);

  console.log(`\nDeleted ${totalRows} rows from ${tables.length} tables.`);
  console.log(`Remaining rows: ${remainingRows}`);
  console.log('Database is blank.');
}

main()
  .catch((error) => {
    console.error('\nCleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
