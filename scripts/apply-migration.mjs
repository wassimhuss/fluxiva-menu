/**
 * Applies one migration file to the database named by SUPABASE_DB_URL.
 *
 * Supabase's hosted Postgres is only reachable with a real database
 * credential; the publishable key the app ships with is SELECT-only by
 * design (migration 011), so it cannot run DDL. Keep the connection string
 * in .env.local, which is gitignored.
 *
 *   node scripts/apply-migration.mjs supabase/migrations/013_rename_price_column.sql
 *
 * The whole file runs in one transaction: a migration that fails halfway
 * would leave the column renamed but the variant prices untouched, and the
 * menu would read zero for every size.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) { console.error('usage: node scripts/apply-migration.mjs <file.sql>'); process.exit(1) }

const url = process.env.SUPABASE_DB_URL
  ?? readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n').find((line) => line.startsWith('SUPABASE_DB_URL='))?.slice('SUPABASE_DB_URL='.length).trim().replace(/^["']|["']$/g, '')

if (!url) { console.error('SUPABASE_DB_URL is not set in the environment or .env.local'); process.exit(1) }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query('begin')
  await client.query(readFileSync(file, 'utf8'))
  await client.query('commit')
  console.log(`applied ${file}`)
} catch (error) {
  await client.query('rollback')
  console.error(`rolled back — ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
