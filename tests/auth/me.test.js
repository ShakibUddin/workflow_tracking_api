const jwt = require('jsonwebtoken');
const request = require('supertest');
const { sequelize, resetMutableTables } = require('../helpers/db');
const { app, signup, logout, me } = require('../helpers/auth');
const { jwt: jwtConfig } = require('../../src/config/env');
const { signAccessToken } = require('../../src/utils/jwt');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /auth/me (authenticate.middleware.js)', () => {
  it('returns the current user profile with a valid access token', async () => {
    const { cookies, payload } = await signup();
    const { res } = await me(cookies.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(payload.email);
  });

  it('rejects a request with no token at all', async () => {
    const { res } = await me(undefined);
    expect(res.status).toBe(401);
  });

  it('rejects a garbage/malformed token', async () => {
    const { res } = await me('not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: '1', roles: ['ADMIN'], sid: '1' }, 'wrong-secret', { expiresIn: '15m' });
    const { res } = await me(forged);
    expect(res.status).toBe(401);
  });

  it('rejects an expired access token, even with a correct signature', async () => {
    const { cookies } = await signup();
    const payload = jwt.decode(cookies.accessToken);
    const expiredToken = jwt.sign({ sub: payload.sub, roles: payload.roles, sid: payload.sid }, jwtConfig.accessSecret, {
      expiresIn: -10, // already expired 10 seconds ago
    });

    const { res } = await me(expiredToken);
    expect(res.status).toBe(401);
  });

  it('accepts the token via Authorization: Bearer header as an alternative to the cookie', async () => {
    const { cookies, payload } = await signup();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${cookies.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(payload.email);
  });

  it('revoking the session (logout) invalidates the access token immediately, before it would naturally expire', async () => {
    const { cookies } = await signup();

    const before = await me(cookies.accessToken);
    expect(before.res.status).toBe(200);

    await logout(cookies.refreshToken);

    const after = await me(cookies.accessToken);
    expect(after.res.status).toBe(401);
    expect(after.res.body.message).toMatch(/revoked/i);
  });

  it('surfaces an unexpected session-lookup failure via next(err) instead of crashing', async () => {
    // A validly-signed token whose `sid` claim isn't a real session id at all
    // (not just a nonexistent one) - the DB rejects it while casting the
    // WHERE clause to the sessions.id BIGINT column, which is exactly the
    // kind of unanticipated failure authenticate.middleware.js's catch block
    // exists to forward rather than let crash the process.
    const forged = signAccessToken({ sub: '1', roles: ['EMPLOYEE'], permissions: [], sid: 'not-a-valid-bigint' });
    const { res } = await me(forged);
    expect(res.status).toBe(500);
  });

  it('tolerates a token with no roles/permissions claims at all, treating them as empty', async () => {
    const { cookies } = await signup();
    const realPayload = jwt.decode(cookies.accessToken);
    // A validly-signed token for a real, active session, but missing the
    // roles/permissions claims every token this app actually issues always
    // carries - exercises authenticate.middleware.js's `|| []` fallbacks.
    const bareToken = signAccessToken({ sub: realPayload.sub, sid: realPayload.sid });

    const { res } = await me(bareToken);
    expect(res.status).toBe(200);
  });
});
