import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** ~16 MB of memory per hash, the widely used interactive-login parameters. */
const COST = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function maxmemFor(n: number, r: number): number {
  // Node's default cap is 32 MB, which N=16384 r=8 sits just under; give scrypt
  // double the requirement so raising the cost later does not silently throw.
  return 256 * n * r;
}

/** Encodes as scrypt$N$r$p$salt$hash so the cost can be raised without a migration. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...COST,
    maxmem: maxmemFor(COST.N, COST.r),
  });

  return [
    'scrypt',
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/** False rather than throwing on malformed input, so a corrupt row cannot 500 a login. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const n = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(rawSalt, 'base64');
  const expected = Buffer.from(rawKey, 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const actual = await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: maxmemFor(n, r),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification. Called when no user
 * matches, so response time does not reveal which usernames exist.
 */
export async function fakeVerify(): Promise<void> {
  await hashPassword('timing-equalizer');
}
