import '../env.js';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { db, initialiseDatabase, audit } from '../db.js';
import { validatePasswordStrength } from '../auth.js';

async function promptHidden(question: string) {
  output.write(question);
  input.setRawMode?.(true);
  input.resume();
  let value = '';
  return await new Promise<string>((resolve) => {
    const onData = (buffer: Buffer) => {
      const char = buffer.toString('utf8');
      if (char === '\r' || char === '\n') {
        input.setRawMode?.(false);
        input.off('data', onData);
        output.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u0003') process.exit(130);
      if (char === '\b' || char === '\u007f') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
      output.write('*');
    };
    input.on('data', onData);
  });
}

async function main() {
  initialiseDatabase();
  const rl = readline.createInterface({ input, output });
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role='admin' AND status!='archived' LIMIT 1").get();
  if (existingAdmin) throw new Error('An active administrator already exists. Refusing to create a duplicate one-time admin.');
  const name = (await rl.question('Admin name: ')).trim();
  const id = (await rl.question('Login ID or email: ')).trim().toLowerCase();
  rl.close();
  if (name.length < 2) throw new Error('Admin name is required.');
  if (!/^[a-z0-9._@-]{3,150}$/.test(id)) throw new Error('Login ID/email contains unsupported characters.');
  if (db.prepare('SELECT id FROM users WHERE id=?').get(id)) throw new Error('That login ID already exists.');
  const password = await promptHidden('Password: ');
  const confirmPassword = await promptHidden('Confirm password: ');
  if (password !== confirmPassword) throw new Error('Passwords do not match.');
  const passwordIssue = validatePasswordStrength(password);
  if (passwordIssue) throw new Error(passwordIssue);
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(password, 12);
  db.prepare(
    "INSERT INTO users (id,name,password_hash,role,client_id,status,password_changed_at,must_change_password) VALUES (?,?,?,'admin',NULL,'active',?,0)",
  ).run(id, name, hash, now);
  audit(id, 'create', 'user', id, { role: 'admin', source: 'create-admin' }, { actorRole: 'admin' });
  console.log('Administrator created successfully.');
}

main().catch((error) => {
  console.error(`Failed to create administrator: ${error.message}`);
  process.exit(1);
});
