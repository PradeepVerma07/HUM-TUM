import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || './data/ci360.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let rawDb: SqlJsDatabase;

// Initialize sql.js synchronously from buffer or empty
const SQL = await initSqlJs();

if (fs.existsSync(dbPath)) {
  const fileBuffer = fs.readFileSync(dbPath);
  rawDb = new SQL.Database(fileBuffer);
} else {
  rawDb = new SQL.Database();
}

function persistToDisk() {
  try {
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('Error persisting SQLite DB to disk:', err);
  }
}

// Emulate better-sqlite3 API on top of sql.js
export const db = {
  exec(sql: string) {
    rawDb.exec(sql);
    persistToDisk();
  },
  pragma(_pragmaSql: string) {
    // Pragma no-op for sql.js in-memory wasm
  },
  close() {
    persistToDisk();
    rawDb.close();
  },
  prepare(sql: string) {
    return {
      get(...args: any[]) {
        const stmt = rawDb.prepare(sql);
        try {
          const params = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
            ? args[0]
            : args;
          stmt.bind(params);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...args: any[]) {
        const stmt = rawDb.prepare(sql);
        const results: any[] = [];
        try {
          const params = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
            ? args[0]
            : args;
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      },
      run(...args: any[]) {
        const stmt = rawDb.prepare(sql);
        try {
          const params = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
            ? args[0]
            : args;
          stmt.bind(params);
          stmt.step();
          stmt.free();

          const infoRes = rawDb.exec('SELECT last_insert_rowid() as lastInsertRowid, changes() as changes');
          let lastInsertRowid = 0;
          let changes = 0;
          if (infoRes.length > 0 && infoRes[0].values.length > 0) {
            lastInsertRowid = Number(infoRes[0].values[0][0]) || 0;
            changes = Number(infoRes[0].values[0][1]) || 0;
          }

          persistToDisk();
          return { lastInsertRowid, changes };
        } catch (e) {
          stmt.free();
          throw e;
        }
      }
    };
  },
  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      rawDb.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        persistToDisk();
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    }) as T;
  }
};

function hasColumn(table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addColumn(table: string, definition: string) {
  const column = definition.trim().split(/\s+/)[0];
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function migrateLegacyAttachmentTable() {
  const legacyColumn = ['data', 'base64'].join('_');
  if (!hasColumn('support_ticket_attachments', legacyColumn)) return;
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './data/private-uploads');
  const rows = db.prepare(`SELECT * FROM support_ticket_attachments`).all() as any[];
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_ticket_attachments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      message_id INTEGER,
      storage_provider TEXT NOT NULL DEFAULT 'local',
      storage_key TEXT,
      file_name TEXT NOT NULL,
      stored_name TEXT,
      mime_type TEXT NOT NULL,
      file_extension TEXT,
      size_bytes INTEGER NOT NULL,
      checksum TEXT,
      uploaded_by TEXT,
      related_entity_type TEXT NOT NULL DEFAULT 'support_ticket',
      related_entity_id TEXT,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(message_id) REFERENCES support_ticket_messages(id) ON DELETE SET NULL
    );
  `);
  const insert = db.prepare(`
    INSERT INTO support_ticket_attachments_new
    (id,ticket_id,message_id,storage_provider,storage_key,file_name,stored_name,mime_type,file_extension,size_bytes,checksum,uploaded_by,related_entity_type,related_entity_id,scan_status,deleted_at,created_at)
    VALUES (@id,@ticket_id,@message_id,@storage_provider,@storage_key,@file_name,@stored_name,@mime_type,@file_extension,@size_bytes,@checksum,@uploaded_by,@related_entity_type,@related_entity_id,@scan_status,@deleted_at,@created_at)
  `);
  const transaction = db.transaction(() => {
    for (const row of rows) {
      let storageKey = row.storage_key;
      let storedName = row.stored_name;
      let checksum = row.checksum;
      let sizeBytes = row.size_bytes;
      const fileName = row.file_name || 'legacy-attachment';
      const extension = (row.file_extension || path.extname(fileName).slice(1) || 'bin').toLowerCase();
      if (!storageKey && row[legacyColumn]) {
        const ticket = db.prepare('SELECT ticket_number FROM support_tickets WHERE id=?').get(row.ticket_id) as
          { ticket_number: string } | undefined;
        const ticketNumber = ticket?.ticket_number || `legacy-${row.ticket_id}`;
        const bytes = Buffer.from(row[legacyColumn], 'base64');
        storedName = `${crypto.randomUUID()}.${extension}`;
        storageKey = path.join('support-tickets', ticketNumber, storedName);
        const targetDir = path.join(uploadDir, 'support-tickets', ticketNumber);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, storedName), bytes);
        checksum = crypto.createHash('sha256').update(bytes).digest('hex');
        sizeBytes = bytes.length;
      }
      insert.run({
        id: row.id,
        ticket_id: row.ticket_id,
        message_id: row.message_id,
        storage_provider: row.storage_provider || 'local',
        storage_key: storageKey,
        file_name: fileName,
        stored_name: storedName,
        mime_type: row.mime_type || 'application/octet-stream',
        file_extension: extension,
        size_bytes: sizeBytes || 0,
        checksum,
        uploaded_by: row.uploaded_by,
        related_entity_type: row.related_entity_type || 'support_ticket',
        related_entity_id: row.related_entity_id,
        scan_status: row.scan_status || 'pending',
        deleted_at: row.deleted_at,
        created_at: row.created_at,
      });
    }
    db.exec('DROP TABLE support_ticket_attachments;');
    db.exec('ALTER TABLE support_ticket_attachments_new RENAME TO support_ticket_attachments;');
  });
  transaction();
}

export const defaultSettings = {
  categories: [
    { name: 'Website Changes', baseHours: 24 },
    { name: 'Social Media', baseHours: 24 },
    { name: 'Media Uploads', baseHours: 6 },
    { name: 'Graphic Design', baseHours: 48 },
    { name: 'Copywriting', baseHours: 48 },
    { name: 'Video Editing', baseHours: 72 },
    { name: 'SEO / Web Content', baseHours: 48 },
    { name: 'Other', baseHours: 48 },
  ],
  capacityPerCategory: 2,
  bufferHoursPerExtraJob: 8,
  startHour: 10.5,
  endHour: 19,
  workDays: [1, 2, 3, 4, 5],
};

export function initialiseDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','client')),
      client_id TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','suspended','locked','archived','password_reset_required')),
      password_changed_at TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      archived_at TEXT,
      archived_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      posted_by TEXT NOT NULL,
      asset_link TEXT NOT NULL DEFAULT '',
      calculated_hours REAL NOT NULL,
      team_override_hours REAL,
      team_override_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted',
      date_posted TEXT NOT NULL,
      date_completed TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      request_id TEXT,
      ip_address TEXT,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      client_id TEXT,
      subject TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Technical Issue','Account Issue','Job Posting Issue','Candidate Issue','Client Issue','Billing Issue','Feature Request','General Support')),
      priority TEXT NOT NULL CHECK(priority IN ('Low','Medium','High','Urgent')),
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Waiting for User','Resolved','Closed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL CHECK(author_role IN ('admin','client')),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS support_ticket_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      message_id INTEGER,
      storage_provider TEXT NOT NULL DEFAULT 'local',
      storage_key TEXT,
      file_name TEXT NOT NULL,
      stored_name TEXT,
      mime_type TEXT NOT NULL,
      file_extension TEXT,
      size_bytes INTEGER NOT NULL,
      checksum TEXT,
      uploaded_by TEXT,
      related_entity_type TEXT NOT NULL DEFAULT 'support_ticket',
      related_entity_id TEXT,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(message_id) REFERENCES support_ticket_messages(id) ON DELETE SET NULL
    );
  `);

  addColumn('users', 'password_changed_at TEXT');
  addColumn('users', 'must_change_password INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'failed_login_attempts INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'locked_until TEXT');
  addColumn('users', 'last_login_at TEXT');
  addColumn('users', 'archived_at TEXT');
  addColumn('users', 'archived_by TEXT');
  addColumn('audit_logs', 'actor_role TEXT');
  addColumn('audit_logs', 'request_id TEXT');
  addColumn('audit_logs', 'ip_address TEXT');
  addColumn('support_ticket_attachments', "storage_provider TEXT NOT NULL DEFAULT 'local'");
  addColumn('support_ticket_attachments', 'storage_key TEXT');
  addColumn('support_ticket_attachments', 'stored_name TEXT');
  addColumn('support_ticket_attachments', 'file_extension TEXT');
  addColumn('support_ticket_attachments', 'checksum TEXT');
  addColumn('support_ticket_attachments', 'uploaded_by TEXT');
  addColumn('support_ticket_attachments', "related_entity_type TEXT NOT NULL DEFAULT 'support_ticket'");
  addColumn('support_ticket_attachments', 'related_entity_id TEXT');
  addColumn('support_ticket_attachments', "scan_status TEXT NOT NULL DEFAULT 'pending'");
  addColumn('support_ticket_attachments', 'deleted_at TEXT');
  migrateLegacyAttachmentTable();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_client_status ON users(client_id,status);
    CREATE INDEX IF NOT EXISTS idx_jobs_client_status ON jobs(client_id,status);
    CREATE INDEX IF NOT EXISTS idx_jobs_updated ON jobs(updated_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON support_tickets(user_id,status);
    CREATE INDEX IF NOT EXISTS idx_tickets_client_status ON support_tickets(client_id,status);
    CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at);
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_related ON support_ticket_attachments(related_entity_type,related_entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs(actor_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON refresh_sessions(user_id,revoked_at,expires_at);
  `);

  const setting = db.prepare('SELECT id FROM settings WHERE id=1').get();
  if (!setting) db.prepare('INSERT INTO settings (id,json) VALUES (1,?)').run(JSON.stringify(defaultSettings));
}

export function seedDemoData() {
  const insertClient = db.prepare('INSERT INTO clients (id,name,password_hash) VALUES (?,?,?)');
  const insertUser = db.prepare('INSERT INTO users (id,name,password_hash,role,client_id,password_changed_at) VALUES (?,?,?,?,?,?)');
  const insertJob = db.prepare(`INSERT INTO jobs
    (id,client_id,title,description,category,priority,posted_by,asset_link,calculated_hours,team_override_hours,team_override_note,status,date_posted,date_completed,updated_at)
    VALUES (@id,@clientId,@title,@description,@category,@priority,@postedBy,@assetLink,@calculatedHours,@teamOverrideHours,@teamOverrideNote,@status,@datePosted,@dateCompleted,@updatedAt)`);

  const hash = (value: string) => bcrypt.hashSync(value, 12);
  const transaction = db.transaction(() => {
    const clientCount = (db.prepare('SELECT COUNT(*) count FROM clients').get() as { count: number }).count;
    if (clientCount > 0) return;
    const nowIso = new Date().toISOString();
    insertClient.run('acme', 'Acme Corp', hash('ChangeMeAcme123!'));
    insertClient.run('beta', 'Beta Industries', hash('ChangeMeBeta123!'));
    insertUser.run('acme', 'Acme Corp', hash('ChangeMeAcme123!'), 'client', 'acme', nowIso);
    insertUser.run('beta', 'Beta Industries', hash('ChangeMeBeta123!'), 'client', 'beta', nowIso);

    const now = new Date();
    const ago = (days: number, hour: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const jobs = [
      {
        id: 'j1',
        clientId: 'acme',
        title: 'Update homepage banner for monsoon sale',
        description: 'Swap hero image and headline copy on the homepage.',
        category: 'Website Changes',
        priority: 'High',
        postedBy: 'Rina (Acme)',
        assetLink: '',
        calculatedHours: 18,
        teamOverrideHours: null,
        teamOverrideNote: '',
        status: 'in_progress',
        datePosted: ago(2, 15),
        dateCompleted: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'j2',
        clientId: 'acme',
        title: 'Instagram carousel - new product launch',
        description: '5-slide carousel announcing the new product line.',
        category: 'Social Media',
        priority: 'Urgent',
        postedBy: 'Rina (Acme)',
        assetLink: '',
        calculatedHours: 12,
        teamOverrideHours: 8,
        teamOverrideNote: 'Client needs it by tomorrow morning - prioritised.',
        status: 'submitted',
        datePosted: ago(1, 10),
        dateCompleted: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'j3',
        clientId: 'acme',
        title: 'Upload Q3 catalogue PDFs to site',
        description: '',
        category: 'Media Uploads',
        priority: 'Low',
        postedBy: 'Karan (Acme)',
        assetLink: 'https://drive.google.com/',
        calculatedHours: 9,
        teamOverrideHours: null,
        teamOverrideNote: '',
        status: 'completed',
        datePosted: ago(35, 12),
        dateCompleted: ago(33, 17),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'j4',
        clientId: 'beta',
        title: 'Redesign pricing page',
        description: 'New pricing tiers, needs a fresh layout.',
        category: 'Website Changes',
        priority: 'Medium',
        postedBy: 'Neha (Beta)',
        assetLink: '',
        calculatedHours: 24,
        teamOverrideHours: null,
        teamOverrideNote: '',
        status: 'submitted',
        datePosted: ago(6, 11),
        dateCompleted: null,
        updatedAt: new Date().toISOString(),
      },
    ];
    jobs.forEach((job) => insertJob.run(job));
  });
  transaction();
}

export function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown = {},
  context: { actorRole?: string | null; requestId?: string | null; ipAddress?: string | null } = {},
) {
  db.prepare(
    'INSERT INTO audit_logs (actor_id,actor_role,action,entity_type,entity_id,request_id,ip_address,details) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    actorId,
    context.actorRole || null,
    action,
    entityType,
    entityId,
    context.requestId || null,
    context.ipAddress || null,
    JSON.stringify(details),
  );
}
