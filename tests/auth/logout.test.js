const { sequelize, resetMutableTables } = require('../helpers/db');
const { signup, signin, logout, refresh } = require('../helpers/auth');
const { isCleared } = require('../helpers/cookies');

beforeEach(async () => {
  await resetMutableTables();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /auth/logout', () => {
  it('revokes the session so its refresh token stops working, and clears both cookies', async () => {
    const { cookies } = await signup();

    const { res } = await logout(cookies.refreshToken);

    expect(res.status).toBe(204);
    expect(isCleared(res.headers['set-cookie'], 'accessToken')).toBe(true);
    expect(isCleared(res.headers['set-cookie'], 'refreshToken')).toBe(true);

    const { res: refreshRes } = await refresh(cookies.refreshToken);
    expect(refreshRes.status).toBe(401);
  });

  it('is idempotent: succeeds even with no refresh token cookie at all', async () => {
    const { res } = await logout(undefined);
    expect(res.status).toBe(204);
  });

  it('does not throw on a garbage/never-issued refresh token - just clears cookies', async () => {
    const { res } = await logout('a'.repeat(128));
    expect(res.status).toBe(204);
  });

  it('does not require a valid (or any) access token', async () => {
    const { cookies } = await signup();
    // No Authorization header, no accessToken cookie set on this request at all.
    const { res } = await logout(cookies.refreshToken);
    expect(res.status).toBe(204);
  });

  it('only revokes the targeted session, leaving the user account and other sessions untouched', async () => {
    const { payload, cookies: session1 } = await signup();
    const { cookies: session2 } = await signin({ email: payload.email, password: payload.password });

    await logout(session1.refreshToken);

    const dead = await refresh(session1.refreshToken);
    expect(dead.res.status).toBe(401);

    const alive = await refresh(session2.refreshToken);
    expect(alive.res.status).toBe(200);
  });
});
