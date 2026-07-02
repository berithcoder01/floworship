import { prisma } from '../../db';
import { generateToken } from './utils';
export { hashPassword, verifyPassword, generateToken, generateTokens } from './utils';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TokenPair {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface UserWithRole {
  id: string;
  email: string;
  name: string;
  ministryId?: string;
  role?: string;
}

export async function createTokens(userId: string): Promise<TokenPair> {
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const refreshToken = generateToken();

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: refreshTokenExpiresAt,
    },
  });

  return {
    userId,
    accessToken: generateToken(),
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

export async function refreshTokens(
  refreshToken: string
): Promise<TokenPair | null> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!storedToken) {
    return null;
  }

  if (storedToken.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: storedToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (storedToken.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  return createTokens(storedToken.userId);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createSession(
  userId: string,
  userAgent?: string,
  ip?: string
): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      userAgent,
      ip,
    },
  });
  return session.id;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } });
}

export async function getUserSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}