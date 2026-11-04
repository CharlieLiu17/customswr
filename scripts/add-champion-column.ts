/**
 * Add champion column to match_players table.
 * Run: npx tsx scripts/add-champion-column.ts
 */
import { db, ensureSchema } from '../lib/db';

async function main() {
  await ensureSchema();

  // Check if column already exists
  const cols = await db().execute("PRAGMA table_info(match_players)");
  const hasChampion = cols.rows.some(r => r.name === 'champion');

  if (hasChampion) {
    console.log('Column "champion" already exists.');
    return;
  }

  console.log('Adding "champion" column to match_players...');
  await db().execute('ALTER TABLE match_players ADD COLUMN champion TEXT');
  console.log('Done.');
}

main().catch(console.error);
