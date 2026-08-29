import '../env.js';
import fs from 'node:fs';
import path from 'node:path';
import { db, initialiseDatabase } from '../db.js';

const migrationsDir = [path.resolve(process.cwd(), 'migrations'), path.resolve(process.cwd(), '..', 'migrations')].find((candidate) =>
  fs.existsSync(candidate),
);
if (!migrationsDir) throw new Error('Could not find migrations directory.');

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
initialiseDatabase();

const applied = new Set((db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>).map((row) => row.id));
const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const transaction = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
  });
  transaction();
  console.log(`Applied ${file}`);
}

console.log('Migrations complete.');
