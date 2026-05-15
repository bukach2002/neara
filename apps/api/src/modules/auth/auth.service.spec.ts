import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('hashes tokens deterministically without storing the raw token shape', () => {
    const service = new AuthService({} as never, {} as never, {} as never, {} as never);

    const hash = service['hashToken']('reset-token');

    expect(hash).toHaveLength(64);
    expect(hash).toBe(service['hashToken']('reset-token'));
    expect(hash).not.toContain('reset-token');
  });
});
