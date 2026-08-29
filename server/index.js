import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db, initDatabase, memDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'humtum_secret_key_2026_!#';
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer for media uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    credentials: true
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Seed Demo Users if in-memory
const seedHash = bcrypt.hashSync('HumTum@2026!', 10);
const demoUsers = [
  {
    id: 'user_priya',
    username: 'priya.verma',
    display_name: 'Priya Verma',
    email: 'priya@humtum.chat',
    password_hash: seedHash,
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    bio: 'Hey there! I am using HUM–TUM ✨',
    is_online: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'user_aarav',
    username: 'aarav.sharma',
    display_name: 'Aarav Sharma',
    email: 'aarav@humtum.chat',
    password_hash: seedHash,
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    bio: 'Coding the future 🚀',
    is_online: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'user_rohit',
    username: 'rohit.mehta',
    display_name: 'Rohit Mehta',
    email: 'rohit@humtum.chat',
    password_hash: seedHash,
    avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
    bio: 'Coffee, code, repeat ☕',
    is_online: false,
    created_at: new Date().toISOString()
  }
];

for (const u of demoUsers) {
  memDb.users.set(u.id, u);
}

// Seed Demo Conversation
memDb.conversations.set('conv_priya', {
  id: 'conv_priya',
  type: 'DIRECT',
  participant_ids: ['user_priya', 'user_aarav'],
  created_at: new Date().toISOString()
});

memDb.messages.set('conv_priya', [
  {
    id: 'msg_1',
    conversation_id: 'conv_priya',
    sender_id: 'user_priya',
    type: 'TEXT',
    content: 'Welcome to HUM–TUM WhatsApp Clone! Pure Node.js & React 💜✨',
    status: 'READ',
    created_at: new Date(Date.now() - 60000).toISOString()
  }
]);

// JWT Helper
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, displayName: user.display_name }, JWT_SECRET, {
    expiresIn: '7d'
  });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.humtum_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const { username, displayName, email, password } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ message: 'Username, Name and Password are required' });
  }

  const cleanUser = username.toLowerCase().trim().replace(/\s/g, '');

  if (!db.isMemory()) {
    try {
      const existing = await db.query('SELECT id FROM humtum_users WHERE username = ?', [cleanUser]);
      if (existing.length > 0) return res.status(400).json({ message: 'Username is already taken' });

      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        'INSERT INTO humtum_users (id, username, display_name, email, password_hash, bio) VALUES (?, ?, ?, ?, ?, ?)',
        [id, cleanUser, displayName, email || null, hash, 'Hey there! I am using HUM–TUM ✨']
      );

      const user = { id, username: cleanUser, display_name: displayName, email, bio: 'Hey there! I am using HUM–TUM ✨' };
      const token = generateToken(user);
      res.cookie('humtum_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.status(201).json({ user, token });
    } catch (err) {
      console.error(err);
    }
  }

  // Fallback to memory
  for (const u of memDb.users.values()) {
    if (u.username === cleanUser) return res.status(400).json({ message: 'Username is already taken' });
  }

  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const hash = await bcrypt.hash(password, 10);
  const newUser = {
    id,
    username: cleanUser,
    display_name: displayName,
    email,
    password_hash: hash,
    bio: 'Hey there! I am using HUM–TUM ✨',
    is_online: true,
    created_at: new Date().toISOString()
  };
  memDb.users.set(id, newUser);

  const token = generateToken(newUser);
  res.cookie('humtum_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  const { password_hash: _, ...safe } = newUser;
  return res.status(201).json({ user: safe, token });
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) return res.status(400).json({ message: 'Credentials required' });

  const query = usernameOrEmail.toLowerCase().trim();

  if (!db.isMemory()) {
    try {
      const rows = await db.query(
        'SELECT * FROM humtum_users WHERE username = ? OR email = ? LIMIT 1',
        [query, query]
      );
      if (rows.length > 0) {
        const u = rows[0];
        const match = await bcrypt.compare(password, u.password_hash);
        if (match) {
          await db.query('UPDATE humtum_users SET is_online = TRUE WHERE id = ?', [u.id]);
          const token = generateToken(u);
          res.cookie('humtum_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
          const { password_hash: _, ...safe } = u;
          return res.json({ user: safe, token });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Memory fallback
  for (const u of memDb.users.values()) {
    if (u.username === query || (u.email && u.email.toLowerCase() === query)) {
      const match = await bcrypt.compare(password, u.password_hash);
      if (match) {
        u.is_online = true;
        const token = generateToken(u);
        res.cookie('humtum_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        const { password_hash: _, ...safe } = u;
        return res.json({ user: safe, token });
      }
    }
  }

  return res.status(401).json({ message: 'Invalid username or password' });
});

// 3. Auth: Current User
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  if (!db.isMemory()) {
    try {
      const rows = await db.query('SELECT * FROM humtum_users WHERE id = ?', [req.user.id]);
      if (rows.length > 0) {
        const { password_hash: _, ...safe } = rows[0];
        return res.json({ user: safe });
      }
    } catch (err) {
      console.error(err);
    }
  }

  const u = memDb.users.get(req.user.id);
  if (u) {
    const { password_hash: _, ...safe } = u;
    return res.json({ user: safe });
  }
  return res.status(404).json({ message: 'User not found' });
});

// 4. Auth: Logout
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('humtum_token');
  return res.json({ success: true });
});

// 5. Users: Search
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  const list = [];
  for (const u of memDb.users.values()) {
    if (u.id !== req.user.id) {
      if (!q || u.username.includes(q) || u.display_name.toLowerCase().includes(q)) {
        const { password_hash: _, ...safe } = u;
        list.push(safe);
      }
    }
  }
  return res.json({ users: list });
});

// 6. Users: Update Profile
app.patch('/api/users/profile', authMiddleware, async (req, res) => {
  const { displayName, bio, avatarUrl } = req.body;
  const u = memDb.users.get(req.user.id);
  if (u) {
    if (displayName) u.display_name = displayName;
    if (bio !== undefined) u.bio = bio;
    if (avatarUrl) u.avatar_url = avatarUrl;
    const { password_hash: _, ...safe } = u;
    return res.json({ user: safe });
  }
  return res.status(404).json({ message: 'User not found' });
});

// 7. Conversations: List
app.get('/api/conversations', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const result = [];

  for (const conv of memDb.conversations.values()) {
    if (conv.participant_ids?.includes(userId)) {
      const otherId = conv.participant_ids.find((id) => id !== userId);
      const otherUser = otherId ? memDb.users.get(otherId) : null;
      const msgs = memDb.messages.get(conv.id) || [];
      const lastMessage = msgs[msgs.length - 1] || null;

      let safeOther = null;
      if (otherUser) {
        const { password_hash: _, ...s } = otherUser;
        safeOther = s;
      }

      result.push({
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatar_url: conv.avatar_url,
        otherParticipant: safeOther,
        lastMessage,
        unreadCount: 0
      });
    }
  }

  return res.json({ conversations: result });
});

// 8. Messages: Get by conversation
app.get('/api/messages/:conversationId', authMiddleware, (req, res) => {
  const convId = req.params.conversationId;
  const msgs = memDb.messages.get(convId) || [];
  return res.json({ messages: msgs });
});

// 9. Stories / Statuses: Feed
app.get('/api/stories', authMiddleware, (_req, res) => {
  const feed = [];
  for (const u of memDb.users.values()) {
    const { password_hash: _, ...safeUser } = u;
    feed.push({
      user: safeUser,
      stories: [
        {
          id: `story_${u.id}`,
          caption: 'HUM–TUM pure JS WhatsApp clone is running! 💜✨',
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
          created_at: new Date().toISOString()
        }
      ]
    });
  }
  return res.json({ feed });
});

// 10. File Uploads
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided' });
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({
    fileUrl,
    fileName: req.file.originalname,
    size: req.file.size
  });
});

// -------------------------------------------------------------
// Realtime Socket.IO Handling
// -------------------------------------------------------------
io.on('connection', (socket) => {
  let activeUserId = null;

  socket.on('user:join', (userId) => {
    activeUserId = userId;
    socket.join(`user_${userId}`);
    io.emit('presence:update', { userId, isOnline: true });
  });

  socket.on('conversation:join', (convId) => {
    socket.join(`conv_${convId}`);
  });

  socket.on('typing:start', (data) => {
    socket.to(`conv_${data.conversationId}`).emit('typing:status', {
      conversationId: data.conversationId,
      username: data.username,
      isTyping: true
    });
  });

  socket.on('typing:stop', (data) => {
    socket.to(`conv_${data.conversationId}`).emit('typing:status', {
      conversationId: data.conversationId,
      username: data.username,
      isTyping: false
    });
  });

  socket.on('message:send', (data) => {
    const msg = {
      id: data.id || `msg_${Date.now()}`,
      conversation_id: data.conversationId,
      sender_id: data.senderId || activeUserId,
      type: data.type || 'TEXT',
      content: data.content || '',
      media_url: data.mediaUrl || null,
      status: 'SENT',
      created_at: new Date().toISOString()
    };

    const list = memDb.messages.get(data.conversationId) || [];
    list.push(msg);
    memDb.messages.set(data.conversationId, list);

    io.to(`conv_${data.conversationId}`).emit('message:receive', msg);
  });

  socket.on('call:start', (data) => {
    io.to(`user_${data.targetUserId}`).emit('call:incoming', data);
  });

  socket.on('call:accept', (data) => {
    io.to(`user_${data.callerId}`).emit('call:accepted', data);
  });

  socket.on('call:reject', (data) => {
    io.to(`user_${data.callerId}`).emit('call:rejected', data);
  });

  socket.on('call:end', (data) => {
    io.to(`conv_${data.conversationId}`).emit('call:ended', data);
  });

  socket.on('disconnect', () => {
    if (activeUserId) {
      io.emit('presence:update', { userId: activeUserId, isOnline: false });
    }
  });
});

// Serve Compiled React Vite App
const publicPaths = [
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, 'dist/public'),
  path.resolve(__dirname, 'public')
];

for (const p of publicPaths) {
  if (fs.existsSync(p)) {
    app.use(express.static(p));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(p, 'index.html'));
    });
    break;
  }
}

// Start Server & Init MySQL
httpServer.listen(PORT, async () => {
  console.log(`🚀 HUM–TUM WhatsApp Clone Server running on http://localhost:${PORT}`);
  await initDatabase();
});
