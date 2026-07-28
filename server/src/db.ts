import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || './data/ci360.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const defaultSettings = {
  categories: [
    { name: 'Website Changes', baseHours: 24 },
    { name: 'Social Media', baseHours: 24 },
    { name: 'Media Uploads', baseHours: 6 },
    { name: 'Graphic Design', baseHours: 48 },
    { name: 'Copywriting', baseHours: 48 },
    { name: 'Video Editing', baseHours: 72 },
    { name: 'SEO / Web Content', baseHours: 48 },
    { name: 'Other', baseHours: 48 }
  ],
  capacityPerCategory: 2,
  bufferHoursPerExtraJob: 8,
  startHour: 10.5,
  endHour: 19,
  workDays: [1, 2, 3, 4, 5]
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
      status TEXT NOT NULL DEFAULT 'active',
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
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const setting = db.prepare('SELECT id FROM settings WHERE id=1').get();
  if (!setting) db.prepare('INSERT INTO settings (id,json) VALUES (1,?)').run(JSON.stringify(defaultSettings));

  const clientCount = (db.prepare('SELECT COUNT(*) count FROM clients').get() as { count: number }).count;
  if (clientCount === 0) seed();
}

function seed() {
  const insertClient = db.prepare('INSERT INTO clients (id,name,password_hash) VALUES (?,?,?)');
  const insertUser = db.prepare('INSERT INTO users (id,name,password_hash,role,client_id) VALUES (?,?,?,?,?)');
  const insertJob = db.prepare(`INSERT INTO jobs
    (id,client_id,title,description,category,priority,posted_by,asset_link,calculated_hours,team_override_hours,team_override_note,status,date_posted,date_completed,updated_at)
    VALUES (@id,@clientId,@title,@description,@category,@priority,@postedBy,@assetLink,@calculatedHours,@teamOverrideHours,@teamOverrideNote,@status,@datePosted,@dateCompleted,@updatedAt)`);

  const hash = (value: string) => bcrypt.hashSync(value, 12);
  const transaction = db.transaction(() => {
    insertClient.run('acme', 'Acme Corp', hash('acme123'));
    insertClient.run('beta', 'Beta Industries', hash('beta123'));
    insertUser.run('ci360admin', 'CI360 Team', hash('CI360Demo#2026'), 'admin', null);
    insertUser.run('acme', 'Acme Corp', hash('acme123'), 'client', 'acme');
    insertUser.run('beta', 'Beta Industries', hash('beta123'), 'client', 'beta');

    const now = new Date();
    const ago = (days: number, hour: number) => {
      const d = new Date(now); d.setDate(d.getDate() - days); d.setHours(hour, 0, 0, 0); return d.toISOString();
    };
    const jobs = [
      { id:'j1',clientId:'acme',title:'Update homepage banner for monsoon sale',description:'Swap hero image and headline copy on the homepage.',category:'Website Changes',priority:'High',postedBy:'Rina (Acme)',assetLink:'',calculatedHours:18,teamOverrideHours:null,teamOverrideNote:'',status:'in_progress',datePosted:ago(2,15),dateCompleted:null,updatedAt:new Date().toISOString() },
      { id:'j2',clientId:'acme',title:'Instagram carousel - new product launch',description:'5-slide carousel announcing the new product line.',category:'Social Media',priority:'Urgent',postedBy:'Rina (Acme)',assetLink:'',calculatedHours:12,teamOverrideHours:8,teamOverrideNote:'Client needs it by tomorrow morning - prioritised.',status:'submitted',datePosted:ago(1,10),dateCompleted:null,updatedAt:new Date().toISOString() },
      { id:'j3',clientId:'acme',title:'Upload Q3 catalogue PDFs to site',description:'',category:'Media Uploads',priority:'Low',postedBy:'Karan (Acme)',assetLink:'https://drive.google.com/',calculatedHours:9,teamOverrideHours:null,teamOverrideNote:'',status:'completed',datePosted:ago(35,12),dateCompleted:ago(33,17),updatedAt:new Date().toISOString() },
      { id:'j4',clientId:'beta',title:'Redesign pricing page',description:'New pricing tiers, needs a fresh layout.',category:'Website Changes',priority:'Medium',postedBy:'Neha (Beta)',assetLink:'',calculatedHours:24,teamOverrideHours:null,teamOverrideNote:'',status:'submitted',datePosted:ago(6,11),dateCompleted:null,updatedAt:new Date().toISOString() }
    ];
    jobs.forEach(job => insertJob.run(job));
  });
  transaction();
}

export function audit(actorId: string, action: string, entityType: string, entityId: string, details: unknown = {}) {
  db.prepare('INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)')
    .run(actorId, action, entityType, entityId, JSON.stringify(details));
}
