import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type AuthUser = { id: string; name: string; role: 'admin' | 'client'; clientId: string | null };
export interface AuthedRequest extends Request { user?: AuthUser }

const secret = () => process.env.JWT_SECRET || 'development-only-secret';
export const signToken = (user: AuthUser) => jwt.sign(user, secret(), { expiresIn: '12h' });

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(header.slice(7), secret()) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
