const request = require('supertest');
const { sequelize, resetMutableTables } = require('../helpers/db');
const { app, signup, refresh, me } = require('../helpers/auth');
const userRepository = require('../../src/repositories/user.repository');

beforeEach(async () => {
  await resetMutableTables();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /auth/refresh-token', () => {
  it('rotates the refresh token: issues a new pair and invalidates the old one', async () => {
    const { cookies: stage1 } = await signup();

    const { res, cookies: stage2 } = await refresh(stage1.refreshToken);

    expect(res.status).toBe(200);
    expect(stage2.refreshToken).toBeTruthy();
    expect(stage2.refreshToken).not.toBe(stage1.refreshToken);
    // Not asserting the access token string differs from stage1: a JWT is a
    // deterministic function of its claims, and signup+refresh here happen
    // within the same second, so an identical {sub, roles, sid, iat} payload
    // legitimately produces byte-identical tokens. That's not a security issue.

    // The old (now-rotated) token must never work again.
    const replay = await refresh(stage1.refreshToken);
    expect(replay.res.status).toBe(401);
  });

  it('the newly issued access token from a rotation actually authenticates', async () => {
    const { cookies: stage1 } = await signup();
    const { cookies: stage2 } = await refresh(stage1.refreshToken);

    const { res } = await me(stage2.accessToken);
    expect(res.status).toBe(200);
  });

  it('rejects a missing refresh token', async () => {
    const { res } = await refresh(undefined);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/missing/i);
  });

  it('rejects a refresh token that was never issued', async () => {
    const { res } = await refresh('a'.repeat(128));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  describe('reuse detection', () => {
    it('replaying an already-rotated token revokes the entire session, including the currently-valid token', async () => {
      const { cookies: stage1 } = await signup();
      const { cookies: stage2 } = await refresh(stage1.refreshToken); // legit rotation

      // Attacker replays the stale, pre-rotation token.
      const attack = await refresh(stage1.refreshToken);
      expect(attack.res.status).toBe(401);
      expect(attack.res.body.message).toMatch(/reuse detected/i);

      // The legitimate client's own (still-current) token must now ALSO be dead -
      // reuse detection kills the whole family, not just the replayed token.
      const legitRetry = await refresh(stage2.refreshToken);
      expect(legitRetry.res.status).toBe(401);
      expect(legitRetry.res.body.message).toMatch(/revoked/i);
    });

    it('marks the family COMPROMISED and every active token REVOKED with reason reuse_detected', async () => {
      const { payload, cookies: stage1 } = await signup();
      await refresh(stage1.refreshToken);
      await refresh(stage1.refreshToken); // triggers reuse detection

      const [[family]] = await sequelize.query(`
        SELECT tf.status, tf.revoked_reason FROM token_families tf
        JOIN users u ON u.id = tf.user_id WHERE u.email = '${payload.email}'
      `);
      expect(family.status).toBe('COMPROMISED');
      expect(family.revoked_reason).toBe('reuse_detected');

      const [tokens] = await sequelize.query(`
        SELECT rt.status FROM refresh_tokens rt
        JOIN token_families tf ON tf.id = rt.family_id
        JOIN users u ON u.id = tf.user_id WHERE u.email = '${payload.email}'
      `);
      expect(tokens.every((t) => t.status !== 'ACTIVE')).toBe(true);
    });

    it('also revokes the underlying session (subsequent access token is rejected)', async () => {
      const { cookies: stage1 } = await signup();
      await refresh(stage1.refreshToken);
      await refresh(stage1.refreshToken); // reuse

      const { res } = await me(stage1.accessToken);
      expect(res.status).toBe(401);
    });
  });

  describe('expiration', () => {
    it('rejects and revokes an expired refresh token', async () => {
      const { payload, cookies } = await signup();
      await sequelize.query(`
        UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 day'
        WHERE family_id IN (
          SELECT tf.id FROM token_families tf JOIN users u ON u.id = tf.user_id WHERE u.email = '${payload.email}'
        )
      `);

      const { res } = await refresh(cookies.refreshToken);
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/expired/i);

      const [[family]] = await sequelize.query(`
        SELECT revoked_reason FROM token_families tf JOIN users u ON u.id = tf.user_id WHERE u.email = '${payload.email}'
      `);
      expect(family.revoked_reason).toBe('expired');
    });
  });

  describe('concurrency protection', () => {
    it('under N simultaneous requests with the same valid token, exactly one succeeds', async () => {
      const { cookies } = await signup();

      const attempts = await Promise.all(
        Array.from({ length: 5 }, () => refresh(cookies.refreshToken))
      );

      const succeeded = attempts.filter((a) => a.res.status === 200);
      const failed = attempts.filter((a) => a.res.status === 401);

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(4);
    });
  });

  it('a revoked session cannot be refreshed back to life', async () => {
    const { cookies } = await signup();
    await request(app).post('/api/v1/auth/logout').set('Cookie', [`refreshToken=${cookies.refreshToken}`]);

    const { res } = await refresh(cookies.refreshToken);
    expect(res.status).toBe(401);
  });

  it('rejects rotation when the session was revoked independently of its (still-ACTIVE) token family', async () => {
    // An edge case the normal revoke-cascade helpers always keep in sync
    // (see token.service.js's #revokeFamilyCascade/#revokeSessionCascade) -
    // simulated directly so the defensive check in #rotate that guards
    // against a family/session mismatch actually gets exercised.
    const { payload, cookies } = await signup();
    await sequelize.query(`
      UPDATE sessions SET status = 'REVOKED'
      WHERE user_id = (SELECT id FROM users WHERE email = '${payload.email}')
    `);

    const { res } = await refresh(cookies.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/revoked/i);
  });

  it('rotate treats a user with no `roles` loaded as having none', async () => {
    // userRepository.findById always eager-loads roles in real usage (see
    // its defaultIncludes) - spied here for this one call only, to reach the
    // `|| []` fallback #rotate defends with independently.
    const { payload, cookies } = await signup();
    const [[{ id }]] = await sequelize.query(`SELECT id FROM users WHERE email = '${payload.email}'`);
    const real = await userRepository.findById(id);
    jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ ...real.get({ plain: true }), roles: undefined });

    const { res } = await refresh(cookies.refreshToken);
    expect(res.status).toBe(200);
  });
});
