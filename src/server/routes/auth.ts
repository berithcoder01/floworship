import { FastifyInstance } from 'fastify';
import { prisma } from '../db';
import {
  hashPassword,
  verifyPassword,
  createTokens,
  refreshTokens,
  revokeRefreshToken,
  revokeAllUserTokens,
  createSession,
  revokeSession,
  getUserSessions,
  generateToken,
} from '../services/auth';
import { signToken, authMiddleware } from '../middleware/auth';
import { createRateLimitMiddleware, resetRateLimit } from '../middleware/rateLimit';

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface RefreshBody {
  refreshToken: string;
}

interface LogoutBody {
  refreshToken: string;
}

function setCookies(reply: any, accessToken: string, refreshToken: string) {
  reply.setCookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60,
  });

  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function authRoutes(fastify: FastifyInstance) {
  const rateLimit = createRateLimitMiddleware();

  // Login
  fastify.post<{ Body: LoginBody }>('/auth/login', { preHandler: rateLimit }, async (request: any, reply: any) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(user.passwordHash, password);

    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    resetRateLimit(`${request.ip}:${email}`);

    const tokens = await createTokens(user.id);
    await createSession(user.id, request.headers['user-agent'], request.ip);

    const membership = await prisma.ministryMember.findFirst({
      where: { userId: user.id },
    });

    const accessToken = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: membership?.role as any || 'musician',
      ministryId: membership?.ministryId,
      exp: tokens.accessTokenExpiresAt.getTime(),
    });

    setCookies(reply, accessToken, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name },
    };
  });

  // Register
  fastify.post<{ Body: RegisterBody }>('/auth/register', async (request: any, reply: any) => {
    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Email, password and name are required' });
    }

    const ministryCount = await prisma.ministry.count();

    if (ministryCount > 0) {
      return reply.status(403).send({
        error: 'Registration is closed. Please use an invite link.',
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const ministry = await prisma.ministry.create({
      data: { name: `${name}'s Ministry` },
    });

    await prisma.ministryMember.create({
      data: {
        userId: user.id,
        ministryId: ministry.id,
        role: 'admin',
      },
    });

    const tokens = await createTokens(user.id);
    await createSession(user.id, request.headers['user-agent'], request.ip);

    const accessToken = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'musician',
      ministryId: ministry?.id,
      exp: tokens.accessTokenExpiresAt.getTime(),
    });

    setCookies(reply, accessToken, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      ministry: { id: ministry.id, name: ministry.name, role: 'admin' },
    };
  });

  // Refresh token
  fastify.post<{ Body: RefreshBody }>('/auth/refresh', async (request: any, reply: any) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token is required' });
    }

    const tokens = await refreshTokens(refreshToken);

    if (!tokens) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: tokens.userId } });
    const membership = user ? await prisma.ministryMember.findFirst({ where: { userId: user.id } }) : null;

    const accessToken = signToken({
      userId: tokens.userId,
      email: user?.email || '',
      name: user?.name || '',
      role: membership?.role as any || 'musician',
      ministryId: membership?.ministryId,
      exp: tokens.accessTokenExpiresAt.getTime(),
    });

    setCookies(reply, accessToken, tokens.refreshToken);

    return { success: true };
  });

  // Logout
  fastify.post<{ Body: LogoutBody }>('/auth/logout', async (request: any, reply: any) => {
    const { refreshToken } = request.body;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });

    return { success: true };
  });

  // Get user sessions
  fastify.get('/auth/sessions', { preHandler: [authMiddleware] }, async (request: any) => {
    const user = request.user;
    if (!user) return [];

    const sessions = await getUserSessions(user.id);

    return sessions.map((s: any) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));
  });

  // Revoke session
  fastify.delete('/auth/sessions/:sessionId', { preHandler: [authMiddleware] }, async (request: any) => {
    const { sessionId } = request.params;
    await revokeSession(sessionId);
    return { success: true };
  });

  // Get current user
  fastify.get('/auth/me', { preHandler: [authMiddleware] }, async (request: any) => {
    const authUser = request.user;
    if (!authUser) return null;

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { ministryMembers: true },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      ministries: user.ministryMembers.map((m: any) => ({
        ministryId: m.ministryId,
        role: m.role,
      })),
    };
  });

  // Password reset request
  fastify.post<{ Body: { email: string } }>(
    '/auth/password-reset/request',
    { preHandler: rateLimit },
    async (request: any, reply: any) => {
      const { email } = request.body;

      if (!email) {
        return reply.status(400).send({ error: 'Email is required' });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await prisma.passwordResetToken.create({
          data: {
            token,
            userId: user.id,
            expiresAt,
          },
        });

      }

      return { message: 'If an account exists, a reset link was sent.' };
    }
  );

  // Password reset confirm
  fastify.post<{ Body: { token: string; newPassword: string } }>(
    '/auth/password-reset/confirm',
    async (request: any, reply: any) => {
      const { token, newPassword } = request.body;

      if (!token || !newPassword) {
        return reply.status(400).send({ error: 'Token and new password are required' });
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

      if (!resetToken) {
        return reply.status(400).send({ error: 'Invalid token' });
      }

      if (resetToken.usedAt) {
        return reply.status(400).send({ error: 'Token already used' });
      }

      if (resetToken.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Token expired' });
      }

      const passwordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      await revokeAllUserTokens(resetToken.userId);

      return { message: 'Password updated successfully' };
    }
  );

  // Create invite (admin/operator only)
  fastify.post<{
    Body: { email: string; role?: string; ministryId?: string };
  }>('/auth/invite', { preHandler: [authMiddleware] }, async (request: any) => {
    const { email, role = 'musician', ministryId } = request.body;
    const authUser = request.user;

    if (!authUser) return null;

    if (!['admin', 'operator', 'leader'].includes(authUser.role)) {
      return { error: 'Forbidden' };
    }

    const effectiveMinistryId = ministryId || authUser.ministryId;
    if (!effectiveMinistryId) {
      return { error: 'Ministry ID required' };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.ministryMember.findUnique({
        where: { userId_ministryId: { userId: existingUser.id, ministryId: effectiveMinistryId } },
      });
      if (existingMembership) {
        return { error: 'User is already a member' };
      }
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invite.create({
      data: {
        token,
        email,
        role,
        ministryId: effectiveMinistryId,
        expiresAt,
        invitedById: authUser.id,
      },
    });

    return { token, expiresAt };
  });

  // List invites for ministry (admin/operator only)
  fastify.get('/auth/invites', { preHandler: [authMiddleware] }, async (request: any) => {
    const authUser = request.user;
    if (!authUser?.ministryId) return [];

    const invites = await prisma.invite.findMany({
      where: { ministryId: authUser.ministryId },
      orderBy: { createdAt: 'desc' },
    });

    return invites;
  });

  // Accept invite
  fastify.post<{
    Body: { token: string; name: string; password: string };
  }>('/auth/invite/accept', async (request: any, reply: any) => {
    const { token, name, password } = request.body;

    if (!token || !name || !password) {
      return reply.status(400).send({ error: 'Token, name, and password are required' });
    }

    const invite = await prisma.invite.findUnique({ where: { token } });

    if (!invite) {
      return reply.status(404).send({ error: 'Invite not found' });
    }

    if (invite.usedAt) {
      return reply.status(400).send({ error: 'Invite already used' });
    }

    if (invite.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'Invite expired' });
    }

    const passwordHash = await hashPassword(password);

    let user = await prisma.user.findUnique({ where: { email: invite.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: invite.email,
          name,
          passwordHash,
        },
      });
    }

    await prisma.ministryMember.create({
      data: {
        userId: user.id,
        ministryId: invite.ministryId,
        role: invite.role,
      },
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedByUserId: user.id },
    });

    const tokens = await createTokens(user.id);
    await createSession(user.id, request.headers['user-agent'], request.ip);

    const accessToken = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'musician',
      exp: tokens.accessTokenExpiresAt.getTime(),
    });

    setCookies(reply, accessToken, tokens.refreshToken);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  });
}