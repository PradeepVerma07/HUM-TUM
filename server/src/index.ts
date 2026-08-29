import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { z } from 'zod';
import { fileTypeFromFile } from 'file-type';
import { db, initialiseDatabase, audit } from './db.js';
import {
  assertActiveUser,
  authUserFromRow,
  hashToken,
  randomToken,
  requireAdmin,
  requireAuth,
  signAccessToken,
  validatePasswordStrength,
  verifyAccessToken,
  type AuthedRequest,
  type AuthUser,
} from './auth.js';
import { calculateHours } from './tat.js';
import { config } from './env.js';

initialiseDatabase();
const app = express();
const httpServer = createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const origin = config.CLIENT_URL;
let ready = true;
const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.refreshToken'],
});
const io = new Server(httpServer, { cors: { origin, credentials: true } });
const uploadTempDir = path.join(config.uploadDir, 'tmp');
fs.mkdirSync(uploadTempDir, { recursive: true });
fs.mkdirSync(path.join(config.uploadDir, 'support-tickets'), { recursive: true });
const upload = multer({ dest: uploadTempDir, limits: { fileSize: config.maxUploadBytes, files: 1 } });
if (config.TRUST_PROXY) app.set('trust proxy', 1);
app.use((req: AuthedRequest, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '');
  req.requestId = /^[a-zA-Z0-9._:-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use(pinoHttp({ logger, genReqId: (req) => (req as AuthedRequest).requestId || crypto.randomUUID() }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", origin],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  }),
);
app.use(cors({ origin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));

const emitRefresh = (target?: { userId?: string; clientId?: string; ticketNumber?: string; jobId?: string }) => {
  const payload = { at: new Date().toISOString() };
  if (!target) {
    io.to('admin').emit('data:changed', payload);
    const users = db.prepare("SELECT id,client_id FROM users WHERE status='active'").all() as Array<{
      id: string;
      client_id: string | null;
    }>;
    for (const user of users) {
      io.to(`user:${user.id}`).emit('data:changed', payload);
      if (user.client_id) io.to(`client:${user.client_id}`).emit('data:changed', payload);
    }
    return;
  }
  if (target.userId) io.to(`user:${target.userId}`).emit('data:changed', payload);
  if (target.clientId) io.to(`client:${target.clientId}`).emit('data:changed', payload);
  if (target.ticketNumber) io.to(`ticket:${target.ticketNumber}`).emit('data:changed', payload);
  if (target.jobId) io.to(`job:${target.jobId}`).emit('data:changed', payload);
  io.to('admin').emit('data:changed', payload);
};
const settings = () => JSON.parse((db.prepare('SELECT json FROM settings WHERE id=1').get() as { json: string }).json);
const categoryLoad = () => {
  const rows = db
    .prepare("SELECT category,COUNT(*) count FROM jobs WHERE status!='completed' AND status!='cancelled' GROUP BY category")
    .all() as Array<{ category: string; count: number }>;
  return Object.fromEntries(rows.map((row) => [row.category, row.count]));
};
const mapJob = (row: any) => ({
  id: row.id,
  clientId: row.client_id,
  title: row.title,
  description: row.description,
  category: row.category,
  priority: row.priority,
  postedBy: row.posted_by,
  assetLink: row.asset_link,
  calculatedHours: row.calculated_hours,
  teamOverrideHours: row.team_override_hours,
  teamOverrideNote: row.team_override_note,
  status: row.status,
  datePosted: row.date_posted,
  dateCompleted: row.date_completed,
  updatedAt: row.updated_at,
});
const ticketCategories = [
  'Technical Issue',
  'Account Issue',
  'Job Posting Issue',
  'Candidate Issue',
  'Client Issue',
  'Billing Issue',
  'Feature Request',
  'General Support',
] as const;
const ticketPriorities = ['Low', 'Medium', 'High', 'Urgent'] as const;
const ticketStatuses = ['Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'] as const;
const allowedAttachmentExtensions = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'zip']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed',
]);
const ticketNumberFor = (id: number) => `CI360-${String(id).padStart(6, '0')}`;
const mapTicket = (row: any) => ({
  ticketNumber: row.ticket_number,
  userId: row.user_id,
  userName: row.user_name,
  clientId: row.client_id,
  subject: row.subject,
  category: row.category,
  priority: row.priority,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
});
const mapAttachment = (row: any) => ({
  id: String(row.id),
  ticketNumber: row.ticket_number,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  messageId: row.message_id ? String(row.message_id) : null,
  checksum: row.checksum,
  scanStatus: row.scan_status,
  createdAt: row.created_at,
});
const mapMessage = (row: any) => ({
  id: String(row.id),
  authorId: row.author_id,
  authorName: row.author_name,
  authorRole: row.author_role,
  body: row.body,
  createdAt: row.created_at,
  attachments: [] as ReturnType<typeof mapAttachment>[],
});
const cleanFileName = (name: string) => {
  const base = path
    .basename(name)
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .trim();
  return base || 'attachment';
};
const prepareAttachment = async (file: Express.Multer.File | undefined, ticketNumber: string) => {
  if (!file) return null;
  const fileName = cleanFileName(file.originalname);
  const extension = path.extname(fileName).slice(1).toLowerCase();
  if (!allowedAttachmentExtensions.has(extension)) throw new Error('Attachment must be PDF, DOC, DOCX, JPG, JPEG, PNG or ZIP');
  if (file.size <= 0 || file.size > config.maxUploadBytes) throw new Error(`Attachment must be ${config.MAX_UPLOAD_MB} MB or smaller`);
  if (fileName.replace(/\.+/g, '.').split('.').length > 2) throw new Error('Attachment filename must not use double extensions');
  const detected = await fileTypeFromFile(file.path);
  const detectedMime = detected?.mime || (extension === 'doc' ? 'application/msword' : '');
  if (!detectedMime || !allowedMimeTypes.has(detectedMime)) throw new Error('Attachment file type could not be verified');
  if (
    (extension === 'pdf' && detectedMime !== 'application/pdf') ||
    (['jpg', 'jpeg'].includes(extension) && detectedMime !== 'image/jpeg') ||
    (extension === 'png' && detectedMime !== 'image/png')
  ) {
    throw new Error('Attachment extension does not match its file content');
  }
  if (
    (extension === 'docx' || extension === 'zip') &&
    ![
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(detectedMime)
  ) {
    throw new Error('Attachment extension does not match its file content');
  }
  const bytes = await fsp.readFile(file.path);
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
  const storedName = `${crypto.randomUUID()}.${extension}`;
  const targetDir = path.join(config.uploadDir, 'support-tickets', ticketNumber);
  await fsp.mkdir(targetDir, { recursive: true });
  const storageKey = path.join('support-tickets', ticketNumber, storedName);
  await fsp.rename(file.path, path.join(targetDir, storedName));
  return { fileName, storedName, storageKey, mimeType: detectedMime, extension, sizeBytes: file.size, checksum };
};
const getTicketRow = (ticketNumber: string) => db.prepare('SELECT * FROM support_tickets WHERE ticket_number=?').get(ticketNumber) as any;
const canAccessTicket = (user: NonNullable<AuthedRequest['user']>, ticket: any) => user.role === 'admin' || ticket.user_id === user.id;
const ticketDetail = (ticket: any) => {
  const messages = (
    db.prepare('SELECT * FROM support_ticket_messages WHERE ticket_id=? ORDER BY created_at ASC,id ASC').all(ticket.id) as any[]
  ).map(mapMessage);
  const attachments = (
    db
      .prepare(
        'SELECT a.*,t.ticket_number FROM support_ticket_attachments a JOIN support_tickets t ON t.id=a.ticket_id WHERE a.ticket_id=? ORDER BY a.created_at ASC,a.id ASC',
      )
      .all(ticket.id) as any[]
  ).map(mapAttachment);
  const byMessage = new Map(messages.map((message) => [Number(message.id), message]));
  for (const attachment of attachments) {
    const messageId = attachment.messageId ? Number(attachment.messageId) : null;
    if (messageId && byMessage.has(messageId)) byMessage.get(messageId)!.attachments.push(attachment);
  }
  return { ...mapTicket(ticket), messages, attachments };
};
const refreshCookieName = 'ci360_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth',
};
const createRefreshSession = (user: AuthUser, req: AuthedRequest) => {
  const token = randomToken();
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_sessions (id,user_id,token_hash,user_agent,ip_address,expires_at,created_at,last_used_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(sessionId, user.id, hashToken(token), req.headers['user-agent'] || null, req.ip, expires, now.toISOString(), now.toISOString());
  return { token, sessionId, expires };
};
const setRefreshCookie = (res: express.Response, token: string, expires: string) => {
  res.cookie(refreshCookieName, token, { ...cookieOptions, expires: new Date(expires) });
};
const clearRefreshCookie = (res: express.Response) => res.clearCookie(refreshCookieName, cookieOptions);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});
const invalidLogin = (req: AuthedRequest, res: express.Response, actorId: string | null = null) => {
  audit(actorId, 'login_failed', 'user', actorId || 'unknown', {}, { requestId: req.requestId, ipAddress: req.ip });
  return res.status(401).json({ error: 'Invalid login credentials' });
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/health/live', (_req, res) => res.json({ status: 'live' }));
app.get('/health/ready', (_req, res) => {
  try {
    if (!ready) return res.status(503).json({ status: 'not_ready' });
    db.prepare('SELECT 1').get();
    fs.accessSync(config.uploadDir, fs.constants.W_OK);
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ id: z.string().trim().min(1).max(150), password: z.string().min(1).max(256) })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'ID and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parsed.data.id) as any;
  if (!user) return invalidLogin(req, res);
  const active = assertActiveUser(user);
  if (!active.ok) {
    audit(
      user.id,
      'login_blocked',
      'user',
      user.id,
      { status: user.status, lockedUntil: user.locked_until },
      { requestId: req.requestId, ipAddress: req.ip, actorRole: user.role },
    );
    return res.status(active.code).json({ error: active.message });
  }
  const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!ok) {
    const attempts = Number(user.failed_login_attempts || 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    db.prepare('UPDATE users SET failed_login_attempts=?,locked_until=?,status=CASE WHEN ? IS NULL THEN status ELSE ? END WHERE id=?').run(
      attempts,
      lockedUntil,
      lockedUntil,
      lockedUntil ? 'locked' : user.status,
      user.id,
    );
    if (lockedUntil)
      audit(
        user.id,
        'account_lock',
        'user',
        user.id,
        { lockedUntil },
        { requestId: req.requestId, ipAddress: req.ip, actorRole: user.role },
      );
    return invalidLogin(req, res, user.id);
  }
  const authUser = authUserFromRow(user);
  db.prepare(
    "UPDATE users SET failed_login_attempts=0,locked_until=NULL,status=CASE WHEN status='locked' THEN 'active' ELSE status END,last_login_at=? WHERE id=?",
  ).run(new Date().toISOString(), user.id);
  const session = createRefreshSession(authUser, req);
  setRefreshCookie(res, session.token, session.expires);
  audit(user.id, 'login_success', 'user', user.id, {}, { requestId: req.requestId, ipAddress: req.ip, actorRole: user.role });
  res.json({ token: signAccessToken(authUser, session.sessionId), user: authUser, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS });
});

app.post('/api/auth/refresh', (req: AuthedRequest, res) => {
  const token = req.cookies?.[refreshCookieName];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const tokenHash = hashToken(token);
  const session = db
    .prepare('SELECT * FROM refresh_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?')
    .get(tokenHash, new Date().toISOString()) as any;
  if (!session) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id) as any;
  const active = assertActiveUser(user);
  if (!active.ok) {
    db.prepare('UPDATE refresh_sessions SET revoked_at=? WHERE id=?').run(new Date().toISOString(), session.id);
    clearRefreshCookie(res);
    return res.status(active.code).json({ error: active.message });
  }
  const authUser = authUserFromRow(user);
  const rotated = randomToken();
  db.prepare('UPDATE refresh_sessions SET token_hash=?,last_used_at=? WHERE id=?').run(
    hashToken(rotated),
    new Date().toISOString(),
    session.id,
  );
  setRefreshCookie(res, rotated, session.expires_at);
  res.json({ token: signAccessToken(authUser, session.id), user: authUser, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS });
});

app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  if (req.user?.sessionId)
    db.prepare('UPDATE refresh_sessions SET revoked_at=? WHERE id=?').run(new Date().toISOString(), req.user.sessionId);
  clearRefreshCookie(res);
  audit(req.user!.id, 'logout', 'user', req.user!.id, {}, { requestId: req.requestId, ipAddress: req.ip, actorRole: req.user!.role });
  res.json({ ok: true });
});

app.post('/api/auth/logout-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE refresh_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(new Date().toISOString(), req.user!.id);
  clearRefreshCookie(res);
  audit(req.user!.id, 'logout_all', 'user', req.user!.id, {}, { requestId: req.requestId, ipAddress: req.ip, actorRole: req.user!.role });
  res.json({ ok: true });
});

app.get('/api/bootstrap', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const jobRows =
    user.role === 'admin'
      ? db.prepare('SELECT * FROM jobs ORDER BY date_posted DESC').all()
      : db.prepare('SELECT * FROM jobs WHERE client_id=? ORDER BY date_posted DESC').all(user.clientId);
  const clients = user.role === 'admin' ? db.prepare('SELECT id,name,status,created_at createdAt FROM clients ORDER BY name').all() : [];
  const ticketRows =
    user.role === 'admin'
      ? db.prepare('SELECT * FROM support_tickets ORDER BY updated_at DESC,id DESC').all()
      : db.prepare('SELECT * FROM support_tickets WHERE user_id=? ORDER BY updated_at DESC,id DESC').all(user.id);
  res.json({
    user,
    jobs: jobRows.map(mapJob),
    clients,
    supportTickets: ticketRows.map(mapTicket),
    settings: settings(),
    categoryLoad: categoryLoad(),
  });
});

app.post('/api/jobs', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    clientId: z.string().optional(),
    title: z.string().min(2),
    description: z.string().default(''),
    category: z.string().min(1),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
    postedBy: z.string().min(2),
    assetLink: z.string().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const user = req.user!;
  const clientId = user.role === 'admin' ? parsed.data.clientId : user.clientId;
  if (!clientId) return res.status(400).json({ error: 'Client is required' });
  const client = db.prepare("SELECT id FROM clients WHERE id=? AND status='active'").get(clientId);
  if (!client) return res.status(400).json({ error: 'Active client not found' });
  const id = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  const calculatedHours = calculateHours(settings(), categoryLoad(), parsed.data.category, parsed.data.priority);
  db.prepare(
    `INSERT INTO jobs (id,client_id,title,description,category,priority,posted_by,asset_link,calculated_hours,status,date_posted,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'submitted',?,?)`,
  ).run(
    id,
    clientId,
    parsed.data.title,
    parsed.data.description,
    parsed.data.category,
    parsed.data.priority,
    parsed.data.postedBy,
    parsed.data.assetLink,
    calculatedHours,
    now,
    now,
  );
  audit(user.id, 'create', 'job', id, parsed.data);
  emitRefresh();
  res.status(201).json({ job: mapJob(db.prepare('SELECT * FROM jobs WHERE id=?').get(id)) });
});

app.patch('/api/jobs/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const schema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
    status: z
      .enum(['submitted', 'under_review', 'in_progress', 'waiting_client', 'revision_requested', 'on_hold', 'completed', 'cancelled'])
      .optional(),
    assetLink: z.string().optional(),
    teamOverrideHours: z.number().positive().nullable().optional(),
    teamOverrideNote: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const current = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any;
  if (!current) return res.status(404).json({ error: 'Job not found' });
  const map: Record<string, string> = {
    title: 'title',
    description: 'description',
    category: 'category',
    priority: 'priority',
    status: 'status',
    assetLink: 'asset_link',
    teamOverrideHours: 'team_override_hours',
    teamOverrideNote: 'team_override_note',
  };
  const entries = Object.entries(parsed.data);
  if (!entries.length) return res.status(400).json({ error: 'No changes supplied' });
  const sets = entries.map(([key]) => `${map[key]}=?`);
  const values = entries.map(([, value]) => value);
  sets.push('updated_at=?');
  values.push(new Date().toISOString());
  if (parsed.data.status === 'completed') {
    sets.push('date_completed=?');
    values.push(new Date().toISOString());
  }
  if (parsed.data.status && parsed.data.status !== 'completed') {
    sets.push('date_completed=NULL');
  }
  db.prepare(`UPDATE jobs SET ${sets.join(',')} WHERE id=?`).run(...values, req.params.id);
  audit(req.user!.id, 'update', 'job', req.params.id, parsed.data);
  emitRefresh();
  res.json({ job: mapJob(db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id)) });
});

app.put('/api/settings', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const schema = z.object({
    categories: z.array(z.object({ name: z.string().min(1), baseHours: z.number().positive() })).min(1),
    capacityPerCategory: z.number().int().positive(),
    bufferHoursPerExtraJob: z.number().nonnegative(),
    startHour: z.number().min(0).max(24),
    endHour: z.number().min(0).max(24),
    workDays: z.array(z.number().int().min(0).max(6)).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  db.prepare('UPDATE settings SET json=? WHERE id=1').run(JSON.stringify(parsed.data));
  audit(req.user!.id, 'update', 'settings', '1', parsed.data);
  emitRefresh();
  res.json({ settings: parsed.data });
});

app.post('/api/clients', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      id: z.string().regex(/^[a-z0-9_-]+$/),
      name: z.string().trim().min(2).max(120),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  if (parsed.data.password !== parsed.data.confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  const passwordIssue = validatePasswordStrength(parsed.data.password);
  if (passwordIssue) return res.status(400).json({ error: passwordIssue });
  if (db.prepare('SELECT id FROM clients WHERE id=?').get(parsed.data.id))
    return res.status(409).json({ error: 'Client ID already exists' });
  const hash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO clients (id,name,password_hash) VALUES (?,?,?)').run(parsed.data.id, parsed.data.name, hash);
    db.prepare(
      "INSERT INTO users (id,name,password_hash,role,client_id,password_changed_at,must_change_password,status) VALUES (?,?,?,'client',?,?,?,'password_reset_required')",
    ).run(parsed.data.id, parsed.data.name, hash, parsed.data.id, now, 1);
  });
  tx();
  audit(req.user!.id, 'create', 'client', parsed.data.id, { name: parsed.data.name });
  emitRefresh();
  res.status(201).json({ ok: true });
});

app.patch('/api/clients/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      password: z.string().optional(),
      confirmPassword: z.string().optional(),
      status: z.enum(['active', 'archived', 'suspended']).optional(),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (parsed.data.password || parsed.data.confirmPassword) {
    if (parsed.data.password !== parsed.data.confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
    const passwordIssue = validatePasswordStrength(parsed.data.password || '');
    if (passwordIssue) return res.status(400).json({ error: passwordIssue });
  }
  if (parsed.data.name) {
    db.prepare('UPDATE clients SET name=? WHERE id=?').run(parsed.data.name, req.params.id);
    db.prepare('UPDATE users SET name=? WHERE client_id=?').run(parsed.data.name, req.params.id);
  }
  if (parsed.data.status) {
    db.prepare('UPDATE clients SET status=? WHERE id=?').run(parsed.data.status, req.params.id);
    db.prepare('UPDATE users SET status=? WHERE client_id=?').run(parsed.data.status === 'active' ? 'active' : 'archived', req.params.id);
  }
  if (parsed.data.password) {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const now = new Date().toISOString();
    db.prepare('UPDATE clients SET password_hash=? WHERE id=?').run(hash, req.params.id);
    db.prepare(
      "UPDATE users SET password_hash=?,password_changed_at=?,must_change_password=1,status='password_reset_required' WHERE client_id=?",
    ).run(hash, now, req.params.id);
    db.prepare('UPDATE refresh_sessions SET revoked_at=? WHERE user_id IN (SELECT id FROM users WHERE client_id=?)').run(
      now,
      req.params.id,
    );
  }
  audit(req.user!.id, 'update', 'client', req.params.id, { ...parsed.data, password: parsed.data.password ? '[changed]' : undefined });
  emitRefresh();
  res.json({ ok: true });
});

app.get('/api/support-tickets', requireAuth, (req: AuthedRequest, res) => {
  const query = z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
      status: z.enum(ticketStatuses).optional(),
      priority: z.enum(ticketPriorities).optional(),
      search: z.string().trim().max(100).optional(),
      sort: z.enum(['created_at', 'updated_at', 'priority', 'status']).default('updated_at'),
      order: z.enum(['asc', 'desc']).default('desc'),
    })
    .safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: query.error.issues[0].message });
  const user = req.user!;
  const where: string[] = [];
  const values: any[] = [];
  if (user.role !== 'admin') {
    where.push('user_id=?');
    values.push(user.id);
  }
  if (query.data.status) {
    where.push('status=?');
    values.push(query.data.status);
  }
  if (query.data.priority) {
    where.push('priority=?');
    values.push(query.data.priority);
  }
  if (query.data.search) {
    where.push('(subject LIKE ? OR ticket_number LIKE ?)');
    values.push(`%${query.data.search}%`, `%${query.data.search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) count FROM support_tickets ${whereSql}`).get(...values) as { count: number }).count;
  const offset = (query.data.page - 1) * query.data.limit;
  const rows = db
    .prepare(`SELECT * FROM support_tickets ${whereSql} ORDER BY ${query.data.sort} ${query.data.order.toUpperCase()} LIMIT ? OFFSET ?`)
    .all(...values, query.data.limit, offset) as any[];
  res.json({
    success: true,
    data: rows.map(mapTicket),
    pagination: { page: query.data.page, limit: query.data.limit, total, totalPages: Math.ceil(total / query.data.limit) },
  });
});

app.post('/api/support-tickets', requireAuth, upload.single('attachment'), async (req: AuthedRequest, res) => {
  const schema = z
    .object({
      subject: z.string().trim().min(3).max(200),
      category: z.enum(ticketCategories),
      priority: z.enum(ticketPriorities),
      description: z.string().trim().min(10).max(5000),
    })
    .strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    if (req.file) await fsp.rm(req.file.path, { force: true });
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const user = req.user!;
  const now = new Date().toISOString();
  let ticketNumber = '';
  try {
    const reserveTicket = db.transaction(() => {
      const ticketInfo = db
        .prepare(
          `INSERT INTO support_tickets (ticket_number,user_id,user_name,client_id,subject,category,priority,status,created_at,updated_at) VALUES (NULL,?,?,?,?,?,?,?, ?,?)`,
        )
        .run(user.id, user.name, user.clientId, parsed.data.subject, parsed.data.category, parsed.data.priority, 'Open', now, now);
      const ticketId = Number(ticketInfo.lastInsertRowid);
      const number = ticketNumberFor(ticketId);
      db.prepare('UPDATE support_tickets SET ticket_number=? WHERE id=?').run(number, ticketId);
      return { ticketId, number };
    });
    const reserved = reserveTicket();
    ticketNumber = reserved.number;
    const attachment = await prepareAttachment(req.file, ticketNumber);
    const finishTicket = db.transaction(() => {
      const messageInfo = db
        .prepare('INSERT INTO support_ticket_messages (ticket_id,author_id,author_name,author_role,body,created_at) VALUES (?,?,?,?,?,?)')
        .run(reserved.ticketId, user.id, user.name, user.role, parsed.data.description, now);
      if (attachment) {
        db.prepare(
          `INSERT INTO support_ticket_attachments (ticket_id,message_id,storage_provider,storage_key,file_name,stored_name,mime_type,file_extension,size_bytes,checksum,uploaded_by,related_entity_type,related_entity_id,scan_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          reserved.ticketId,
          Number(messageInfo.lastInsertRowid),
          'local',
          attachment.storageKey,
          attachment.fileName,
          attachment.storedName,
          attachment.mimeType,
          attachment.extension,
          attachment.sizeBytes,
          attachment.checksum,
          user.id,
          'support_ticket',
          ticketNumber,
          'pending',
          now,
        );
      }
    });
    finishTicket();
    audit(
      user.id,
      'create',
      'support_ticket',
      ticketNumber,
      { subject: parsed.data.subject, category: parsed.data.category, priority: parsed.data.priority, attachment: attachment?.fileName },
      { requestId: req.requestId, ipAddress: req.ip, actorRole: user.role },
    );
    emitRefresh({ userId: user.id, clientId: user.clientId || undefined, ticketNumber });
    return res.status(201).json({ ticket: mapTicket(getTicketRow(ticketNumber)) });
  } catch (error: any) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    if (ticketNumber)
      db.prepare(
        'DELETE FROM support_tickets WHERE ticket_number=? AND NOT EXISTS (SELECT 1 FROM support_ticket_messages WHERE ticket_id=support_tickets.id)',
      ).run(ticketNumber);
    return res.status(400).json({ error: error.message || 'Ticket could not be created' });
  }
});

app.get('/api/support-tickets/:ticketNumber', requireAuth, (req: AuthedRequest, res) => {
  const ticket = getTicketRow(req.params.ticketNumber);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!canAccessTicket(req.user!, ticket)) return res.status(403).json({ error: 'Ticket access denied' });
  res.json({ ticket: ticketDetail(ticket) });
});

app.post('/api/support-tickets/:ticketNumber/replies', requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const ticket = getTicketRow(req.params.ticketNumber);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!canAccessTicket(req.user!, ticket)) return res.status(403).json({ error: 'Ticket access denied' });
  if (ticket.status === 'Closed') return res.status(400).json({ error: 'This ticket has been closed.' });
  const user = req.user!;
  const now = new Date().toISOString();
  const nextStatus =
    user.role === 'admin'
      ? ticket.status === 'Open'
        ? 'In Progress'
        : ticket.status
      : ticket.status === 'Waiting for User' || ticket.status === 'Resolved'
        ? 'Open'
        : ticket.status;
  db.prepare('INSERT INTO support_ticket_messages (ticket_id,author_id,author_name,author_role,body,created_at) VALUES (?,?,?,?,?,?)').run(
    ticket.id,
    user.id,
    user.name,
    user.role,
    parsed.data.body,
    now,
  );
  db.prepare('UPDATE support_tickets SET status=?,updated_at=? WHERE id=?').run(nextStatus, now, ticket.id);
  audit(user.id, 'reply', 'support_ticket', ticket.ticket_number, { status: nextStatus });
  emitRefresh();
  res.status(201).json({ ticket: ticketDetail(getTicketRow(ticket.ticket_number)) });
});

app.patch('/api/support-tickets/:ticketNumber', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
  const parsed = z.object({ status: z.enum(ticketStatuses).optional(), priority: z.enum(ticketPriorities).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const entries = Object.entries(parsed.data);
  if (!entries.length) return res.status(400).json({ error: 'No changes supplied' });
  const ticket = getTicketRow(req.params.ticketNumber);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const sets: string[] = [];
  const values: any[] = [];
  if (parsed.data.status) {
    sets.push('status=?');
    values.push(parsed.data.status);
    sets.push('closed_at=?');
    values.push(parsed.data.status === 'Closed' ? new Date().toISOString() : null);
  }
  if (parsed.data.priority) {
    sets.push('priority=?');
    values.push(parsed.data.priority);
  }
  sets.push('updated_at=?');
  values.push(new Date().toISOString());
  db.prepare(`UPDATE support_tickets SET ${sets.join(',')} WHERE id=?`).run(...values, ticket.id);
  audit(req.user!.id, 'update', 'support_ticket', ticket.ticket_number, parsed.data);
  emitRefresh();
  res.json({ ticket: ticketDetail(getTicketRow(ticket.ticket_number)) });
});

app.get('/api/support-tickets/:ticketNumber/attachments/:attachmentId', requireAuth, (req: AuthedRequest, res) => {
  const row = db
    .prepare(
      `SELECT a.*,t.ticket_number,t.user_id FROM support_ticket_attachments a JOIN support_tickets t ON t.id=a.ticket_id WHERE t.ticket_number=? AND a.id=?`,
    )
    .get(req.params.ticketNumber, req.params.attachmentId) as any;
  if (!row) return res.status(404).json({ error: 'Attachment not found' });
  if (req.user!.role !== 'admin' && row.user_id !== req.user!.id) return res.status(403).json({ error: 'Attachment access denied' });
  if (!row.storage_key) return res.status(404).json({ error: 'Attachment file not found' });
  const filePath = path.resolve(config.uploadDir, row.storage_key);
  if (!filePath.startsWith(config.uploadDir)) return res.status(403).json({ error: 'Attachment access denied' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Attachment file not found' });
  const bytes = fs.readFileSync(filePath);
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', String(bytes.length));
  res.setHeader('Content-Disposition', `attachment; filename="${String(row.file_name).replace(/"/g, '')}"`);
  audit(
    req.user!.id,
    'download',
    'support_ticket_attachment',
    String(row.id),
    { ticketNumber: row.ticket_number, fileName: row.file_name },
    { requestId: req.requestId, ipAddress: req.ip, actorRole: req.user!.role },
  );
  res.send(bytes);
});

app.use('/api', (req: AuthedRequest, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', requestId: req.requestId },
  });
});

app.use((err: any, req: AuthedRequest, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  const code = status === 429 ? 'RATE_LIMITED' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
  req.log?.error({ err, errorCode: code }, 'Request failed');
  res.status(status).json({
    success: false,
    error: {
      code,
      message: status >= 500 ? 'An internal error occurred' : err?.message || 'Request failed',
      requestId: req.requestId,
    },
  });
});

const publicDir = [path.resolve(__dirname, 'public'), path.resolve(process.cwd(), 'client/dist')].find((candidate) =>
  fs.existsSync(path.join(candidate, 'index.html')),
);

if (publicDir) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || String(socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Authentication required'));
    const payload = verifyAccessToken(token);
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(payload.sub) as any;
    const active = assertActiveUser(row);
    if (!active.ok) return next(new Error(active.message));
    socket.data.user = authUserFromRow(row);
    next();
  } catch {
    next(new Error('Session expired or invalid'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user as AuthUser;
  socket.join(`user:${user.id}`);
  if (user.role === 'admin') socket.join('admin');
  if (user.clientId) socket.join(`client:${user.clientId}`);
  socket.emit('connected', { at: new Date().toISOString() });
});

const port = config.PORT;
const server = httpServer.listen(port, () => logger.info({ port }, `CI360 API running on http://localhost:${port}`));
let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  logger.info({ signal }, 'Graceful shutdown started');
  const timer = setTimeout(() => process.exit(1), 10000);
  server.close(() => {
    io.close(() => {
      db.close();
      clearTimeout(timer);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
