import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const TOKEN_COOKIE = 'locoverse_token';

export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  if (cookieToken) return cookieToken;
  return null;
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(req: Request): string | undefined {
  const token = getTokenFromRequest(req);
  if (!token) return undefined;
  return verifyToken(token)?.userId;
}
