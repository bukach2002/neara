import { randomToken, hashToken } from './token.service';

describe('password reset token hashing', () => {
  it('hashes tokens deterministically without storing the raw token shape', () => {
    const token = randomToken();

    const hash = hashToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it('never repeats generated tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
  });
});
