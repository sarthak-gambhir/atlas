import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.ts';

describe('password hashing', () => {
  it('accepts the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('Correct horse battery staple', hash)).resolves.toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
    await expect(verifyPassword('same', a)).resolves.toBe(true);
    await expect(verifyPassword('same', b)).resolves.toBe(true);
  });

  it('records the cost parameters in the encoded hash', async () => {
    const hash = await hashPassword('whatever');
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('handles unicode passwords consistently', async () => {
    const hash = await hashPassword('pässwörd-日本語-🔑');
    await expect(verifyPassword('pässwörd-日本語-🔑', hash)).resolves.toBe(true);
  });

  it('returns false instead of throwing on malformed stored hashes', async () => {
    for (const bad of ['', 'not-a-hash', 'scrypt$1$2$3', 'bcrypt$16384$8$1$c2FsdA==$aGFzaA==']) {
      await expect(verifyPassword('anything', bad)).resolves.toBe(false);
    }
  });
});
