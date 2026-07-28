import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { z } from 'zod';
import { db, initialiseDatabase, audit } from './db.js';
import { requireAdmin, requireAuth, signToken, type AuthedRequest } from './auth.js';
import { calculateHours } from './tat.js';

initialiseDatabase();
const app = express();
const httpServer = createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io = new Server(httpServer, { cors: { origin } });
app.use(helmet());
app.use(cors({ origin }));
app.use(express.json({ limit: '1mb' }));

const emitRefresh = () => io.emit('data:changed', { at: new Date().toISOString() });
const settings = () => JSON.parse((db.prepare('SELECT json FROM settings WHERE id=1').get() as { json: string }).json);
const categoryLoad = () => {
  const rows = db.prepare("SELECT category,COUNT(*) count FROM jobs WHERE status!='completed' AND status!='cancelled' GROUP BY category").all() as Array<{category:string;count:number}>;
  return Object.fromEntries(rows.map(row => [row.category, row.count]));
};
const mapJob = (row: any) => ({
  id:row.id, clientId:row.client_id, title:row.title, description:row.description, category:row.category,
  priority:row.priority, postedBy:row.posted_by, assetLink:row.asset_link, calculatedHours:row.calculated_hours,
  teamOverrideHours:row.team_override_hours, teamOverrideNote:row.team_override_note, status:row.status,
  datePosted:row.date_posted, dateCompleted:row.date_completed, updatedAt:row.updated_at
});

app.get('/api/health', (_req,res) => res.json({ ok:true }));
app.post('/api/auth/login', async (req,res) => {
  const parsed = z.object({ id:z.string().min(1), password:z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'ID and password are required' });
  const user = db.prepare("SELECT * FROM users WHERE id=? AND status='active'").get(parsed.data.id) as any;
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error:'Incorrect ID or password' });
  const authUser = { id:user.id, name:user.name, role:user.role, clientId:user.client_id } as const;
  res.json({ token:signToken(authUser), user:authUser });
});

app.get('/api/bootstrap', requireAuth, (req:AuthedRequest,res) => {
  const user = req.user!;
  const jobRows = user.role==='admin'
    ? db.prepare('SELECT * FROM jobs ORDER BY date_posted DESC').all()
    : db.prepare('SELECT * FROM jobs WHERE client_id=? ORDER BY date_posted DESC').all(user.clientId);
  const clients = user.role==='admin' ? db.prepare("SELECT id,name,status,created_at createdAt FROM clients ORDER BY name").all() : [];
  res.json({ user, jobs:jobRows.map(mapJob), clients, settings:settings(), categoryLoad:categoryLoad() });
});

app.post('/api/jobs', requireAuth, (req:AuthedRequest,res) => {
  const schema=z.object({ clientId:z.string().optional(),title:z.string().min(2),description:z.string().default(''),category:z.string().min(1),priority:z.enum(['Low','Medium','High','Urgent']),postedBy:z.string().min(2),assetLink:z.string().default('') });
  const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0].message});
  const user=req.user!; const clientId=user.role==='admin'?parsed.data.clientId:user.clientId;
  if(!clientId) return res.status(400).json({error:'Client is required'});
  const client=db.prepare("SELECT id FROM clients WHERE id=? AND status='active'").get(clientId); if(!client) return res.status(400).json({error:'Active client not found'});
  const id='j'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); const now=new Date().toISOString();
  const calculatedHours=calculateHours(settings(),categoryLoad(),parsed.data.category,parsed.data.priority);
  db.prepare(`INSERT INTO jobs (id,client_id,title,description,category,priority,posted_by,asset_link,calculated_hours,status,date_posted,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'submitted',?,?)`)
    .run(id,clientId,parsed.data.title,parsed.data.description,parsed.data.category,parsed.data.priority,parsed.data.postedBy,parsed.data.assetLink,calculatedHours,now,now);
  audit(user.id,'create','job',id,parsed.data); emitRefresh();
  res.status(201).json({ job:mapJob(db.prepare('SELECT * FROM jobs WHERE id=?').get(id)) });
});

app.patch('/api/jobs/:id', requireAuth, requireAdmin, (req:AuthedRequest,res) => {
  const schema=z.object({ title:z.string().min(2).optional(),description:z.string().optional(),category:z.string().optional(),priority:z.enum(['Low','Medium','High','Urgent']).optional(),status:z.enum(['submitted','under_review','in_progress','waiting_client','revision_requested','on_hold','completed','cancelled']).optional(),assetLink:z.string().optional(),teamOverrideHours:z.number().positive().nullable().optional(),teamOverrideNote:z.string().optional() });
  const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0].message});
  const current=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any; if(!current) return res.status(404).json({error:'Job not found'});
  const map:Record<string,string>={title:'title',description:'description',category:'category',priority:'priority',status:'status',assetLink:'asset_link',teamOverrideHours:'team_override_hours',teamOverrideNote:'team_override_note'};
  const entries=Object.entries(parsed.data); if(!entries.length) return res.status(400).json({error:'No changes supplied'});
  const sets=entries.map(([key])=>`${map[key]}=?`); const values=entries.map(([,value])=>value);
  sets.push('updated_at=?'); values.push(new Date().toISOString());
  if(parsed.data.status==='completed'){sets.push('date_completed=?');values.push(new Date().toISOString());}
  if(parsed.data.status && parsed.data.status!=='completed'){sets.push('date_completed=NULL');}
  db.prepare(`UPDATE jobs SET ${sets.join(',')} WHERE id=?`).run(...values,req.params.id);
  audit(req.user!.id,'update','job',req.params.id,parsed.data); emitRefresh();
  res.json({job:mapJob(db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id))});
});

app.put('/api/settings', requireAuth, requireAdmin, (req:AuthedRequest,res) => {
  const schema=z.object({categories:z.array(z.object({name:z.string().min(1),baseHours:z.number().positive()})).min(1),capacityPerCategory:z.number().int().positive(),bufferHoursPerExtraJob:z.number().nonnegative(),startHour:z.number().min(0).max(24),endHour:z.number().min(0).max(24),workDays:z.array(z.number().int().min(0).max(6)).min(1)});
  const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0].message});
  db.prepare('UPDATE settings SET json=? WHERE id=1').run(JSON.stringify(parsed.data)); audit(req.user!.id,'update','settings','1',parsed.data); emitRefresh(); res.json({settings:parsed.data});
});

app.post('/api/clients', requireAuth, requireAdmin, async (req:AuthedRequest,res) => {
  const parsed=z.object({id:z.string().regex(/^[a-z0-9_-]+$/),name:z.string().min(2),password:z.string().min(6)}).safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0].message});
  if(db.prepare('SELECT id FROM clients WHERE id=?').get(parsed.data.id)) return res.status(409).json({error:'Client ID already exists'});
  const hash=await bcrypt.hash(parsed.data.password,12); const tx=db.transaction(()=>{db.prepare('INSERT INTO clients (id,name,password_hash) VALUES (?,?,?)').run(parsed.data.id,parsed.data.name,hash);db.prepare("INSERT INTO users (id,name,password_hash,role,client_id) VALUES (?,?,?,'client',?)").run(parsed.data.id,parsed.data.name,hash,parsed.data.id);}); tx();
  audit(req.user!.id,'create','client',parsed.data.id,{name:parsed.data.name}); emitRefresh(); res.status(201).json({ok:true});
});

app.patch('/api/clients/:id', requireAuth, requireAdmin, async (req:AuthedRequest,res) => {
  const parsed=z.object({name:z.string().min(2).optional(),password:z.string().min(6).optional(),status:z.enum(['active','archived']).optional()}).safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0].message});
  const client=db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id); if(!client) return res.status(404).json({error:'Client not found'});
  if(parsed.data.name){db.prepare('UPDATE clients SET name=? WHERE id=?').run(parsed.data.name,req.params.id);db.prepare('UPDATE users SET name=? WHERE client_id=?').run(parsed.data.name,req.params.id);}
  if(parsed.data.status){db.prepare('UPDATE clients SET status=? WHERE id=?').run(parsed.data.status,req.params.id);db.prepare('UPDATE users SET status=? WHERE client_id=?').run(parsed.data.status==='active'?'active':'archived',req.params.id);}
  if(parsed.data.password){const hash=await bcrypt.hash(parsed.data.password,12);db.prepare('UPDATE clients SET password_hash=? WHERE id=?').run(hash,req.params.id);db.prepare('UPDATE users SET password_hash=? WHERE client_id=?').run(hash,req.params.id);}
  audit(req.user!.id,'update','client',req.params.id,{...parsed.data,password:parsed.data.password?'[changed]':undefined}); emitRefresh(); res.json({ok:true});
});

const publicDir = [
  path.resolve(__dirname, 'public'),
  path.resolve(process.cwd(), 'client/dist')
].find(candidate => fs.existsSync(path.join(candidate, 'index.html')));

if (publicDir) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

io.on('connection', socket => { socket.emit('connected', { at:new Date().toISOString() }); });
const port=Number(process.env.PORT||4000); httpServer.listen(port,()=>console.log(`CI360 API running on http://localhost:${port}`));
