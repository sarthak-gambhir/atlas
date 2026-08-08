/**
 * The seeded public demo accounts (see scripts/seed-demo.ts). John is the login
 * behind the "Try the demo" buttons; Jane is a collaborator who never signs in.
 * These accounts are shared, so their identity and password are locked: a
 * visitor must not be able to rename the login (which would break the demo for
 * everyone) or change its password (which would lock everyone else out).
 */
export const DEMO_USERNAME = 'john.doe';
export const DEMO_COLLABORATOR_USERNAME = 'jane.doe';

export const DEMO_USERNAMES = [DEMO_USERNAME, DEMO_COLLABORATOR_USERNAME] as const;

/** Case-insensitive, matching the users table's `lower(username)` unique index. */
export function isDemoUsername(username: string): boolean {
  const lowered = username.toLowerCase();
  return DEMO_USERNAMES.some((name) => name.toLowerCase() === lowered);
}
