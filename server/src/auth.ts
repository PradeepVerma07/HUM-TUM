import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { config } from './env.js';

export type Role = 'admin' | 'client';
export type AuthUser = { id: string; name: string; role: Role; clientId: string | null; sessionId?: string; tokenId?: string };
export interface AuthedRequest extends Request {
  user?: AuthUser;
  requestId?: string;
}

type JwtPayload = jwt.JwtPayload & {
  sub: string;
  role: Role;
  name: string;
  clientId: string | null;
  sid?: string;
  jti: string;
};

export const passwordRules = {
  minLength: 12,
  maxLength: 128,
};

export function validatePasswordStrength(password: string) {
  if (password.length < passwordRules.minLength) return `Password must be at least ${passwordRules.minLength} characters.`;
  if (password.length > passwordRules.maxLength) return `Password must be ${passwordRules.maxLength} characters or fewer.`;
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol.';
  return null;
}

export function hashToken(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function signAccessToken(user: AuthUser, sessionId?: string) {
  const jti = crypto.randomUUID();
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      clientId: user.clientId,
      sid: sessionId,
      jti,
    },
    config.JWT_SECRET,
    {
      expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    },
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  }) as JwtPayload;
}

export function authUserFromRow(row: any): AuthUser {
  return { id: row.id, name: row.name, role: row.role, clientId: row.client_id };
}

export function assertActiveUser(row: any) {
  if (!row) return { ok: false, code: 401, message: 'Authentication required' } as const;
  if (row.status === 'archived' || row.status === 'suspended') return { ok: false, code: 403, message: 'Account is not active' } as const;
  if ((row.status === 'locked' || row.locked_until) && (!row.locked_until || new Date(row.locked_until).getTime() > Date.now()))
    return { ok: false, code: 403, message: 'Account is temporarily locked' } as const;
  return { ok: true } as const;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = verifyAccessToken(header.slice(7));
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(payload.sub) as any;
    const active = assertActiveUser(row);
    if (!active.ok) return res.status(active.code).json({ error: active.message });
    if (payload.sid) {
      const session = db
        .prepare('SELECT id FROM refresh_sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?')
        .get(payload.sid, payload.sub, new Date().toISOString());
      if (!session) return res.status(401).json({ error: 'Session expired or invalid' });
    }
    req.user = { ...authUserFromRow(row), sessionId: payload.sid, tokenId: payload.jti };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireClient = requireRole('client');
