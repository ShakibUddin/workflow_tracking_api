const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signin, refresh } = require('../helpers/auth');
const { refreshToken: refreshTokenConfig } = require('../../src/config/env');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('active session cap', () => {
  const maxSessions = refreshTokenConfig.maxActiveSessionsPerUser;

  it(`evicts the oldest session once logging in would exceed the cap of ${maxSessions}`, async () => {
    const { payload, cookies: first } = await signup();

    const sessions = [first];
    // Sequential, not concurrent: eviction picks the oldest by last_used_at,
    // so these need a real, deterministic ordering to assert against.
    for (let i = 0; i < maxSessions; i += 1) {
      const { cookies } = await signin({ email: payload.email, password: payload.password });
      sessions.push(cookies);
    }

    expect(sessions).toHaveLength(maxSessions + 1);

    const oldest = await refresh(sessions[0].refreshToken);
    expect(oldest.res.status).toBe(401);
    expect(oldest.res.body.message).toMatch(/revoked/i);

    for (const session of sessions.slice(1)) {
      const { res } = await refresh(session.refreshToken);
      expect(res.status).toBe(200);
    }

    const [[{ count }]] = await sequelize.query(`
      SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE u.email = '${payload.email}' AND s.status = 'ACTIVE'
    `);
    expect(count).toBe(maxSessions);
  });

  it('records the eviction reason as session_limit_exceeded, distinct from other revocations', async () => {
    const { payload } = await signup();
    for (let i = 0; i < maxSessions; i += 1) {
      await signin({ email: payload.email, password: payload.password });
    }

    const [[evicted]] = await sequelize.query(`
      SELECT s.revoked_reason FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE u.email = '${payload.email}' AND s.status = 'REVOKED'
      ORDER BY s.id ASC LIMIT 1
    `);
    expect(evicted.revoked_reason).toBe('session_limit_exceeded');
  });

  it('eviction still succeeds when the oldest session\'s token family is already missing', async () => {
    // Orphans the oldest session's family directly - not reachable through
    // the app's own API (session+family are always created/revoked
    // together), but exercises #revokeSessionCascade's guard for a session
    // that has no family left to also revoke.
    const { payload, cookies: first } = await signup();
    await sequelize.query(`
      DELETE FROM token_families WHERE session_id = (
        SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = '${payload.email}'
      )
    `);

    for (let i = 0; i < maxSessions; i += 1) {
      await signin({ email: payload.email, password: payload.password });
    }

    const oldest = await refresh(first.refreshToken);
    expect(oldest.res.status).toBe(401);

    const [[{ count }]] = await sequelize.query(`
      SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE u.email = '${payload.email}' AND s.status = 'ACTIVE'
    `);
    expect(count).toBe(maxSessions);
  });

  it('never exceeds the cap even under concurrent logins', async () => {
    const { payload } = await signup();

    await Promise.all(
      Array.from({ length: maxSessions }, () => signin({ email: payload.email, password: payload.password }))
    );

    const [[{ count }]] = await sequelize.query(`
      SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE u.email = '${payload.email}' AND s.status = 'ACTIVE'
    `);
    expect(count).toBeLessThanOrEqual(maxSessions);
  });
});
