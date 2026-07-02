import type { AuthenticatedUser } from '../../middleware/auth';

export function getMinistryId(user: AuthenticatedUser | undefined): string | null {
  return user?.ministryId || null;
}

export function getUserId(user: AuthenticatedUser | undefined): string | null {
  return user?.id || null;
}