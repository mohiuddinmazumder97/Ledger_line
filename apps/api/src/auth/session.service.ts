import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Session, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SESSION_SLIDE_INTERVAL_MS, SESSION_TTL_MS } from './auth.types.js';

export interface SessionMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface ValidatedSession {
  session: Session;
  user: User;
  /** True when this call slid the expiry (the cookie should be re-issued). */
  refreshed: boolean;
}

/** 32 random bytes → base64url is 43 characters; anything far longer is not ours. */
const MAX_TOKEN_LENGTH = 128;

/** Hex SHA-256. A fast hash is right here: the token has 256 bits of entropy, unlike a password. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Opaque DB sessions. The raw token only ever exists in the client's cookie / keychain and in
 * the response that hands it out; the database stores its SHA-256.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, meta: SessionMeta = {}): Promise<{ token: string; session: Session }> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        lastUsedAt: now,
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
        ip: meta.ip ?? null,
      },
    });
    return { token, session };
  }

  /** Null for unknown, revoked or expired tokens. Slides the expiry at most once per hour. */
  async validate(token: string, now = new Date()): Promise<ValidatedSession | null> {
    if (!token || token.length > MAX_TOKEN_LENGTH) return null;
    const found = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!found || found.revokedAt || found.expiresAt <= now) return null;

    const { user, ...session } = found;
    if (now.getTime() - session.lastUsedAt.getTime() < SESSION_SLIDE_INTERVAL_MS) {
      return { session, user, refreshed: false };
    }
    const slid = await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
    });
    return { session: slid, user, refreshed: true };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }
}
