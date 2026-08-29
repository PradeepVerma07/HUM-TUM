import '../env.js';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';

const migrationsDir = [path.resolve(process.cwd(), 'migrations'), path.resolve(process.cwd(), '..', 'migrations')].find((candidate) =>
  fs.existsSync(candidate),
);
if (!migrationsDir) throw new Error('Could not find migrations directory.');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');
const applied = new Map(
  (db.prepare('SELECT id,applied_at appliedAt FROM schema_migrations ORDER BY id').all() as Array<{ id: string; appliedAt: string }>).map(
    (row) => [row.id, row.appliedAt],
  ),
);
const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  const status = applied.has(file) ? `applied ${applied.get(file)}` : 'pending';
  console.log(`${file}: ${status}`);
}
