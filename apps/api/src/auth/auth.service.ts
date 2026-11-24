import { HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { apiError } from '../common/errors.js';
import { Prisma, type Session, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { type SessionMeta, SessionService } from './session.service.js';

const INVALID_CREDENTIALS = () =>
  apiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

export interface SignedIn {
  user: User;
  token: string;
  session: Session;
}

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verified against when the email is unknown, so both failure paths cost one argon2 verify. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('not-a-real-password', { type: argon2.argon2id });
  }

  async register(dto: RegisterDto, meta: SessionMeta): Promise<SignedIn> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    let user: User;
    try {
      user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email, passwordHash } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw apiError(HttpStatus.CONFLICT, 'EMAIL_IN_USE', 'An account with this email already exists');
      }
      throw error;
    }
    const { token, session } = await this.sessions.create(user.id, meta);
    return { user, token, session };
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<SignedIn> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await argon2.verify(user?.passwordHash ?? this.dummyHash, dto.password).catch(() => false);
    if (!user || !ok) throw INVALID_CREDENTIALS();
    const { token, session } = await this.sessions.create(user.id, meta);
    return { user, token, session };
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }

  logoutAll(userId: string): Promise<number> {
    return this.sessions.revokeAllForUser(userId);
  }
}
